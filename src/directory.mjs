// 目录服务客户端（site 提供）。注册频率受 KV 配额限制：仅启动/URL 变化/每 12h。
import { publicProfile } from './data.mjs';

const TWELVE_H = 12 * 3600 * 1000;

export const directoryEnabled = (dir) => !!dir && !['off', 'none', '0', 'false'].includes(String(dir).toLowerCase());

export async function resolveHandle(directory, handle, { fetchImpl = fetch } = {}) {
  if (!directoryEnabled(directory)) throw new Error('目录服务已关闭，请直接使用对方的链接');
  const res = await fetchImpl(`${directory.replace(/\/$/, '')}/api/resolve/${encodeURIComponent(handle)}`, { signal: AbortSignal.timeout(10000) });
  if (res.status === 404) return { ok: false };
  if (!res.ok) throw new Error(`目录服务返回 HTTP ${res.status}`);
  return res.json();
}

export function buildRegistration(profile, secret, url) {
  const pub = publicProfile(profile);
  return {
    handle: profile.handle, url, secret, listed: !!profile.listed,
    card: { nickname: pub.nickname, city: pub.city, tagline: pub.tagline, avatar: pub.avatar, tags: [...(pub.hobbies || []), ...(pub.recentInterests || [])].slice(0, 8) },
  };
}

export async function registerOnce(directory, payload, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`${directory.replace(/\/$/, '')}/api/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
  });
  let j = {};
  try { j = await res.json(); } catch { /* ignore */ }
  if (res.status === 409) return { ok: false, reason: `handle「${payload.handle}」已被别人占用，请换一个（npm run setup）` };
  if (!res.ok || !j.ok) return { ok: false, reason: `目录返回 HTTP ${res.status}` };
  return { ok: true, link: j.link };
}

export async function unregister(directory, handle, secret, { fetchImpl = fetch } = {}) {
  const res = await fetchImpl(`${directory.replace(/\/$/, '')}/api/unregister`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handle, secret }), signal: AbortSignal.timeout(15000),
  });
  return res.ok;
}

/** 注册管理器：启动/URL 变化/12h 才注册 */
export function createRegistrar({ agent, log = console.log, fetchImpl = fetch }) {
  let lastUrl = null, lastAt = 0, link = null;
  async function sync(force = false) {
    const url = agent.runtime.publicUrl;
    const dir = agent.directory;
    if (!directoryEnabled(dir) || !url || url.startsWith('http://127.') || url.startsWith('http://localhost')) return null;
    if (!force && url === lastUrl && Date.now() - lastAt < TWELVE_H) return link;
    const p = agent.profile();
    if (!p) return null;
    try {
      const r = await registerOnce(dir, buildRegistration(p, agent.config().secret, url), { fetchImpl });
      if (r.ok) { lastUrl = url; lastAt = Date.now(); link = r.link || `${dir.replace(/\/$/, '')}/u/${p.handle}`; agent.runtime.shareLink = link; log(`[目录] 已登记：${link}`); }
      else log(`[目录] 登记失败：${r.reason}`);
    } catch (e) { log(`[目录] 暂时连不上目录服务：${e.message}（稍后重试）`); lastAt = Date.now() - TWELVE_H + 5 * 60 * 1000; }
    return link;
  }
  return { sync };
}
