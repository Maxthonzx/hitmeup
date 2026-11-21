// Shared helpers for the Dazi directory service.
export const RESERVED = new Set([
  'api', 'u', 'www', 'admin', 'explore', 'dazi', 'help', 'about', 'login', 'logout', 'static', 'assets',
  'app', 'root', 'support', 'register', 'unregister', 'resolve', 'index', 'home', 'offline', 'status',
  'docs', 'blog', 'mail', 'ftp', 'test', 'null', 'undefined', 'favicon', 'robots', 'github', 'official',
]);
export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{2,29}$/;

export const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS, ...extra },
  });
}

export function allowHttp(env) {
  return String(env.DEV_ALLOW_HTTP || '') === '1';
}

export function validUrl(u, env) {
  if (typeof u !== 'string' || u.length >= 300) return false;
  let p;
  try { p = new URL(u); } catch { return false; }
  if (p.username || p.password) return false;
  if (p.protocol === 'https:') return true;
  if (allowHttp(env) && p.protocol === 'http:' && (p.hostname === '127.0.0.1' || p.hostname === 'localhost')) return true;
  return false;
}

export function cleanUrl(u) {
  const p = new URL(u);
  return (p.origin + p.pathname).replace(/\/+$/, '');
}

export async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

export function cleanCard(c) {
  c = c && typeof c === 'object' ? c : {};
  const tags = Array.isArray(c.tags) ? c.tags.map((t) => str(t, 20)).filter(Boolean).slice(0, 8) : [];
  let avatar = str(c.avatar, 300);
  // avatar: a short emoji/text, or an https URL
  if (avatar.length > 8 && !/^https:\/\//.test(avatar)) avatar = '';
  return {
    nickname: str(c.nickname, 30),
    city: str(c.city, 30),
    tagline: str(c.tagline, 120),
    avatar,
    tags,
  };
}

export async function readJson(request, limit = 4096) {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > limit) return { error: 'body_too_large' };
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { error: 'bad_json' };
    return { value: v };
  } catch { return { error: 'bad_json' }; }
}

// Is the tunnel alive? GET <url>/api/ping within timeoutMs.
export async function isOnline(url, timeoutMs = 3000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url + '/api/ping', { signal: ctl.signal, redirect: 'manual', headers: { 'user-agent': 'dazi-directory/1' } });
    return r.status >= 200 && r.status < 300;
  } catch { return false; } finally { clearTimeout(t); }
}

export async function getRecord(env, handle) {
  if (!env.DAZI_DIR) return null;
  return env.DAZI_DIR.get('h:' + handle, 'json');
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PAGE_CSS = `*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#fff7f3;color:#2a1f24}
.c{max-width:440px;text-align:center;background:#fff;border-radius:28px;padding:40px 28px;box-shadow:0 20px 60px -20px rgba(255,90,95,.35)}
.e{font-size:56px;margin-bottom:8px}h1{font-size:22px;margin:8px 0}p{color:#6d5a62;line-height:1.7;margin:8px 0}
a.b{display:inline-block;margin-top:18px;padding:12px 24px;border-radius:999px;background:linear-gradient(135deg,#ff5a5f,#ff9966);color:#fff;text-decoration:none;font-weight:600}
a.s{display:block;margin-top:12px;color:#e0484d;text-decoration:none;font-size:14px}
@media(prefers-color-scheme:dark){body{background:#1a1316;color:#f5eaee}.c{background:#251a1f;box-shadow:none}p{color:#b9a5ad}a.s{color:#ff8a8e}}`;

export function page(status, emoji, title, bodyHtml) {
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} · 搭子 Dazi</title><link rel="icon" href="/favicon.svg"><style>${PAGE_CSS}</style></head><body><main class="c"><div class="e">${emoji}</div><h1>${esc(title)}</h1>${bodyHtml}</main></body></html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
}
