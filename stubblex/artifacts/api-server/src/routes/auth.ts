import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { AuthMeResponse } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { clearSession, getSessionUser, issueSession } from "../lib/session";

const router: IRouter = Router();
const OAUTH_COOKIE_MAX_AGE_MS = 10 * 60 * 1_000;

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

function publicUser(user: typeof usersTable.$inferSelect) {
  return { id: user.id, phone: user.phone, email: user.email, name: user.name, role: user.role };
}

function secureCookie() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google/callback",
    maxAge: OAUTH_COOKIE_MAX_AGE_MS,
  };
}

function oauthConfig(req: Request): { clientId: string; clientSecret: string; redirectUri: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const baseUrl = process.env.PUBLIC_BASE_URL ?? `${req.protocol}://${req.get("host")}`;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? new URL("/api/auth/google/callback", baseUrl).toString();
  return { clientId, clientSecret, redirectUri };
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function loginRedirect(res: Response, reason: string): void {
  res.redirect(302, `/login?error=${encodeURIComponent(reason)}`);
}

router.get("/auth/google", (req, res) => {
  const config = oauthConfig(req);
  if (!config) return void res.status(503).send("Google Sign-In is not configured on this server");

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  res.cookie("unpackos_google_state", state, secureCookie());
  res.cookie("unpackos_google_verifier", verifier, secureCookie());

  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("redirect_uri", config.redirectUri);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "openid email profile");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", challenge);
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("prompt", "select_account");
  res.redirect(302, authorize.toString());
});

router.get("/auth/google/callback", async (req, res, next) => {
  const config = oauthConfig(req);
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const cookies = req.cookies as Record<string, string> | undefined;
  const expectedState = cookies?.unpackos_google_state ?? "";
  const verifier = cookies?.unpackos_google_verifier ?? "";
  const { maxAge: _maxAge, ...clearOptions } = secureCookie();
  res.clearCookie("unpackos_google_state", clearOptions);
  res.clearCookie("unpackos_google_verifier", clearOptions);

  if (!config) return void loginRedirect(res, "google_not_configured");
  if (!state || !expectedState || !safeEqual(state, expectedState) || !code || !verifier) return void loginRedirect(res, "invalid_login_state");

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        code_verifier: verifier,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri,
      }),
    });
    const token = await tokenResponse.json() as GoogleTokenResponse;
    if (!tokenResponse.ok || !token.access_token) return void loginRedirect(res, "google_exchange_failed");

    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    const profile = await profileResponse.json() as GoogleUserInfo;
    if (!profileResponse.ok || !profile.sub || !profile.email || profile.email_verified !== true) return void loginRedirect(res, "unverified_google_account");

    const email = profile.email.trim().toLowerCase();
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (!user || !user.active) return void loginRedirect(res, "not_approved");
    if (user.googleSubject && user.googleSubject !== profile.sub) return void loginRedirect(res, "google_account_mismatch");

    if (!user.googleSubject) {
      await db.update(usersTable).set({ googleSubject: profile.sub }).where(eq(usersTable.id, user.id));
    }
    issueSession(res, user.id);
    res.redirect(302, "/dispatch");
  } catch (error) {
    next(error);
  }
});

router.get("/auth/me", async (req, res, next) => {
  try {
    const user = await getSessionUser(req);
    if (!user || !user.active) return void res.status(401).json({ message: "Authentication required" });
    res.json(AuthMeResponse.parse(publicUser(user)));
  } catch (error) {
    next(error);
  }
});

router.post("/auth/logout", (_req, res) => {
  clearSession(res);
  res.json({ message: "Logged out" });
});

export default router;
