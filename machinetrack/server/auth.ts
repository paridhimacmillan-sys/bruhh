import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import type { User } from "@shared/schema";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePassword(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  if (!hashed || !salt) return false;
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  if (hashedBuf.length !== suppliedBuf.length) return false;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function isGoogleAuthEnabled(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function getGoogleCallbackURL(): string {
  if (process.env.GOOGLE_CALLBACK_URL) return process.env.GOOGLE_CALLBACK_URL;
  const port = process.env.PORT || "5000";
  return `http://localhost:${port}/api/auth/google/callback`;
}

export function setupPassport() {
  // Local strategy — username OR email + password.
  // 'identifier' is sent from the client as either a username (operator) or an email (admin).
  passport.use(
    new LocalStrategy(
      { usernameField: "identifier", passwordField: "password" },
      async (identifier, password, done) => {
        try {
          const id = identifier.trim().toLowerCase();
          const user = id.includes("@")
            ? await storage.getUserByEmail(id)
            : await storage.getUserByUsername(id);
          if (!user) return done(null, false, { message: "Invalid credentials" });
          const valid = await comparePassword(password, user.password);
          if (!valid) return done(null, false, { message: "Invalid credentials" });
          return done(null, user);
        } catch (err) {
          return done(err as Error);
        }
      }
    )
  );

  // Google OAuth — first-time sign-in creates a new org and makes the user admin.
  if (isGoogleAuthEnabled()) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          callbackURL: getGoogleCallbackURL(),
          scope: ["profile", "email"],
        },
        async (_at, _rt, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value?.toLowerCase();
            if (!email) return done(null, false);
            const existing = await storage.getUserByEmail(email);
            if (existing) return done(null, existing);
            // First sign-in — create a new org and an admin user
            const orgName =
              profile.displayName || email.split("@")[0] || "My Organization";
            const org = await storage.createOrganization(orgName);
            const placeholderPassword = `google_oauth_${randomBytes(16).toString("hex")}`;
            const user = await storage.createUser({
              email,
              username: null,
              password: placeholderPassword,
              role: "admin",
              organizationId: org.id,
            });
            return done(null, user);
          } catch (err) {
            return done(err as Error);
          }
        }
      )
    );
  }

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      done(null, user ?? false);
    } catch (err) {
      done(err as Error);
    }
  });
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ message: "Unauthorized" });
}

export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated())
    return res.status(401).json({ message: "Unauthorized" });
  const user = req.user as User;
  if (user.role !== "admin")
    return res.status(403).json({ message: "Admin access required" });
  next();
}

export function getOrgId(req: Request): number {
  const user = req.user as User;
  if (!user?.organizationId) throw new Error("No organization");
  return user.organizationId;
}
