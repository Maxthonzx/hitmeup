import fs from 'node:fs';
import { dataPaths, loadProfile, loadConfig, validateProfile } from './data.mjs';
import { createCalendar } from './calendar/index.mjs';
import { findCloudflared, cloudflaredVersion, INSTALL_HINT } from './tunnel.mjs';
import { directoryEnabled } from './directory.mjs';

export async function runDoctor(o) {
  let bad = 0;
  const ok = (m) => console.log(`✅ ${m}`);
  const no = (m, fix) => { bad++; console.log(`❌ ${m}${fix ? `\n   → ${fix}` : ''}`); };
  const major = Number(process.versions.node.split('.')[0]);
  major >= 20 ? ok(`Node ${process.versions.node}`) : no(`Node ${process.versions.node} 太旧`, '安装 Node 20+（https://nodejs.org 或 brew install node）');
  const p = dataPaths(o.dataDir);
  console.log(`数据目录：${o.dataDir}`);
  const prof = fs.existsSync(p.profile) ? loadProfile(o.dataDir) : null;
  if (!prof) no('没有 profile.json', '运行 npm run setup（或 node src/cli.mjs init --handle x --nickname y）');
  else { const errs = validateProfile(prof); errs.length ? no(`资料有问题：${errs.join('；')}`, '修改 profile.json') : ok(`资料：${prof.nickname}（${prof.handle}）`); }
  const cfg = loadConfig(o.dataDir);
  ok(`时区 ${cfg.timezone}；每周可约 ${Object.values(cfg.availability.weekly).filter((x) => x.length).length} 天`);
  try {
    const cal = createCalendar(cfg.calendar);
    ok(`日历（${cfg.calendar.type}）：${await cal.check()}`);
  } catch (e) { no(`日历（${cfg.calendar?.type}）不可用：${e.message}`, '检查链接/密码，或把 calendar.type 改成 none'); }
  const bin = findCloudflared();
  bin ? ok(`cloudflared：${cloudflaredVersion(bin) || bin}`) : no('未找到 cloudflared', INSTALL_HINT.split('\n').slice(1, 3).join('；').trim());
  if (directoryEnabled(o.directory)) {
    try { const r = await fetch(o.directory, { signal: AbortSignal.timeout(8000) }); r.ok ? ok(`目录服务可访问：${o.directory}`) : no(`目录服务 HTTP ${r.status}`); }
    catch (e) { no(`目录服务不可达：${e.message}`, '检查网络；没有目录也能用，把链接直接发给对方'); }
  }
  if (cfg.notify?.bark?.key || cfg.notify?.webhook?.url) ok('已配置通知'); else console.log('ℹ️  未配置通知（Bark/Webhook，可选）：新请求只会显示在后台和终端');
  console.log(bad ? `\n有 ${bad} 项需要处理。` : '\n一切就绪，运行 npm start 吧！');
  process.exitCode = bad ? 1 : 0;
}
