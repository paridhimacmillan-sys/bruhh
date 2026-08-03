import { randomInt } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  AuthMeResponse,
  AuthRequestOtpBody,
  AuthRequestOtpResponse,
  AuthVerifyOtpBody,
  AuthVerifyOtpResponse,
} from "@workspace/api-zod";
import { db, otpCodesTable, usersTable } from "@workspace/db";
import {
  clearSession,
  getSessionUser,
  hashOtp,
  issueSession,
  otpMatches,
} from "../lib/session";
import { sendOtpSms } from "../lib/sms";

const router: IRouter = Router();
const OTP_TTL_MS = 5 * 60 * 1_000;
const OTP_RATE_WINDOW_MS = 15 * 60 * 1_000;
const MAX_REQUESTS_PER_WINDOW = 3;
const MAX_VERIFY_ATTEMPTS = 5;

function publicUser(user: typeof usersTable.$inferSelect) {
  return { id: user.id, phone: user.phone, name: user.name, role: user.role };
}

router.post("/auth/request-otp", async (req, res, next) => {
  const parsedBody = AuthRequestOtpBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ message: "Enter a valid 10-digit Indian mobile number" });
    return;
  }

  const { phone } = parsedBody.data;

  try {
    const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.phone, phone)).limit(1);
    if (!user) {
      res.status(202).json(AuthRequestOtpResponse.parse({ message: "If this operator account exists, an OTP has been sent." }));
      return;
    }

    const windowStart = new Date(Date.now() - OTP_RATE_WINDOW_MS);
    const [rate] = await db
      .select({ requests: sql<number>`count(*)::int` })
      .from(otpCodesTable)
      .where(and(eq(otpCodesTable.phone, phone), gte(otpCodesTable.createdAt, windowStart)));

    if ((rate?.requests ?? 0) >= MAX_REQUESTS_PER_WINDOW) {
      res.status(429).json({ message: "Too many OTP requests. Try again in 15 minutes." });
      return;
    }

    await db
      .update(otpCodesTable)
      .set({ consumed: true })
      .where(and(eq(otpCodesTable.phone, phone), eq(otpCodesTable.consumed, false)));

    const code = String(randomInt(100_000, 1_000_000));
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const [otp] = await db
      .insert(otpCodesTable)
      .values({ phone, code: hashOtp(phone, code), expiresAt, attempts: 0, consumed: false })
      .returning({ id: otpCodesTable.id });

    try {
      await sendOtpSms(phone, code);
    } catch (error) {
      if (otp) await db.update(otpCodesTable).set({ consumed: true }).where(eq(otpCodesTable.id, otp.id));
      throw error;
    }

    res.status(202).json(AuthRequestOtpResponse.parse({ message: "OTP sent" }));
  } catch (error) {
    next(error);
  }
});

router.post("/auth/verify-otp", async (req, res, next) => {
  const parsedBody = AuthVerifyOtpBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ message: "Enter the 6-digit OTP" });
    return;
  }

  const { phone, code } = parsedBody.data;

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone)).limit(1);
    const [otp] = await db
      .select()
      .from(otpCodesTable)
      .where(and(eq(otpCodesTable.phone, phone), eq(otpCodesTable.consumed, false)))
      .orderBy(desc(otpCodesTable.createdAt))
      .limit(1);

    if (!user || !otp || otp.expiresAt.getTime() <= Date.now()) {
      if (otp) await db.update(otpCodesTable).set({ consumed: true }).where(eq(otpCodesTable.id, otp.id));
      res.status(400).json({ message: "OTP is invalid or expired" });
      return;
    }

    if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
      await db.update(otpCodesTable).set({ consumed: true }).where(eq(otpCodesTable.id, otp.id));
      res.status(429).json({ message: "Too many verification attempts. Request a new OTP." });
      return;
    }

    if (!otpMatches(phone, code, otp.code)) {
      const attempts = otp.attempts + 1;
      await db
        .update(otpCodesTable)
        .set({ attempts, consumed: attempts >= MAX_VERIFY_ATTEMPTS })
        .where(eq(otpCodesTable.id, otp.id));
      res.status(attempts >= MAX_VERIFY_ATTEMPTS ? 429 : 400).json({ message: "OTP is invalid or expired" });
      return;
    }

    await db.update(otpCodesTable).set({ consumed: true }).where(eq(otpCodesTable.id, otp.id));
    issueSession(res, user.id);
    res.json(AuthVerifyOtpResponse.parse(publicUser(user)));
  } catch (error) {
    next(error);
  }
});

router.get("/auth/me", async (req, res, next) => {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
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
