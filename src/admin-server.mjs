// 管理服务器：仅监听 127.0.0.1，永不经隧道暴露。仅主人使用。
import http from 'node:http';
import { readJson, send, sendHtml, sendError } from './http.mjs';
import { renderAdmin } from './admin-page.mjs';
import { HmuError } from './errors.mjs';
import { notify } from './notify.mjs';
import { googleAddLink } from './calendar/links.mjs';

export function createAdminServer(agent, { port, log = console.log } = {}) {
  const hostOk = (req) => {
    const h = String(req.headers.host || '');
    return h === `127.0.0.1:${port}` || h === `localhost:${port}` || h === `[::1]:${port}`;
  };

  async function state() {
    const cfg = agent.config();
    const { secret, ...safe } = cfg; // eslint-disable-line no-unused-vars
    const reqs = agent.requests().slice().reverse().map((r) => ({
      ...r, slotLabels: (r.slots || []).map(agent.label), label: r.slot ? agent.label(r.slot) : '',
      counterLabel: r.counterSlot ? agent.label(r.counterSlot) : '',
      addLinks: r.slot ? { google: googleAddLink(agent.eventFor(r, r.slot)), icsUrl: `/api/requests/${r.id}.ics` } : undefined,
    }));
    return {
      profile: agent.profile(), config: safe, requests: reqs, inbox: agent.inbox().slice().reverse(),
      publicUrl: agent.runtime.publicUrl, shareLink: agent.runtime.shareLink || null, online: !!agent.runtime.publicUrl,
      localPublicUrl: agent.runtime.localPublicUrl, calendarError: agent.runtime.lastCalendarError, directory: agent.directory, tz: agent.tz(),
    };
  }

  async function handle(req, res) {
    if (!hostOk(req)) return send(res, 403, 'forbidden host');
    const u = new URL(req.url, 'http://x');
    const p = u.pathname;
    if (req.method === 'GET' && p === '/') return sendHtml(res, renderAdmin());
    if (req.method !== 'GET' && (req.headers['x-hitmeup-admin'] !== '1' || (req.headers.origin && !hostOk({ headers: { host: new URL(req.headers.origin).host } })))) {
      return send(res, 403, { ok: false, error: '缺少管理头或来源不合法' });
    }
    const J = (b) => send(res, 200, b);
    if (req.method === 'GET') {
      if (p === '/api/state') return J({ ok: true, ...(await state()) });
      if (p === '/api/slots') return J({ ok: true, slots: await agent.freeSlots(Number(u.searchParams.get('duration')) || undefined, Number(u.searchParams.get('n')) || 12) });
      let m = p.match(/^\/api\/requests\/([0-9a-f]+)\/slots$/);
      if (m) { const r = agent.getRequest(m[1]); if (!r) throw new HmuError('not_found', '找不到'); return J({ ok: true, slots: await agent.freeSlots(r.meeting.durationMin, 12) }); }
      m = p.match(/^\/api\/requests\/([0-9a-f]+)\.ics$/);
      if (m) {
        const r = agent.getRequest(m[1]);
        if (!r || !r.slot) return send(res, 404, '404');
        return send(res, 200, agent.icsFor(r), { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'attachment; filename="hitmeup-meetup.ics"' });
      }
      if (p === '/api/calendar-check') {
        try { return J({ ok: true, message: await agent.calendar().check() }); } catch (e) { return J({ ok: false, error: e.message }); }
      }
      return send(res, 404, { ok: false, error: 'not found' });
    }
    const body = await readJson(req);
    let m;
    if (p === '/api/outbound') return J({ ok: true, ...(await agent.outbound(body)) });
    if (p === '/api/outbound/poll') return J({ ok: true, changed: await agent.pollOutbound() });
    if ((m = p.match(/^\/api\/outbound\/([0-9a-f]+)\/confirm$/))) return J({ ok: true, request: await agent.confirmOutboundCounter(m[1]) });
    if ((m = p.match(/^\/api\/requests\/([0-9a-f]+)\/accept$/))) return J({ ok: true, request: await agent.approve(m[1], body) });
    if ((m = p.match(/^\/api\/requests\/([0-9a-f]+)\/counter$/))) return J({ ok: true, request: await agent.counter(m[1], body.slot, body) });
    if ((m = p.match(/^\/api\/requests\/([0-9a-f]+)\/decline$/))) return J({ ok: true, request: await agent.decline(m[1]) });
    if (p === '/api/profile' && (req.method === 'PUT' || req.method === 'POST')) return J({ ok: true, profile: agent.saveProfile({ ...agent.profile(), ...body }) });
    if (p === '/api/config' && (req.method === 'PUT' || req.method === 'POST')) {
      const cfg = agent.config();
      for (const k of ['timezone', 'availability', 'calendar', 'notify']) if (body[k] !== undefined) cfg[k] = body[k];
      agent.saveConfig(cfg);
      return J({ ok: true });
    }
    if (p === '/api/notify-test') return J({ ok: true, results: await notify(agent.config(), '约我 Hit Me Up 测试通知', '收到这条说明通知配置成功 ✅', { log }) });
    return send(res, 404, { ok: false, error: 'not found' });
  }

  return http.createServer((req, res) => { handle(req, res).catch((e) => sendError(res, e)); });
}
