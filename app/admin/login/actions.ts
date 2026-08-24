'use server';

import { ADMIN_COOKIE_NAME, computeSessionToken } from 'lib/auth/session';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

/** No real admin index page exists — land somewhere real once logged in. */
const DEFAULT_ADMIN_PATH = '/admin/boxes';

export async function login(formData: FormData): Promise<void> {
  const password = String(formData.get('password') ?? '');
  const nextPath = String(formData.get('next') ?? '') || DEFAULT_ADMIN_PATH;

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    redirect(`/admin/login?error=1&next=${encodeURIComponent(nextPath)}`);
  }

  (await cookies()).set(ADMIN_COOKIE_NAME, await computeSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30 // 30 days — a shared pilot password, not a security-sensitive session
  });

  redirect(nextPath);
}
