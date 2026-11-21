import { json, CORS, HANDLE_RE, getRecord, isOnline } from '../../../lib/util.js';

export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

export async function onRequestGet({ params, env }) {
  const handle = String(params.handle || '').toLowerCase();
  if (!HANDLE_RE.test(handle)) return json({ ok: false, error: 'not_found' }, 404);
  const rec = await getRecord(env, handle);
  if (!rec) return json({ ok: false, error: 'not_found' }, 404);
  return json({ ok: true, url: rec.url, online: await isOnline(rec.url, 3000) });
}
