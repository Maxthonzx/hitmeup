import { json, CORS, isOnline } from '../../lib/util.js';

export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });

export async function onRequestGet({ request, env, waitUntil }) {
  if (!env.HMU_DIR) return json({ ok: false, error: 'kv_not_bound' }, 500);
  const cache = caches.default;
  const cacheKey = new Request(new URL('/api/explore', request.url).toString());
  const fresh = new URL(request.url).searchParams.has('fresh');
  const hit = fresh ? null : await cache.match(cacheKey);
  if (hit) return hit;

  const list = await env.HMU_DIR.list({ prefix: 'h:', limit: 100 });
  const recs = (await Promise.all(list.keys.map(async (k) => {
    const r = await env.HMU_DIR.get(k.name, 'json');
    return r && r.listed ? { handle: k.name.slice(2), r } : null;
  }))).filter(Boolean);

  const items = await Promise.all(recs.map(async ({ handle, r }) => ({
    handle,
    nickname: r.card?.nickname || handle,
    city: r.card?.city || '',
    tagline: r.card?.tagline || '',
    avatar: r.card?.avatar || '',
    tags: r.card?.tags || [],
    online: await isOnline(r.url, 2500),
    updatedAt: r.updatedAt,
  })));
  items.sort((a, b) => Number(b.online) - Number(a.online) || b.updatedAt - a.updatedAt);

  const res = json({ ok: true, items }, 200, { 'cache-control': 'public, max-age=60' });
  const p = cache.put(cacheKey, res.clone());
  if (typeof waitUntil === 'function') waitUntil(p); else await p;
  return res;
}
