import { createHmac, timingSafeEqual } from "node:crypto";

const secret = process.env.SESSION_SECRET ?? "stubblex-development-verification-secret";

type VerificationPayload = { phone: string; expiresAt: number };

function signature(payload: string): string {
  return createHmac("sha256", secret).update(`onboarding:${payload}`).digest("base64url");
}

export function createOnboardingVerificationToken(phone: string): string {
  const payload = Buffer.from(JSON.stringify({ phone, expiresAt: Date.now() + 15 * 60_000 } satisfies VerificationPayload)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function readOnboardingVerificationToken(token: string): VerificationPayload | null {
  const [payload, supplied] = token.split(".");
  if (!payload || !supplied) return null;
  const expectedBuffer = Buffer.from(signature(payload));
  const suppliedBuffer = Buffer.from(supplied);
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as VerificationPayload;
    if (!/^[6-9][0-9]{9}$/.test(decoded.phone) || decoded.expiresAt <= Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}
