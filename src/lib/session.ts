/**
 * Server session — MIGRATION_PLAN.md §6.1
 *
 * After a LINE ID token is verified, the server issues a signed (HS256) session
 * as an httpOnly cookie. From then on the server derives the user's identity
 * from this cookie ONLY — the client can no longer claim to be someone by
 * putting a user_id / line_user_id in a request body.
 *
 * The signing key is SESSION_SECRET (validated in src/config/env.ts). This
 * module reads it via process.env directly so it stays edge-safe and does not
 * force the full env module into the middleware bundle.
 */
import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'

const COOKIE_NAME = 'hh_session'
const ALG = 'HS256'
const MAX_AGE_SEC = 60 * 60 * 24 * 30 // 30 days

export interface SessionPayload {
  /** LINE user id (sub) — the verified identity */
  line_user_id: string
  /** LINE display name captured at login (used when creating the profile) */
  name?: string
  /** LINE picture url captured at login */
  picture?: string
  /** internal user_profiles.id — present once the profile exists (post-onboarding) */
  uid?: string
  /** phone (canonical 0xxxxxxxxx) that passed OTP verification in this session */
  verified_phone?: string
  /** unix seconds when verified_phone expires (must re-verify after) */
  vp_exp?: number
  /** pending OTP: ThaiBulkSMS token + the phone it was sent to (canonical form) */
  otp_token?: string
  otp_phone?: string
}

function secretKey(): Uint8Array {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('[session] SESSION_SECRET is not set')
  return new TextEncoder().encode(s)
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secretKey())
}

/** Verify a raw token (edge-safe: only jose + process.env). Returns null if invalid. */
export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey())
    if (typeof payload.line_user_id !== 'string') return null
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

/** Issue/refresh the session cookie (call from a Route Handler). */
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload)
  const jar = await cookies()
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SEC,
  })
}

/** Read + verify the current session, or null. */
export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies()
  return verifySessionToken(jar.get(COOKIE_NAME)?.value)
}

export async function clearSession(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE_NAME)
}

export const SESSION_COOKIE_NAME = COOKIE_NAME
