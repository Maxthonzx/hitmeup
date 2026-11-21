// 公开服务器（唯一被隧道暴露的部分）：资料卡、REST、A2A。不含任何管理路由。
import http from 'node:http';
import { readJson, send, sendHtml, sendError, clientIp, createRateLimiter } from './http.mjs';
import { handleRpc, agentCard } from './a2a.mjs';
import { renderCard, renderStatusPage } from './page.mjs';
import { publicProfile } from './data.mjs';
import { HmuError } from './errors.mjs';

export function llmsTxt(base, p) {
  return `# 约我 Hit Me Up — ${p?.nickname || ''} 的个人 AI 分身

这是一个真人的个人 Agent。你（访客的 AI）可以：了解 TA（破冰）、打招呼、替你的用户约见面。
你永远看不到 TA 的日历，只能看到 TA 愿意提供的空闲时间；TA 本人确认后才会成交。

## REST
- GET  ${base}/api/profile                  公开资料（JSON，不含联系方式）
- GET  ${base}/api/slots?duration=60        可约时间（JSON，已按推荐顺序）
- POST ${base}/api/hi                       打招呼  {"name","intro","contact","message"}
- POST ${base}/api/meetup                   约见面  {"name","intro","contact"(必填),"title","durationMin","meetupType","place","note","slot":{"start","end"}}
                                            → {"ok":true,"id","token","url"}
- GET  ${base}/api/requests/<id>?t=<token>  查看状态：pending / accepted / declined / counter
                                            accepted 后才会返回时间、地点与 TA 愿意给你的联系方式

## A2A (v0.3, JSON-RPC 2.0)
- AgentCard: ${base}/.well-known/agent-card.json
- POST ${base}/a2a  method=message/send，message.parts 里放一个 DataPart：
  {"type":"get-profile"}
  {"type":"say-hi","from":{"name","intro","contact"},"message":"..."}
  {"type":"request-meetup","from":{"name","intro","contact","handle?","agentUrl?"},
   "meeting":{"title","durationMin":60,"meetupType":"喝咖啡","place?","note?"},"slots":[{"start":"ISO8601带时区","end":"..."}]}
- 与 TA 的空闲时间有交集 → 任务 state=input-required（等 TA 确认）；没有交集 → rejected，并附 freeSlots 供你重新提议
- POST ${base}/a2a  method=tasks/get params={"id":"<taskId>"} 轮询；completed 的 artifact 含 {slot, place, contacts}

## 礼仪
请真实地代表你的用户；不要刷请求（限流：每 IP 每小时 10 次写入）。完整文档：https://github.com/Maxthonzx/hitmeup/blob/main/docs/protocol.md
`;
}

export function createPublicServer(agent, { rateMax = Number(process.env.HITMEUP_RATE_LIMIT) || 10, log = console.log } = {}) {
  const limiter = createRateLimiter({ max: rateMax });
  const guard = (req, res) => {
    if (limiter.take(clientIp(req))) return true;
    send(res, 429, { ok: false, error: '请求太频繁，请一小时后再试', code: 'rate_limited' });
    return false;
  };

  async function handle(req, res) {
    const u = new URL(req.url, 'http://x');
    const p = u.pathname;
    const base = agent.publicUrlFor(req);
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
    if (req.method === 'OPTIONS') return send(res, 204, '', cors);
    const J = (status, body) => send(res, status, body, cors);

    if (req.method === 'GET') {
      if (p === '/') {
        const prof = agent.profile();
        if (!prof) return send(res, 503, '主人还没有创建资料');
        return sendHtml(res, renderCard(prof, { tz: agent.tz() }));
      }
      if (p === '/api/ping') return J(200, { ok: true, app: 'hitmeup', handle: agent.profile()?.handle || null, ts: Date.now() });
      if (p === '/api/profile') { const pr = agent.profile(); return pr ? J(200, { ok: true, profile: publicProfile(pr), timezone: agent.tz() }) : J(503, { ok: false, error: '尚无资料' }); }
      if (p === '/api/slots') {
        const dur = Number(u.searchParams.get('duration')) || undefined;
        const n = Math.min(Number(u.searchParams.get('n')) || 12, 30);
        return J(200, { ok: true, timezone: agent.tz(), durationMin: dur || agent.config().availability.defaultDurationMin, slots: await agent.freeSlots(dur, n) });
      }
      if (p === '/llms.txt') return send(res, 200, llmsTxt(base, agent.profile()));
      if (p === '/.well-known/agent-card.json' || p === '/.well-known/agent.json') return J(200, agentCard(agent, base));
      let m = p.match(/^\/api\/requests\/([0-9a-f]+)$/);
      if (m) {
        const v = agent.publicStatus(m[1], u.searchParams.get('t') || '');
        return v ? J(200, { ok: true, request: v }) : J(404, { ok: false, error: '找不到该请求' });
      }
      m = p.match(/^\/r\/([0-9a-f]+)(\.ics)?$/);
      if (m) {
        if (m[2]) {
          const r = agent.getRequest(m[1]);
          if (!r || r.direction !== 'in' || r.token !== u.searchParams.get('t') || r.status !== 'accepted') return send(res, 404, '404');
          return send(res, 200, agent.icsFor(r), { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'attachment; filename="hitmeup-meetup.ics"' });
        }
        return sendHtml(res, renderStatusPage(m[1], agent.profile()));
      }
      return send(res, 404, '404');
    }

    if (req.method === 'POST') {
      if (p === '/a2a') {
        const body = await readJson(req).catch((e) => e);
        if (body instanceof Error) return J(200, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
        const t = body?.params?.message?.parts?.find?.((x) => x.kind === 'data')?.data?.type;
        if (body?.method === 'message/send' && t && t !== 'get-profile' && t !== 'confirm-counter' && !guard(req, res)) return;
        return J(200, await handleRpc(agent, body));
      }
      if (p === '/api/hi' || p === '/api/meetup') {
        if (!guard(req, res)) return;
        const b = await readJson(req);
        if (b.website) return J(200, { ok: true }); // 蜜罐：机器人填了隐藏字段，假装成功
        if (p === '/api/hi') {
          agent.addHi({ name: b.name, intro: b.intro, contact: b.contact, message: b.message, source: 'web' });
          return J(200, { ok: true, message: '招呼已送达！' });
        }
        const r = await agent.createInbound({
          from: { name: b.name, intro: b.intro, contact: b.contact },
          meeting: { title: b.title, durationMin: b.durationMin, meetupType: b.meetupType, place: b.place, note: b.note },
          slots: b.slot ? [b.slot] : b.slots, source: 'web',
        });
        return J(200, { ok: true, id: r.id, token: r.token, url: `/r/${r.id}?t=${r.token}` });
      }
      const m = p.match(/^\/api\/requests\/([0-9a-f]+)\/confirm$/);
      if (m) {
        await agent.confirmCounter(m[1], u.searchParams.get('t') || '');
        return J(200, { ok: true, request: agent.publicStatus(m[1], u.searchParams.get('t')) });
      }
      return J(404, { ok: false, error: 'not found' });
    }
    return send(res, 405, 'Method Not Allowed');
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((e) => { if (!res.headersSent) sendError(res, e instanceof HmuError ? e : e); else res.end(); });
  });
  server.requestTimeout = 30000;
  return server;
}
