import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";

export const SESSION_COOKIE = "alfaer_session";
export const SITE_COOKIE = "alfaer_site";

const SESSION_DAYS = 14;

/**
 * Whether session cookies carry the Secure flag.
 *
 * Defaults to on in production, which is right for anything reachable over
 * HTTPS. It has to be switchable because browsers refuse to store a Secure
 * cookie sent from a plain-HTTP origin that is not localhost: on an internal
 * deployment at http://10.0.0.x the sign-in form would appear to succeed and
 * then bounce straight back, with nothing in the logs to explain it. Such a
 * deployment must set AUTH_COOKIE_SECURE=false, and should be reachable only
 * over a VPN, because the session cookie then travels in clear text.
 */
export function cookieSecure(): boolean {
  const configured = process.env.AUTH_COOKIE_SECURE;
  if (configured === "false") return false;
  if (configured === "true") return true;
  return process.env.NODE_ENV === "production";
}
/** Sessions renew when less than this much of their life remains. */
const RENEW_WITHIN_MS = 7 * 24 * 3600 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(userId: string, userAgent?: string | null) {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: userAgent?.slice(0, 300) ?? null,
    },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    expires: expiresAt,
  });

  return { token, expiresAt };
}

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

/**
 * Resolves the signed-in user from the session cookie. Returns null rather
 * than throwing, so each caller decides whether its page is public.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // A deactivated user's existing sessions stop working immediately, rather
  // than lingering until they expire.
  if (!session.user.active) return null;

  // Sliding expiry, written at most once a day so a busy shift does not
  // generate a database write on every page view.
  const now = Date.now();
  const remaining = session.expiresAt.getTime() - now;
  const staleLastSeen = now - session.lastSeenAt.getTime() > 24 * 3600 * 1000;

  if (remaining < RENEW_WITHIN_MS || staleLastSeen) {
    const expiresAt = new Date(now + SESSION_DAYS * 24 * 3600 * 1000);
    await prisma.session
      .update({
        where: { id: session.id },
        data: { expiresAt, lastSeenAt: new Date() },
      })
      .catch(() => {});
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    isAdmin: session.user.isAdmin,
  };
}

/** Removes expired sessions. Called opportunistically at sign-in. */
export async function pruneExpiredSessions() {
  await prisma.session
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});
}
