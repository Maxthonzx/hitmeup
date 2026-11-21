import { json, CORS, HANDLE_RE, sha256Hex, timingSafeEqual, readJson } from '../../lib/util.js';

export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

export async function onRequestPost({ request, env }) {
  if (!env.HMU_DIR) return json({ ok: false, error: 'kv_not_bound' }, 500);
  const { value: b, error } = await readJson(request);
  if (error) return json({ ok: false, error }, error === 'body_too_large' ? 413 : 400);
  if (typeof b.handle !== 'string' || !HANDLE_RE.test(b.handle) || typeof b.secret !== 'string') return json({ ok: false, error: 'bad_request' }, 400);
  const rec = await env.HMU_DIR.get('h:' + b.handle, 'json');
  if (!rec) return json({ ok: false, error: 'not_found' }, 404);
  if (!timingSafeEqual(rec.secretHash, await sha256Hex(b.secret))) return json({ ok: false, error: 'forbidden' }, 403);
  await env.HMU_DIR.delete('h:' + b.handle);
  return json({ ok: true });
}
