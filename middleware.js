/**
 * Maintenance gate (Vercel Routing Middleware).
 *
 * While MAINTENANCE is on, every public page answers with /maintenance.html
 * (HTTP 503 + Retry-After, so search engines keep the old index).
 *
 * Bypass: open any page with ?preview=<PREVIEW_KEY>. That sets a 30-day
 * cookie, so the full site works normally in that browser. ?preview=off
 * clears it again. Set DRKEM_PREVIEW_KEY in Vercel to override the default.
 *
 * Never gated: /api (admin backend), /admin, and static assets.
 * To take the site live, set MAINTENANCE to false (or delete this file).
 */
const MAINTENANCE = true;
const COOKIE = 'drkem_preview';

export const config = {
  matcher: ['/((?!api/|admin|css/|js/|assets/|maintenance|favicon).*)'],
};

export default async function middleware(request) {
  if (!MAINTENANCE) return;

  const key = (typeof process !== 'undefined' && process.env.DRKEM_PREVIEW_KEY) || 'kem-preview-2026';
  const url = new URL(request.url);
  const asked = url.searchParams.get('preview');

  if (asked === 'off') {
    url.searchParams.delete('preview');
    return new Response(null, {
      status: 302,
      headers: { Location: url.toString(), 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; Secure; SameSite=Lax` },
    });
  }
  if (asked === key) {
    url.searchParams.delete('preview');
    return new Response(null, {
      status: 302,
      headers: {
        Location: url.toString(),
        'Set-Cookie': `${COOKIE}=${key}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
      },
    });
  }

  const cookies = request.headers.get('cookie') || '';
  if (cookies.split(/;\s*/).includes(`${COOKIE}=${key}`)) return; // continue to the real page

  const page = await fetch(new URL('/maintenance', url.origin));
  return new Response(page.body, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Retry-After': '86400',
      'Cache-Control': 'no-store',
    },
  });
}
