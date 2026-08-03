import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";

const SESSION_COOKIE = "stubblex_session";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1_000;
const configuredSecret = process.env.SESSION_SECRET;
const sessionSecret = configuredSecret ?? randomBytes(32).toString("hex");

if (!configuredSecret) {
  console.warn("SESSION_SECRET is not set; using an ephemeral development secret. Sessions will reset when the server restarts.");
}

type SessionPayload = {
  userId: number;
  expiresAt: number;
};

function signature(payload: string): string {
  return createHmac("sha256", sessionSecret).update(payload).digest("base64url");
}

function encodeSession(payload: SessionPayload): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${signature(encodedPayload)}`;
}

function decodeSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;

  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) return null;

  const expected = Buffer.from(signature(encodedPayload));
  const provided = Buffer.from(providedSignature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
    if (!Number.isInteger(payload.userId) || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function hashOtp(phone: string, code: string): string {
  return createHmac("sha256", sessionSecret).update(`${phone}:${code}`).digest("hex");
}

export function otpMatches(phone: string, code: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashOtp(phone, code));
  const stored = Buffer.from(storedHash);
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

export function issueSession(res: Response, userId: number): void {
  res.cookie(
    SESSION_COOKIE,
    encodeSession({ userId, expiresAt: Date.now() + SESSION_MAX_AGE_MS }),
    {
      httpOnly: true,
      maxAge: SESSION_MAX_AGE_MS,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  );
}

export function clearSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function getSessionUser(req: Request): Promise<User | null> {
  const cookies = req.cookies as Record<string, string> | undefined;
  const payload = decodeSession(cookies?.[SESSION_COOKIE]);
  if (!payload) return null;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
  return user ?? null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    res.locals.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
