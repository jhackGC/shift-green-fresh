/**
 * Shared-password admin protection — no accounts, no session store, matching the "basic flow"
 * scope of the pilot. The cookie value is a deterministic hash of the real password plus a
 * server-only secret, so middleware can verify a request without looking anything up: whoever set
 * the cookie must have known `ADMIN_PASSWORD` (via the login form) or already had a valid cookie.
 *
 * Uses Web Crypto (`crypto.subtle`) rather than Node's `crypto` module because Next.js middleware
 * runs on the Edge runtime by default, where only Web Crypto is available — this same code also
 * works unchanged from a Node.js server action.
 */

export const ADMIN_COOKIE_NAME = 'sgf_admin_session';

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The token a valid session cookie must hold — recomputed, never stored server-side. */
export async function computeSessionToken(): Promise<string> {
  const password = process.env.ADMIN_PASSWORD ?? '';
  const secret = process.env.ADMIN_SESSION_SECRET ?? '';
  return sha256Hex(`${password}:${secret}`);
}

export async function verifySessionCookie(value: string | undefined): Promise<boolean> {
  if (!value) return false;
  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) {
    // Unconfigured — fail closed rather than accepting anything.
    return false;
  }
  return value === (await computeSessionToken());
}
