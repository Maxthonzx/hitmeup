// 轻量 HTTP 工具：请求体限制、JSON 响应、限流。
import { DaziError } from './errors.mjs';

export const BODY_LIMIT = 16 * 1024;

export function readBody(req, limit = BODY_LIMIT) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new DaziError('too_large', '请求内容太大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export async function readJson(req) {
  const text = await readBody(req);
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw new DaziError('invalid', '请求不是合法的 JSON'); }
}

export function send(res, status, body, headers = {}) {
  const isObj = typeof body === 'object' && body !== null && !Buffer.isBuffer(body);
  const h = {
    'content-type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cache-control': 'no-store', ...headers,
  };
  res.writeHead(status, h);
  res.end(isObj ? JSON.stringify(body) : body);
}
export const sendHtml = (res, html, status = 200) => send(res, status, html, {
  'content-type': 'text/html; charset=utf-8',
  'content-security-policy': "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
});

export function clientIp(req) {
  return String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || 'unknown');
}

/** 滑动窗口限流 */
export function createRateLimiter({ max = 10, windowMs = 3600 * 1000 } = {}) {
  const hits = new Map();
  return {
    take(key, now = Date.now()) {
      const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
      if (arr.length >= max) { hits.set(key, arr); return false; }
      arr.push(now); hits.set(key, arr);
      if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
      return true;
    },
  };
}

export function errorStatus(e) {
  if (!(e instanceof DaziError)) return 500;
  return { not_found: 404, too_large: 413, bad_state: 409, slot_taken: 409, no_overlap: 409, too_many_pending: 429, offline: 502, peer_error: 502 }[e.code] || 400;
}
export function sendError(res, e) {
  const status = errorStatus(e);
  if (status === 500) console.error('[错误]', e);
  send(res, status, { ok: false, error: e instanceof DaziError ? e.message : '服务器内部错误', code: e.code || 'internal', ...(e.extra || {}) });
}
