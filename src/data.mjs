// 数据目录、配置、资料的读写与清洗。
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { DEFAULT_AVAILABILITY } from './slots.mjs';
import { defaultTimezone, isValidTimezone } from './tz.mjs';

export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{2,29}$/;
export const PLACE_TYPES = ['cafe', 'restaurant', 'bar', 'park', 'gym', 'online', 'other'];
export const CONTACT_KEYS = ['wechat', 'phone', 'email', 'instagram', 'xiaohongshu', 'telegram', 'other'];
export const CONTACT_LABELS = { wechat: '微信', phone: '手机', email: '邮箱', instagram: 'Instagram', xiaohongshu: '小红书', telegram: 'Telegram', other: '其他' };
export const rid = (n = 16) => randomBytes(n).toString('hex');

export function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw new Error(`读取 ${file} 失败: ${e.message}`);
  }
}

export function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

/** 去控制字符、截断 */
export function clean(v, max = 200) {
  if (v === undefined || v === null) return '';
  // eslint-disable-next-line no-control-regex
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}
export const cleanList = (v, maxItems = 20, max = 40) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,，、\n]/) : [])
  .map((x) => clean(x, max)).filter(Boolean).slice(0, maxItems);

export function defaultConfig() {
  return {
    timezone: defaultTimezone(),
    availability: structuredClone(DEFAULT_AVAILABILITY),
    calendar: { type: 'none' },
    notify: {},
    secret: rid(32),
  };
}

export function dataPaths(dir) {
  return {
    dir,
    profile: path.join(dir, 'profile.json'),
    config: path.join(dir, 'config.json'),
    requests: path.join(dir, 'requests.json'),
    inbox: path.join(dir, 'inbox.json'),
  };
}

export function loadConfig(dir) {
  const p = dataPaths(dir);
  const raw = readJson(p.config, null);
  const base = defaultConfig();
  const cfg = {
    ...base, ...(raw || {}),
    availability: { ...base.availability, ...(raw?.availability || {}) },
    calendar: raw?.calendar || base.calendar,
    notify: raw?.notify || {},
  };
  if (!isValidTimezone(cfg.timezone)) cfg.timezone = base.timezone;
  if (!raw || !raw.secret) { cfg.secret = raw?.secret || base.secret; writeJson(p.config, cfg); }
  return cfg;
}
export const saveConfig = (dir, cfg) => writeJson(dataPaths(dir).config, cfg);

/** 规范化资料（用户输入 -> 存储格式） */
export function normalizeProfile(raw = {}) {
  const p = {};
  p.handle = clean(raw.handle, 30).toLowerCase();
  p.nickname = clean(raw.nickname, 30);
  p.avatar = clean(raw.avatar, 300) || '🙂';
  if (clean(raw.gender, 10)) p.gender = clean(raw.gender, 10);
  const age = Number(raw.age);
  if (Number.isFinite(age) && age >= 16 && age <= 120) p.age = Math.round(age);
  p.city = clean(raw.city, 40);
  p.tagline = clean(raw.tagline, 80);
  p.bio = clean(raw.bio, 600);
  p.hobbies = cleanList(raw.hobbies);
  p.recentInterests = cleanList(raw.recentInterests);
  p.lookingFor = clean(raw.lookingFor, 300);
  p.canOffer = clean(raw.canOffer, 300);
  p.favoritePlaces = (Array.isArray(raw.favoritePlaces) ? raw.favoritePlaces : []).slice(0, 12).map((x) => ({
    name: clean(x?.name, 40),
    type: PLACE_TYPES.includes(x?.type) ? x.type : 'other',
    area: clean(x?.area, 40),
    note: clean(x?.note, 100),
  })).filter((x) => x.name);
  p.meetupTypes = cleanList(raw.meetupTypes, 10, 20);
  if (!p.meetupTypes.length) p.meetupTypes = ['喝咖啡', '吃饭', '散步', '线上聊'];
  p.contacts = {};
  for (const k of CONTACT_KEYS) { const v = clean(raw.contacts?.[k], 100); if (v) p.contacts[k] = v; }
  p.contactsToShare = cleanList(raw.contactsToShare, 7, 20).filter((k) => CONTACT_KEYS.includes(k) && p.contacts[k]);
  if (!p.contactsToShare.length) p.contactsToShare = Object.keys(p.contacts).slice(0, 1);
  p.languages = cleanList(raw.languages, 6, 20);
  p.listed = raw.listed === true;
  return p;
}

export function validateProfile(p) {
  const errs = [];
  if (!HANDLE_RE.test(p.handle || '')) errs.push('handle 须为 3-30 位小写字母/数字/短横线，且以字母或数字开头');
  if (!p.nickname) errs.push('nickname 不能为空');
  return errs;
}

export function loadProfile(dir) {
  const raw = readJson(dataPaths(dir).profile, null);
  return raw ? normalizeProfile(raw) : null;
}
export const saveProfile = (dir, p) => writeJson(dataPaths(dir).profile, p);

/** 公开字段（绝不含 contacts） */
export function publicProfile(p) {
  const { contacts, contactsToShare, listed, ...pub } = p; // eslint-disable-line no-unused-vars
  return pub;
}

/** 接受后向对方展示的联系方式 */
export function sharedContacts(p) {
  const out = {};
  for (const k of p.contactsToShare || []) if (p.contacts?.[k]) out[CONTACT_LABELS[k] || k] = p.contacts[k];
  return out;
}
