import { json, CORS, HANDLE_RE, RESERVED, validUrl, cleanUrl, cleanCard, sha256Hex, timingSafeEqual, readJson } from '../../lib/util.js';

export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

export async function onRequestPost({ request, env }) {
  if (!env.HMU_DIR) return json({ ok: false, error: 'kv_not_bound' }, 500);
  const { value: b, error } = await readJson(request);
  if (error) return json({ ok: false, error }, error === 'body_too_large' ? 413 : 400);

  const handle = typeof b.handle === 'string' ? b.handle : '';
  if (!HANDLE_RE.test(handle)) return json({ ok: false, error: 'invalid_handle' }, 400);
  if (RESERVED.has(handle)) return json({ ok: false, error: 'reserved_handle' }, 400);
  if (!validUrl(b.url, env)) return json({ ok: false, error: 'invalid_url' }, 400);
  if (typeof b.secret !== 'string' || !/^[0-9a-fA-F]{32,128}$/.test(b.secret)) return json({ ok: false, error: 'invalid_secret' }, 400);

  const secretHash = await sha256Hex(b.secret);
  const key = 'h:' + handle;
  const existing = await env.HMU_DIR.get(key, 'json');
  if (existing && !timingSafeEqual(existing.secretHash, secretHash)) return json({ ok: false, error: 'handle_taken' }, 409);

  const record = {
    url: cleanUrl(b.url),
    secretHash,
    listed: b.listed === undefined ? existing?.listed === true : b.listed === true,
    card: b.card !== undefined ? cleanCard(b.card) : (existing?.card || cleanCard({})),
    updatedAt: Date.now(),
  };
  await env.HMU_DIR.put(key, JSON.stringify(record));
  const host = new URL(request.url).host;
  const scheme = allowLocal(request) ? 'http' : 'https';
  return json({ ok: true, link: `${scheme}://${host}/u/${handle}` });
}

function allowLocal(request) {
  const h = new URL(request.url).hostname;
  return h === '127.0.0.1' || h === 'localhost';
}
