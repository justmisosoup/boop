/**
 * A passcode in front of the whole deployment.
 *
 * Vercel Routing Middleware: it runs at the edge before the filesystem and
 * before `vercel.json`'s rewrite, on every path — the page, `/businesses/…`,
 * and the JS bundle that carries the records — so nothing is served until the
 * code has been entered. It does not run under `vite dev`; locally the app is
 * open as before.
 *
 * Entering the code sets a long-lived cookie holding a token derived from it,
 * never the code itself, so a browser is asked once. Changing `CODE` changes
 * the token and asks everyone again.
 *
 * Four digits is a gate, not a lock: it keeps a shared link from being opened
 * by whoever it reaches, and nothing more.
 */
export const config = { matcher: '/:path*' }

const CODE = '1337'
const COOKIE = 'proto_access'
/** A year: entered once per browser. */
const MAX_AGE = 60 * 60 * 24 * 365
const UNLOCK = '/__unlock'

/** What the cookie holds: a digest of the code, not the code. */
const tokenFor = async (code: string) => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`business-identity-prototype:${code}`))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Carry on to the deployment — what `next()` in `@vercel/functions` returns. */
const pass = () => new Response(null, { headers: { 'x-middleware-next': '1' } })

const cookieOf = (req: Request, name: string) =>
  (req.headers.get('cookie') ?? '')
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([key]) => key === name)?.[1]

/** Only a path on this site, so the form cannot be used to send someone elsewhere. */
const sameSite = (to: string | null | undefined) => (to && to.startsWith('/') && !to.startsWith('//') ? to : '/')

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const page = (to: string, wrong: boolean) =>
  new Response(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Enter code</title>
<style>
  :root { color-scheme: light dark; --bg: #f7f7f8; --card: #ffffff; --text: #111316; --muted: #5f6874; --border: #e2e4e8; --accent: #111316; --on-accent: #ffffff; --danger: #c4321f; }
  @media (prefers-color-scheme: dark) { :root { --bg: #111316; --card: #1b1e22; --text: #f3f4f6; --muted: #a1a8b3; --border: #2c3036; --accent: #f3f4f6; --on-accent: #111316; --danger: #f07a68; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px; background: var(--bg); color: var(--text); font: 14px/1.4 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  form { width: 100%; max-width: 320px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 24px; display: grid; gap: 16px; }
  h1 { margin: 0; font-size: 16px; font-weight: 600; }
  p { margin: 4px 0 0; color: var(--muted); }
  input { width: 100%; padding: 10px 12px; font: inherit; font-size: 20px; letter-spacing: 0.5em; text-align: center; color: var(--text); background: transparent; border: 1px solid var(--border); border-radius: 8px; }
  input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  button { padding: 10px 12px; font: inherit; font-weight: 600; color: var(--on-accent); background: var(--accent); border: 0; border-radius: 8px; cursor: pointer; }
  .error { margin: 0; color: var(--danger); }
</style>
</head>
<body>
<form method="post" action="${UNLOCK}">
  <div>
    <h1>Business identity prototype</h1>
    <p>Enter the 4-digit code to continue.</p>
  </div>
  <input name="code" type="password" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" required autofocus aria-label="4-digit code">
  <input name="next" type="hidden" value="${escape(to)}">
  ${wrong ? '<p class="error" role="alert">That code isn’t right.</p>' : ''}
  <button type="submit">Continue</button>
</form>
</body>
</html>`,
    {
      status: wrong ? 401 : 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' }
    }
  )

export default async function middleware(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const token = await tokenFor(CODE)

  // The form posts here: the right code sets the cookie and goes on to the
  // page that was asked for; anything else asks again.
  if (url.pathname === UNLOCK && req.method === 'POST') {
    const form = await req.formData()
    const to = sameSite(String(form.get('next') ?? '/'))
    if (String(form.get('code') ?? '').trim() !== CODE) return page(to, true)
    return new Response(null, {
      status: 303,
      headers: {
        location: to,
        'set-cookie': `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
        'cache-control': 'no-store'
      }
    })
  }

  if (cookieOf(req, COOKIE) === token) return pass()
  return page(sameSite(url.pathname + url.search), false)
}
