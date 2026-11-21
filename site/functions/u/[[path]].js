import { HANDLE_RE, getRecord, isOnline, page, esc } from '../../lib/util.js';

export async function onRequest({ request, params, env }) {
  const parts = [].concat(params.path || []);
  const handle = String(parts[0] || '').toLowerCase();
  const rest = parts.slice(1).map(encodeURIComponent).join('/');
  const search = new URL(request.url).search;

  const notFound = () => page(404, '🔍', '没找到这个搭子',
    `<p>这个链接还没有人认领，或者主人已经下线了它。</p><p>想要自己的搭子？</p><a class="b" href="/">给自己装一个</a><a class="s" href="/explore.html">看看谁在线</a>`);
  if (!HANDLE_RE.test(handle)) return notFound();
  const rec = await getRecord(env, handle);
  if (!rec) return notFound();

  if (!(await isOnline(rec.url, 3000))) {
    return page(503, '💤', 'TA 的搭子暂时不在线',
      `<p>主人的电脑可能关机了，或者没联网。</p><p>稍后再来试试，搭子醒来就能接待你。</p><a class="b" href="/u/${esc(handle)}">刷新看看</a><a class="s" href="/">了解搭子 Dazi →</a>`);
  }
  const target = rec.url + '/' + rest + search;
  return new Response(null, { status: 302, headers: { location: target, 'cache-control': 'no-store' } });
}
