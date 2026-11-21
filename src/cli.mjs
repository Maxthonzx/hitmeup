#!/usr/bin/env node
// Hit Me Up CLI：setup / init / doctor / meet / unpublish
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { parseArgs, runtimeOpts } from './opts.mjs';
import {
  dataPaths, loadConfig, saveConfig, loadProfile, saveProfile, normalizeProfile, validateProfile, readJson, HANDLE_RE, CONTACT_KEYS, CONTACT_LABELS,
} from './data.mjs';
import { defaultTimezone, isValidTimezone } from './tz.mjs';
import { runDoctor } from './doctor.mjs';
import { unregister, directoryEnabled } from './directory.mjs';

const cmd = process.argv[2];
const { flags, pos } = parseArgs(process.argv.slice(3));
const o = runtimeOpts(flags);

const arr = (v) => (v === undefined || v === true ? [] : [].concat(v));

/** 非交互 init：node src/cli.mjs init --handle x --nickname y [...] */
function init() {
  fs.mkdirSync(o.dataDir, { recursive: true });
  const p = dataPaths(o.dataDir);
  if (fs.existsSync(p.profile) && !flags.force) { console.error(`已存在 ${p.profile}（加 --force 覆盖）`); process.exit(1); }
  const contacts = {};
  for (const k of CONTACT_KEYS) if (typeof flags[k] === 'string') contacts[k] = flags[k];
  for (const kv of arr(flags.contact)) { const [k, ...v] = String(kv).split('='); if (CONTACT_KEYS.includes(k)) contacts[k] = v.join('='); }
  const prof = normalizeProfile({
    handle: flags.handle, nickname: flags.nickname, avatar: flags.avatar, gender: flags.gender, age: flags.age, city: flags.city, bio: flags.bio, tagline: flags.tagline,
    hobbies: flags.hobbies, recentInterests: flags['recent-interests'], lookingFor: flags['looking-for'], canOffer: flags['can-offer'],
    meetupTypes: flags['meetup-types'], languages: flags.languages, contacts, contactsToShare: flags.share, listed: flags.listed === true || flags.listed === 'true',
  });
  const errs = validateProfile(prof);
  if (errs.length) { console.error('参数有误：\n- ' + errs.join('\n- ')); process.exit(1); }
  saveProfile(o.dataDir, prof);
  const cfg = loadConfig(o.dataDir);
  if (typeof flags.timezone === 'string') { if (!isValidTimezone(flags.timezone)) { console.error('无效时区'); process.exit(1); } cfg.timezone = flags.timezone; }
  if (typeof flags['ics-url'] === 'string') cfg.calendar = { type: 'ics', url: flags['ics-url'] };
  if (flags['icloud-id'] && flags['icloud-password']) cfg.calendar = { type: 'icloud', appleId: flags['icloud-id'], appPassword: flags['icloud-password'] };
  if (flags.feishu) cfg.calendar = { type: 'feishu', ...(typeof flags['feishu-profile'] === 'string' ? { profile: flags['feishu-profile'] } : {}) };
  if (flags['bark-key']) cfg.notify = { ...cfg.notify, bark: { key: flags['bark-key'], server: 'https://api.day.app' } };
  if (flags['webhook-url']) cfg.notify = { ...cfg.notify, webhook: { url: flags['webhook-url'], kind: flags['webhook-kind'] === 'feishu' ? 'feishu' : 'generic' } };
  saveConfig(o.dataDir, cfg);
  console.log(`✅ 已写入 ${p.profile} 与 ${p.config}\n下一步：npm run doctor，然后 npm start`);
}

async function setup() {
  fs.mkdirSync(o.dataDir, { recursive: true });
  const p = dataPaths(o.dataDir);
  const old = loadProfile(o.dataDir) || {};
  const cfg = loadConfig(o.dataDir);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q, def = '') => { const a = (await rl.question(`${q}${def ? ` [${def}]` : ''}：`)).trim(); return a || def; };
  console.log('\n🤝 欢迎使用 约我 Hit Me Up！下面几个问题都可以直接回车跳过（除了 handle 和昵称）。\n');
  let handle = old.handle || '';
  for (;;) {
    handle = (await ask('起个链接里用的名字 handle（3-30 位小写字母/数字/-，如 lily-sh）', handle)).toLowerCase();
    if (HANDLE_RE.test(handle)) break;
    console.log('  ✗ 格式不对：只能小写字母、数字、短横线，3-30 位，且以字母或数字开头');
  }
  let nickname = '';
  while (!nickname) nickname = await ask('昵称', old.nickname || '');
  const avatar = await ask('头像（一个 emoji 或图片链接）', old.avatar || '🙂');
  const city = await ask('所在城市', old.city || '');
  const age = await ask('年龄（可选）', old.age ? String(old.age) : '');
  const tagline = await ask('一句话签名（例：周末找人一起 citywalk）', old.tagline || '');
  const bio = await ask('简短自我介绍（可选）', old.bio || '');
  const hobbies = await ask('爱好（逗号分隔，例：咖啡,羽毛球,看展）', (old.hobbies || []).join(','));
  const recent = await ask('最近在迷什么（逗号分隔）', (old.recentInterests || []).join(','));
  const lookingFor = await ask('想认识什么样的人', old.lookingFor || '');
  const canOffer = await ask('你能提供什么（例：带你逛小众咖啡馆）', old.canOffer || '');
  const placesIn = await ask('常去/喜欢约的地方（用 ; 分隔，格式 名称@区域，例：Manner@静安寺;滨江绿道@滨江）', (old.favoritePlaces || []).map((x) => `${x.name}${x.area ? '@' + x.area : ''}`).join(';'));
  const meetupTypes = await ask('愿意怎么见（逗号分隔）', (old.meetupTypes || ['喝咖啡', '吃饭', '散步', '线上聊']).join(','));
  console.log('\n联系方式只会在你同意见面之后给对方，不会公开。');
  const contacts = { ...(old.contacts || {}) };
  for (const k of ['wechat', 'phone', 'email', 'instagram', 'xiaohongshu', 'telegram']) {
    const v = await ask(`  ${CONTACT_LABELS[k]}`, contacts[k] || '');
    if (v) contacts[k] = v; else delete contacts[k];
  }
  const share = Object.keys(contacts).length ? await ask('同意后分享哪些（逗号分隔 key）', (old.contactsToShare || Object.keys(contacts).slice(0, 1)).join(',')) : '';
  const listed = (await ask('是否在目录页公开展示你（陌生人可发现）？y/n', old.listed ? 'y' : 'n')).toLowerCase().startsWith('y');
  const tz = await ask('时区（IANA）', cfg.timezone || defaultTimezone());
  if (isValidTimezone(tz)) cfg.timezone = tz; else console.log('  ✗ 时区无效，保留原值');
  console.log('\n日历：1) 不连接（只按每周可约时间）  2) Google/Outlook/iCloud 的 iCal 订阅链接（只读，最简单）  3) iCloud（读写，需要 App 专用密码）  4) 飞书（可选）');
  const calChoice = await ask('选择', cfg.calendar?.type === 'ics' ? '2' : cfg.calendar?.type === 'icloud' ? '3' : cfg.calendar?.type === 'feishu' ? '4' : '1');
  if (calChoice === '2') { const url = await ask('粘贴 iCal 链接（Google 日历设置里的“iCal 格式的私密地址”）', cfg.calendar?.url || ''); cfg.calendar = url ? { type: 'ics', url } : { type: 'none' }; }
  else if (calChoice === '3') {
    console.log('  到 appleid.apple.com → 登录与安全 → App 专用密码 生成一个。');
    const appleId = await ask('Apple ID', cfg.calendar?.appleId || ''); const appPassword = await ask('App 专用密码（xxxx-xxxx-xxxx-xxxx）', cfg.calendar?.appPassword || '');
    cfg.calendar = appleId && appPassword ? { type: 'icloud', appleId, appPassword } : { type: 'none' };
  } else if (calChoice === '4') { const fp = await ask('lark-cli profile（回车=默认）'); cfg.calendar = { type: 'feishu', ...(fp ? { profile: fp } : {}) }; }
  else cfg.calendar = { type: 'none' };
  const bark = await ask('Bark 推送 key（iPhone，可选；装 Bark App 后复制 key）', cfg.notify?.bark?.key || '');
  if (bark) cfg.notify = { ...cfg.notify, bark: { key: bark, server: cfg.notify?.bark?.server || 'https://api.day.app' } };
  const hook = await ask('通知 Webhook URL（飞书自定义机器人等，可选）', cfg.notify?.webhook?.url || '');
  if (hook) cfg.notify = { ...cfg.notify, webhook: { url: hook, kind: hook.includes('feishu') || hook.includes('larksuite') ? 'feishu' : 'generic' } };
  rl.close();

  const prof = normalizeProfile({
    handle, nickname, avatar, city, age, tagline, bio, hobbies, recentInterests: recent, lookingFor, canOffer, meetupTypes,
    favoritePlaces: placesIn.split(/[;；]/).map((s) => s.trim()).filter(Boolean).map((s) => { const [name, area] = s.split('@'); return { name, area: area || '', type: 'other' }; }),
    contacts, contactsToShare: share, listed, languages: old.languages, gender: old.gender,
  });
  saveProfile(o.dataDir, prof);
  saveConfig(o.dataDir, cfg);
  console.log(`\n✅ 已保存到 ${o.dataDir}\n\n下一步：\n  1. npm run doctor   检查环境\n  2. npm start        启动（会打印你的分享链接和后台地址）\n  可随时在后台（http://127.0.0.1:${o.adminPort}）修改资料。\n`);
}

async function meet() {
  const target = pos[0];
  if (!target) { console.error('用法：npm run meet -- <handle|链接> --title "喝咖啡" --duration 60 [--type 喝咖啡] [--place ..] [--note ..]'); process.exit(1); }
  const base = `http://127.0.0.1:${o.adminPort}`;
  let res;
  try {
    res = await fetch(`${base}/api/outbound`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-hitmeup-admin': '1' },
      body: JSON.stringify({ target, title: flags.title, durationMin: Number(flags.duration) || undefined, meetupType: flags.type || flags.title, place: flags.place, note: flags.note }),
    });
  } catch { console.error(`连不上本机的 Hit Me Up（${base}）。请先在另一个终端运行 npm start。`); process.exit(1); }
  const j = await res.json();
  if (!j.ok) { console.error(`❌ ${j.error}`); process.exit(1); }
  const pr = j.profile;
  if (pr) console.log(`👤 ${pr.nickname}${pr.city ? ' · ' + pr.city : ''}${pr.tagline ? ' — ' + pr.tagline : ''}\n   爱好：${(pr.hobbies || []).join('、') || '—'}`);
  console.log(`📨 已发出邀约，状态：${j.request.status}${j.request.note ? '（' + j.request.note + '）' : ''}。对方确认后会通知你，也可在后台查看：${base}`);
}

async function unpublish() {
  const cfg = readJson(dataPaths(o.dataDir).config, null);
  const p = loadProfile(o.dataDir);
  if (!cfg?.secret || !p) { console.error('找不到资料/配置，没有可撤销的登记'); process.exit(1); }
  if (!directoryEnabled(o.directory)) { console.log('目录服务已关闭，无需撤销'); return; }
  const ok = await unregister(o.directory, p.handle, cfg.secret).catch(() => false);
  console.log(ok ? `✅ 已从目录撤销 ${p.handle}` : '❌ 撤销失败（目录不可达，或 secret 不匹配）');
  if (!ok) process.exit(1);
}

const main = { init, setup, doctor: () => runDoctor(o), meet, unpublish }[cmd];
if (!main) { console.log('用法：node src/cli.mjs <setup|init|doctor|meet|unpublish> [--data 目录]'); process.exit(cmd ? 1 : 0); }
Promise.resolve(main()).catch((e) => { console.error('出错：', e.message); process.exit(1); });
