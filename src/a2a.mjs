// A2A v0.3 最小实现：客户端工具 + 服务端 JSON-RPC 处理（message/send, tasks/get）。
import { randomUUID } from 'node:crypto';
import { HmuError } from './errors.mjs';
import { publicProfile } from './data.mjs';

export const PROTOCOL_VERSION = '0.3.0';

export function makeMessage({ role, contextId, taskId, data, text }) {
  const parts = [];
  if (data) parts.push({ kind: 'data', data });
  if (text) parts.push({ kind: 'text', text });
  const m = { kind: 'message', role, messageId: randomUUID(), contextId: contextId || randomUUID(), parts };
  if (taskId) m.taskId = taskId;
  return m;
}
export const getData = (message) => message?.parts?.find((p) => p.kind === 'data')?.data ?? null;

/** 合并 task 所有 artifact 的 data 部分 */
export function taskArtifactData(task) {
  const out = {};
  for (const a of task?.artifacts || []) for (const p of a.parts || []) if (p.kind === 'data') Object.assign(out, p.data);
  return Object.keys(out).length ? out : null;
}

export async function fetchAgentCard(url, fetchImpl = fetch) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new HmuError('peer_error', `获取对方 AgentCard 失败: HTTP ${res.status}`);
  const card = await res.json();
  if (!card.url || !card.name) throw new HmuError('peer_error', '对方 AgentCard 缺少 url/name');
  return card;
}

export async function rpcCall(url, method, params, fetchImpl = fetch) {
  const res = await fetchImpl(url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: randomUUID(), method, params }), signal: AbortSignal.timeout(20000),
  });
  let j;
  try { j = await res.json(); } catch { throw new HmuError('peer_error', `对方返回了无法解析的内容 (HTTP ${res.status})`); }
  if (j.error) throw new HmuError('peer_error', `对方返回错误: ${j.error.message}`, { rpc: j.error });
  return j.result;
}

// ---------------- 服务端 ----------------
const taskIdOf = (req) => `${req.id}_${req.token}`;
const textMsg = (text) => ({ kind: 'message', role: 'agent', messageId: randomUUID(), parts: [{ kind: 'text', text }] });
const artifact = (name, data, text) => ({ artifactId: randomUUID(), name, parts: [{ kind: 'data', data }, ...(text ? [{ kind: 'text', text }] : [])] });

function mkTask(id, state, text, artifacts) {
  const t = { kind: 'task', id, contextId: id, status: { state, timestamp: new Date().toISOString() } };
  if (text) t.status.message = textMsg(text);
  if (artifacts) t.artifacts = artifacts;
  return t;
}

export function taskFromRequest(agent, req) {
  const id = taskIdOf(req);
  const nick = agent.profile()?.nickname || 'TA';
  switch (req.status) {
    case 'accepted': return mkTask(id, 'completed', `${nick} 接受了！时间：${agent.label(req.slot)}${req.result.place ? '，地点：' + req.result.place : ''}`,
      [artifact('meetup', { slot: req.slot, place: req.result.place, contacts: req.result.contacts })]);
    case 'declined': return mkTask(id, 'rejected', `${nick} 这次先不约了，谢谢～`);
    case 'counter': return mkTask(id, 'input-required', `${nick} 建议改到 ${agent.label(req.counterSlot)}，请确认`,
      [artifact('counter', { counterSlot: req.counterSlot, counterPlace: req.counterPlace || '' })]);
    default: return mkTask(id, 'input-required', `已收到，正在等 ${nick} 确认`);
  }
}

export function agentCard(agent, baseUrl) {
  const p = agent.profile();
  const nick = p?.nickname || 'Hit Me Up';
  return {
    protocolVersion: PROTOCOL_VERSION, name: `${nick} 的 AI 分身 (Hit Me Up)`,
    description: `${nick}${p?.city ? '（' + p.city + '）' : ''}的个人 AI 分身：可以了解 TA、打招呼、约见面。${p?.tagline || ''}`.trim(),
    url: `${baseUrl}/a2a`, preferredTransport: 'JSONRPC', version: '0.1.0',
    provider: { organization: 'Hit Me Up', url: 'https://github.com/Maxthonzx/hitmeup' },
    capabilities: { streaming: false, pushNotifications: false, stateTransitionHistory: false },
    defaultInputModes: ['application/json', 'text/plain'], defaultOutputModes: ['application/json', 'text/plain'],
    skills: [
      { id: 'get-profile', name: '了解主人', description: 'DataPart {type:"get-profile"} → 公开资料（不含联系方式）', tags: ['profile'] },
      { id: 'say-hi', name: '打招呼', description: 'DataPart {type:"say-hi", from:{name,intro,contact?}, message}', tags: ['icebreaker'] },
      { id: 'request-meetup', name: '约见面', description: 'DataPart {type:"request-meetup", from, meeting:{title,durationMin,meetupType,place?,note?}, slots:[{start,end}]}；需主人确认，之后用 tasks/get 查询', tags: ['scheduling'] },
    ],
    documentationUrl: `${baseUrl}/llms.txt`,
  };
}

const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const err = (id, code, message, data) => ({ jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } });

/** 处理一个 JSON-RPC 请求体，返回响应对象 */
export async function handleRpc(agent, body) {
  const id = body?.id ?? null;
  if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string') return err(id, -32600, 'Invalid Request');
  try {
    if (body.method === 'tasks/get') {
      const [rid, token] = String(body.params?.id || '').split('_');
      const req = agent.getRequest(rid);
      if (!req || req.direction !== 'in' || req.token !== token) return err(id, -32001, 'Task not found');
      return ok(id, taskFromRequest(agent, req));
    }
    if (body.method !== 'message/send') return err(id, -32601, `Method not found: ${body.method}`);
    const msg = body.params?.message;
    const data = getData(msg);
    if (!data || typeof data.type !== 'string') return err(id, -32602, '需要一个带 type 的 DataPart（get-profile / say-hi / request-meetup）');
    const tid = randomUUID();
    switch (data.type) {
      case 'get-profile': {
        const p = agent.requireProfile();
        return ok(id, mkTask(tid, 'completed', `这是 ${p.nickname} 的公开资料`, [artifact('profile', { profile: publicProfile(p) })]));
      }
      case 'say-hi': {
        agent.addHi({ name: data.from?.name, intro: data.from?.intro, contact: data.from?.contact, message: data.message, source: 'a2a', agentUrl: data.from?.agentUrl });
        return ok(id, mkTask(tid, 'completed', '招呼已送达，TA 看到后可能会回你～'));
      }
      case 'request-meetup': {
        try {
          const req = await agent.createInbound({ from: data.from, meeting: data.meeting, slots: data.slots, source: 'a2a' });
          return ok(id, taskFromRequest(agent, req));
        } catch (e) {
          if (e.code === 'no_overlap') {
            return ok(id, mkTask(tid, 'rejected', '你提议的时间和 TA 的空闲时间没有重叠，下面是 TA 近期的空闲时间，请从中重新选择',
              [artifact('free-slots', { freeSlots: e.extra.freeSlots })]));
          }
          throw e;
        }
      }
      case 'confirm-counter': {
        const [rid, token] = String(data.taskId || '').split('_');
        await agent.confirmCounter(rid, token);
        return ok(id, taskFromRequest(agent, agent.getRequest(rid)));
      }
      default: return err(id, -32602, `未知的消息类型: ${data.type}`);
    }
  } catch (e) {
    if (e instanceof HmuError) return err(id, e.code === 'not_found' ? -32001 : -32000, e.message, { code: e.code });
    return err(id, -32603, 'Internal error');
  }
}
