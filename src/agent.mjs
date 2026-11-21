// Hit Me Up 核心：状态、可约时间、请求生命周期（入站/出站）。服务器层只做 HTTP 适配。
import { createCalendar } from './calendar/index.mjs';
import { googleAddLink, buildICS } from './calendar/links.mjs';
import {
  dataPaths, readJson, writeJson, loadConfig, saveConfig, loadProfile, saveProfile, publicProfile, sharedContacts,
  clean, rid, normalizeProfile, validateProfile,
} from './data.mjs';
import { generateSlots, pickBest, intersectSlots, stripSlot } from './slots.mjs';
import { toISO, fmtSlot, parseTime, DAY } from './tz.mjs';
import { notify } from './notify.mjs';
import { fetchAgentCard, makeMessage, getData, rpcCall, taskArtifactData } from './a2a.mjs';
import { resolveHandle } from './directory.mjs';
import { HmuError } from './errors.mjs';
export { HmuError };


const MAX_PENDING = 50;
const MAX_REQUESTS = 500;
const MAX_INBOX = 300;

export function createAgent({ dataDir, directory = 'https://hitmeup-agent.pages.dev', log = console.log, nowFn = Date.now, calendarOverride = null, fetchImpl = fetch } = {}) {
  const paths = dataPaths(dataDir);
  const runtime = { publicUrl: process.env.HITMEUP_PUBLIC_URL || null, online: false, lastCalendarError: null };
  let calCache = { key: '', cal: null };

  const config = () => loadConfig(dataDir);
  const profile = () => loadProfile(dataDir);
  const requireProfile = () => { const p = profile(); if (!p) throw new HmuError('no_profile', '尚未创建资料，请先运行 npm run setup'); return p; };
  const calendar = () => {
    if (calendarOverride) return calendarOverride;
    const c = config().calendar || { type: 'none' };
    const key = JSON.stringify(c);
    if (calCache.key !== key) calCache = { key, cal: createCalendar(c) };
    return calCache.cal;
  };
  const requests = () => readJson(paths.requests, []);
  const saveRequests = (list) => writeJson(paths.requests, list.slice(-MAX_REQUESTS));
  const inbox = () => readJson(paths.inbox, []);
  const tz = () => config().timezone;

  function updateRequest(id, patch) {
    const list = requests();
    const r = list.find((x) => x.id === id);
    if (!r) throw new HmuError('not_found', '找不到该请求');
    Object.assign(r, patch, { updatedAt: new Date(nowFn()).toISOString() });
    saveRequests(list);
    return r;
  }
  const getRequest = (id) => requests().find((x) => x.id === id) || null;
  const label = (slot) => fmtSlot(slot, tz());
  const notifyOwner = (title, body) => notify(config(), title, body, { log, fetchImpl }).catch(() => {});

  // ---------- 可约时间 ----------
  const confirmedMeetups = (excludeId) => requests().filter((r) => r.status === 'accepted' && r.slot && r.id !== excludeId).map((r) => r.slot);

  async function busyIntervals(fromMs, toMs) {
    let busy = [];
    try { busy = await calendar().listBusy(new Date(fromMs).toISOString(), new Date(toMs).toISOString()); runtime.lastCalendarError = null; }
    catch (e) { runtime.lastCalendarError = e.message; log(`[日历] 读取忙闲失败，退化为仅按可约时间: ${e.message}`); }
    return [...busy, ...confirmedMeetups()];
  }

  /** 全部候选（按时间升序，含 startMs/endMs/day） */
  async function candidateSlots(durationMin) {
    const cfg = config();
    const a = cfg.availability;
    const dur = Math.min(Math.max(Number(durationMin) || a.defaultDurationMin || 60, 15), 480);
    const now = nowFn();
    const busy = await busyIntervals(now, now + (a.horizonDays + 2) * DAY);
    return generateSlots({ availability: a, busy, meetups: confirmedMeetups(), durationMin: dur, tz: cfg.timezone, nowMs: now });
  }
  async function freeSlots(durationMin, n = 12) {
    return pickBest(await candidateSlots(durationMin), n).map((s) => ({ ...stripSlot(s), label: label(s) }));
  }

  // ---------- 入站请求 ----------
  function checkPendingCap() {
    if (requests().filter((r) => r.direction === 'in' && r.status === 'pending').length >= MAX_PENDING) {
      throw new HmuError('too_many_pending', 'TA 现在收到的请求太多了，请稍后再试');
    }
  }

  function addHi({ name, intro, contact, message, source = 'web', agentUrl }) {
    const n = clean(name, 40), m = clean(message, 500);
    if (!n) throw new HmuError('invalid', '请告诉 TA 你的称呼');
    if (!m && !clean(intro, 200)) throw new HmuError('invalid', '请写一句话再发送');
    const list = inbox();
    const item = { id: rid(8), at: new Date(nowFn()).toISOString(), name: n, intro: clean(intro, 200), contact: clean(contact, 100), message: m, source, agentUrl: clean(agentUrl, 200) };
    list.push(item);
    writeJson(paths.inbox, list.slice(-MAX_INBOX));
    notifyOwner('👋 有人跟你打招呼', `${n}：${m || item.intro}`);
    return item;
  }

  /** from:{name,intro,contact,handle?,agentUrl?} meeting:{title,durationMin,meetupType,place,note} slots:[{start,end}] */
  async function createInbound({ from, meeting, slots, source = 'web' }) {
    requireProfile();
    checkPendingCap();
    const f = {
      name: clean(from?.name, 40), intro: clean(from?.intro, 300), contact: clean(from?.contact, 100),
      handle: clean(from?.handle, 30), agentUrl: clean(from?.agentUrl, 200),
    };
    if (!f.name) throw new HmuError('invalid', '请填写你的称呼');
    if (!f.contact && !f.agentUrl) throw new HmuError('invalid', '请留下联系方式，对方同意后才能联系你');
    const durationMin = Math.min(Math.max(Number(meeting?.durationMin) || config().availability.defaultDurationMin || 60, 15), 480);
    const m = {
      title: clean(meeting?.title, 60) || '见个面', durationMin, meetupType: clean(meeting?.meetupType, 20),
      place: clean(meeting?.place, 80), note: clean(meeting?.note, 500),
    };
    const proposed = (Array.isArray(slots) ? slots : []).slice(0, 20).filter((s) => s && s.start && s.end);
    const cands = await candidateSlots(durationMin);
    const ok = intersectSlots(proposed, cands);
    if (!ok.length) {
      const hint = await freeSlots(durationMin, 8);
      throw new HmuError('no_overlap', proposed.length ? '你选的时间已经不可约了，换一个吧' : '请选择至少一个时间', { freeSlots: hint });
    }
    const req = {
      id: rid(12), token: rid(12), direction: 'in', status: 'pending', source,
      createdAt: new Date(nowFn()).toISOString(), from: f, meeting: m,
      slots: ok.slice(0, 5).map((s) => ({ start: s.start, end: s.end })),
    };
    const list = requests(); list.push(req); saveRequests(list);
    notifyOwner('☕ 新的见面请求', `${f.name} 想约你${m.meetupType ? m.meetupType : ''}：${label(req.slots[0])}${m.place ? ' @' + m.place : ''}`);
    return req;
  }

  function eventFor(req, slot) {
    const p = requireProfile();
    const who = req.direction === 'in' ? req.from.name : (req.peer?.name || '对方');
    const contact = req.direction === 'in' ? req.from.contact : '';
    const place = req.result?.place || req.meeting.place || '';
    return {
      start: slot.start, end: slot.end,
      summary: `${req.meeting.title || '见面'}｜${who} × ${p.nickname}`,
      description: [`约我 Hit Me Up 约的见面`, req.meeting.meetupType && `类型：${req.meeting.meetupType}`, contact && `对方联系方式：${contact}`, req.meeting.note && `备注：${req.meeting.note}`].filter(Boolean).join('\n'),
      location: place,
    };
  }

  /** 写日历（失败不阻断：退化为添加链接） */
  async function writeCalendar(req, slot) {
    const ev = eventFor(req, slot);
    let out;
    try { out = await calendar().createEvent(ev); } catch (e) {
      log(`[日历] 写入失败: ${e.message}`);
      out = { written: false, error: e.message, addLinks: { google: googleAddLink(ev) } };
    }
    return { written: !!out.written, calendarRef: out.ref || null, addLinks: out.addLinks || { google: googleAddLink(ev) }, calendarError: out.error || null };
  }

  function placeFor(req, override) {
    return clean(override, 80) || req.meeting.place || '';
  }

  async function approve(id, { slotIndex = 0, place } = {}) {
    const req = getRequest(id);
    if (!req || req.direction !== 'in') throw new HmuError('not_found', '找不到该请求');
    if (req.status !== 'pending') throw new HmuError('bad_state', `该请求已是「${req.status}」状态`);
    const slot = req.slots[slotIndex] || req.slots[0];
    const cands = await candidateSlots(req.meeting.durationMin);
    if (!intersectSlots([slot], cands).length) throw new HmuError('slot_taken', '这个时间已经不空了，请用「换个时间」', { freeSlots: await freeSlots(req.meeting.durationMin, 8) });
    const p = requireProfile();
    const withPlace = { ...req, result: { place: placeFor(req, place) } };
    const cal = await writeCalendar(withPlace, slot);
    return updateRequest(id, {
      status: 'accepted', slot: stripSlot(slot),
      result: { slot: stripSlot(slot), place: withPlace.result.place || '见面前再商量', contacts: sharedContacts(p) },
      ...cal,
    });
  }

  async function counter(id, slot, { place } = {}) {
    const req = getRequest(id);
    if (!req || req.direction !== 'in') throw new HmuError('not_found', '找不到该请求');
    if (req.status !== 'pending') throw new HmuError('bad_state', `该请求已是「${req.status}」状态`);
    const cands = await candidateSlots(req.meeting.durationMin);
    if (!intersectSlots([slot], cands).length) throw new HmuError('slot_taken', '这个时间不可约', { freeSlots: await freeSlots(req.meeting.durationMin, 8) });
    const r = updateRequest(id, { status: 'counter', counterSlot: stripSlot(slot), counterPlace: clean(place, 80) });
    notifyOwner('已发出新的时间建议', `${req.from.name}：${label(slot)}，等对方确认`);
    return r;
  }

  async function decline(id) {
    const req = getRequest(id);
    if (!req || req.direction !== 'in') throw new HmuError('not_found', '找不到该请求');
    if (!['pending', 'counter'].includes(req.status)) throw new HmuError('bad_state', `该请求已是「${req.status}」状态`);
    return updateRequest(id, { status: 'declined' });
  }

  /** 请求方确认 counter（凭 token） */
  async function confirmCounter(id, token) {
    const req = getRequest(id);
    if (!req || req.direction !== 'in' || req.token !== token) throw new HmuError('not_found', '找不到该请求');
    if (req.status !== 'counter') throw new HmuError('bad_state', '当前没有待确认的新时间');
    const cands = await candidateSlots(req.meeting.durationMin);
    if (!intersectSlots([req.counterSlot], cands).length) { updateRequest(id, { status: 'declined' }); throw new HmuError('slot_taken', '这个时间已经被占用了'); }
    const p = requireProfile();
    const withPlace = { ...req, result: { place: placeFor(req, req.counterPlace) } };
    const cal = await writeCalendar(withPlace, req.counterSlot);
    const r = updateRequest(id, {
      status: 'accepted', slot: req.counterSlot,
      result: { slot: req.counterSlot, place: withPlace.result.place || '见面前再商量', contacts: sharedContacts(p) }, ...cal,
    });
    notifyOwner('✅ 对方确认了新时间', `${req.from.name}：${label(r.slot)}`);
    return r;
  }

  /** 给访客的状态视图（凭 token；不含 owner 私有信息，接受后才含联系方式） */
  function publicStatus(id, token) {
    const req = getRequest(id);
    if (!req || req.direction !== 'in' || req.token !== token) return null;
    const p = profile();
    const v = {
      id: req.id, status: req.status, createdAt: req.createdAt, owner: p ? { nickname: p.nickname, avatar: p.avatar } : null,
      meeting: req.meeting, requestedSlots: req.slots, requestedLabels: req.slots.map(label), timezone: tz(),
    };
    if (req.status === 'counter') { v.counterSlot = req.counterSlot; v.counterLabel = label(req.counterSlot); v.counterPlace = req.counterPlace || ''; }
    if (req.status === 'accepted') {
      v.slot = req.slot; v.slotLabel = label(req.slot); v.place = req.result.place; v.contacts = req.result.contacts;
      v.addLinks = { google: googleAddLink(eventFor(req, req.slot)), icsUrl: `/r/${req.id}.ics?t=${req.token}` };
    }
    return v;
  }

  function icsFor(req) {
    return buildICS({ uid: req.id, ...eventFor(req, req.slot) });
  }

  // ---------- 出站 ----------
  async function resolveTarget(target) {
    const t = clean(target, 300);
    if (!t) throw new HmuError('invalid', '请填写对方的 handle 或链接');
    let handle = null, base = null;
    if (/^https?:\/\//i.test(t)) {
      const u = new URL(t);
      const m = u.pathname.match(/^\/u\/([a-z0-9-]+)/i);
      if (m && u.host === new URL(directory).host) handle = m[1].toLowerCase(); else base = u.origin;
    } else handle = t.replace(/^@/, '').toLowerCase();
    if (handle) {
      const r = await resolveHandle(directory, handle, { fetchImpl });
      if (!r.ok || !r.url) throw new HmuError('not_found', `目录里找不到 ${handle}`);
      if (r.online === false) throw new HmuError('offline', `${handle} 现在不在线（对方电脑没开或没联网）`);
      base = r.url.replace(/\/$/, '');
    }
    const card = await fetchAgentCard(`${base}/.well-known/agent-card.json`, fetchImpl);
    return { handle, base, card, a2aUrl: card.url };
  }

  const myIdentity = () => {
    const p = requireProfile();
    const contacts = Object.entries(sharedContacts(p)).map(([k, v]) => `${k}:${v}`).join(' / ');
    return { name: p.nickname, intro: clean(p.tagline || p.bio, 200), contact: contacts, handle: p.handle, agentUrl: runtime.publicUrl ? `${runtime.publicUrl}/a2a` : '' };
  };

  async function sendMeetup(a2aUrl, { meeting, slots }) {
    return rpcCall(a2aUrl, 'message/send', {
      message: makeMessage({ role: 'user', data: { type: 'request-meetup', from: myIdentity(), meeting, slots: slots.map(stripSlot) }, text: `${myIdentity().name} 想约你${meeting.meetupType || '见面'}` }),
    }, fetchImpl);
  }

  /** 发起约见。返回 {request, profile, task} */
  async function outbound({ target, title, durationMin, meetupType, place, note }) {
    const dur = Math.min(Math.max(Number(durationMin) || config().availability.defaultDurationMin || 60, 15), 480);
    const { handle, card, a2aUrl, base } = await resolveTarget(target);
    const pr = await rpcCall(a2aUrl, 'message/send', { message: makeMessage({ role: 'user', data: { type: 'get-profile' } }) }, fetchImpl);
    const peerProfile = taskArtifactData(pr)?.profile || null;
    const cands = await candidateSlots(dur);
    if (!cands.length) throw new HmuError('no_slots', '你自己近期没有可约时间，先检查可约时间设置');
    const meeting = { title: clean(title, 60) || '见个面', durationMin: dur, meetupType: clean(meetupType, 20), place: clean(place, 80), note: clean(note, 500) };
    let sent = pickBest(cands, 10);
    let task = await sendMeetup(a2aUrl, { meeting, slots: sent });
    // 对方没有重叠时，用其推荐的空闲时间与我的空闲求交后重试一次
    if (task.status?.state === 'rejected') {
      const hint = taskArtifactData(task)?.freeSlots || [];
      const mine = intersectSlots(hint, cands);
      if (mine.length) { sent = mine.slice(0, 5); task = await sendMeetup(a2aUrl, { meeting, slots: sent }); }
    }
    const req = {
      id: rid(12), direction: 'out', status: task.status?.state === 'rejected' ? 'declined' : 'pending',
      createdAt: new Date(nowFn()).toISOString(), meeting, slots: sent.map(stripSlot),
      peer: { handle, base, a2aUrl, taskId: task.id, name: card.name, profile: peerProfile },
      from: { name: peerProfile?.nickname || card.name, intro: '', contact: '' }, polls: 0,
      note: task.status?.state === 'rejected' ? '对方近期没有和你重叠的空闲时间' : '',
    };
    const list = requests(); list.push(req); saveRequests(list);
    return { request: req, profile: peerProfile, task };
  }

  async function applyOutboundTask(req, task) {
    const state = task.status?.state;
    const art = taskArtifactData(task);
    if (state === 'completed' && art?.slot) {
      const slot = stripSlot(art.slot);
      const withRes = { ...req, result: { place: art.place || req.meeting.place || '' } };
      const cal = await writeCalendar(withRes, slot);
      const r = updateRequest(req.id, { status: 'accepted', slot, result: { slot, place: art.place || '', contacts: art.contacts || {} }, ...cal });
      await notifyOwner('✅ 对方接受了你的邀约', `${r.peer.name}：${label(slot)}${art.place ? ' @' + art.place : ''}${Object.keys(art.contacts || {}).length ? '\n' + Object.entries(art.contacts).map(([k, v]) => `${k}:${v}`).join(' ') : ''}`);
      return r;
    }
    if (state === 'rejected' || state === 'canceled' || state === 'failed') {
      const r = updateRequest(req.id, { status: 'declined' });
      await notifyOwner('对方婉拒了你的邀约', r.peer.name);
      return r;
    }
    if (state === 'input-required' && art?.counterSlot && req.status !== 'counter') {
      const r = updateRequest(req.id, { status: 'counter', counterSlot: stripSlot(art.counterSlot), counterPlace: art.counterPlace || '' });
      await notifyOwner('对方建议换个时间', `${r.peer.name}：${label(art.counterSlot)}（请在 Hit Me Up 后台确认）`);
      return r;
    }
    return req;
  }

  async function pollOutbound() {
    const open = requests().filter((r) => r.direction === 'out' && ['pending', 'counter'].includes(r.status) && r.peer?.taskId);
    let changed = 0;
    for (const req of open) {
      try {
        const task = await rpcCall(req.peer.a2aUrl, 'tasks/get', { id: req.peer.taskId }, fetchImpl);
        const before = req.status;
        const after = await applyOutboundTask(req, task);
        if (after.status !== before) changed++;
      } catch (e) {
        const n = (req.polls || 0) + 1;
        const expired = nowFn() - Date.parse(req.createdAt) > 7 * DAY;
        updateRequest(req.id, { polls: n, lastError: e.message, ...(expired ? { status: 'failed' } : {}) });
      }
    }
    return changed;
  }

  async function confirmOutboundCounter(id) {
    const req = getRequest(id);
    if (!req || req.direction !== 'out' || req.status !== 'counter') throw new HmuError('bad_state', '没有待确认的新时间');
    const task = await rpcCall(req.peer.a2aUrl, 'message/send', {
      message: makeMessage({ role: 'user', taskId: req.peer.taskId, data: { type: 'confirm-counter', taskId: req.peer.taskId } }),
    }, fetchImpl);
    return applyOutboundTask(req, task);
  }

  // ---------- 资料/配置 ----------
  function saveProfileFrom(raw) {
    const p = normalizeProfile(raw);
    const errs = validateProfile(p);
    if (errs.length) throw new HmuError('invalid', errs.join('；'));
    saveProfile(dataDir, p);
    return p;
  }

  return {
    dataDir, paths, runtime, directory,
    config, saveConfig: (c) => saveConfig(dataDir, c), profile, saveProfile: saveProfileFrom, publicProfile, requireProfile,
    calendar, tz, label, requests, inbox, getRequest,
    freeSlots, candidateSlots, addHi, createInbound, approve, counter, decline, confirmCounter, publicStatus, icsFor, eventFor,
    outbound, pollOutbound, confirmOutboundCounter, resolveTarget, notifyOwner, myIdentity, toISO, parseTime,
    publicUrlFor(req) {
      if (runtime.publicUrl) return runtime.publicUrl;
      const proto = req?.headers?.['x-forwarded-proto'] || 'http';
      return `${proto}://${req?.headers?.host || '127.0.0.1'}`;
    },
  };
}
