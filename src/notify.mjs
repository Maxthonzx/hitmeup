// 通知：控制台 + Bark + Webhook。任何失败都不影响主流程。
export async function notify(cfg, title, body, { log = console.log, fetchImpl = fetch } = {}) {
  log(`[通知] ${title}${body ? ' — ' + body : ''}`);
  const n = cfg?.notify || {};
  const results = {};
  const tasks = [];
  if (n.bark?.key) {
    const server = (n.bark.server || 'https://api.day.app').replace(/\/$/, '');
    const url = `${server}/${encodeURIComponent(n.bark.key)}/${encodeURIComponent(title)}/${encodeURIComponent(body || '')}`;
    tasks.push(fetchImpl(url, { signal: AbortSignal.timeout(8000) }).then((r) => { results.bark = r.ok ? 'ok' : `HTTP ${r.status}`; })
      .catch((e) => { results.bark = `失败: ${e.message}`; }));
  }
  if (n.webhook?.url) {
    const payload = n.webhook.kind === 'feishu'
      ? { msg_type: 'text', content: { text: `${title}\n${body || ''}` } }
      : { title, body, source: 'hitmeup', ts: new Date().toISOString() };
    tasks.push(fetchImpl(n.webhook.url, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(8000),
    }).then((r) => { results.webhook = r.ok ? 'ok' : `HTTP ${r.status}`; })
      .catch((e) => { results.webhook = `失败: ${e.message}`; }));
  }
  await Promise.all(tasks);
  return results;
}
