#!/usr/bin/env node
// npm start：公开服务器 + 管理服务器 + 隧道 + 目录登记 + 出站轮询
import fs from 'node:fs';
import { parseArgs, runtimeOpts } from './opts.mjs';
import { createAgent } from './agent.mjs';
import { createPublicServer } from './public-server.mjs';
import { createAdminServer } from './admin-server.mjs';
import { findCloudflared, startTunnel, INSTALL_HINT } from './tunnel.mjs';
import { createRegistrar, directoryEnabled } from './directory.mjs';
import { loadConfig } from './data.mjs';

export async function startHitMeUp(argv = process.argv.slice(2), { log = console.log } = {}) {
  const { flags } = parseArgs(argv);
  const o = runtimeOpts(flags);
  fs.mkdirSync(o.dataDir, { recursive: true });
  const agent = createAgent({ dataDir: o.dataDir, directory: o.directory, log });
  if (o.publicUrl) agent.runtime.publicUrl = o.publicUrl.replace(/\/$/, '');
  if (!agent.profile()) {
    log(`还没有创建资料（数据目录：${o.dataDir}）。请先运行：npm run setup\n（AI 助手可运行 node src/cli.mjs init --handle <id> --nickname <名字> 或直接写 profile.json）`);
    process.exitCode = 1;
    return null;
  }
  loadConfig(o.dataDir); // 确保 config.json（含 secret）存在

  const pub = createPublicServer(agent, { log });
  const adm = createAdminServer(agent, { port: o.adminPort, log });
  const listen = (srv, port, name) => new Promise((resolve, reject) => {
    srv.once('error', (e) => reject(new Error(e.code === 'EADDRINUSE' ? `${name}端口 ${port} 已被占用（是不是已经启动过一个 Hit Me Up？可用 --${name === '公开' ? 'public' : 'admin'}-port 换端口）` : e.message)));
    srv.listen(port, '127.0.0.1', resolve);
  });
  await listen(pub, o.publicPort, '公开');
  await listen(adm, o.adminPort, '管理');
  agent.runtime.localPublicUrl = `http://127.0.0.1:${o.publicPort}`;
  const adminUrl = `http://127.0.0.1:${o.adminPort}`;

  const registrar = createRegistrar({ agent, log });
  const showLinks = () => {
    const p = agent.profile();
    const share = agent.runtime.shareLink || agent.runtime.publicUrl || agent.runtime.localPublicUrl;
    log(`\n🤝 约我 Hit Me Up 已就绪：${p.nickname}（${p.handle}）\n   分享链接：${share}\n   后台（仅本机）：${adminUrl}\n`);
  };

  let tunnel = null;
  if (o.publicUrl) {
    log(`使用自定义公网地址：${o.publicUrl}`);
    await registrar.sync();
    showLinks();
  } else if (o.noTunnel) {
    log('已用 --no-tunnel：仅本机运行，不创建公网链接、不登记目录。');
    showLinks();
  } else {
    const bin = findCloudflared();
    if (!bin) { log(INSTALL_HINT); showLinks(); } else {
      log(`正在创建公网隧道（${bin}）…`);
      let first = true;
      tunnel = startTunnel({
        bin, port: o.publicPort, log,
        onUrl: async (url) => {
          agent.runtime.publicUrl = url;
          if (!url) return;
          log(`[隧道] 公网地址：${url}`);
          await registrar.sync(true);
          if (first) { first = false; showLinks(); }
        },
      });
    }
  }

  const timers = [
    setInterval(() => agent.pollOutbound().catch(() => {}), Number(process.env.HITMEUP_POLL_MS) || 60000),
    setInterval(() => registrar.sync().catch(() => {}), 30 * 60 * 1000), // 仅检查；真正登记最多 12h 一次
  ];
  const stop = async () => {
    timers.forEach(clearInterval); tunnel?.stop();
    await Promise.all([new Promise((r) => pub.close(r)), new Promise((r) => adm.close(r))]);
    pub.closeAllConnections?.(); adm.closeAllConnections?.();
  };
  return { agent, stop, adminUrl, publicUrl: agent.runtime.localPublicUrl };
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('main.mjs')) {
  startHitMeUp().then((d) => {
    if (!d) return;
    const bye = () => d.stop().finally(() => process.exit(0));
    process.on('SIGINT', bye); process.on('SIGTERM', bye);
  }).catch((e) => { console.error('启动失败：', e.message); process.exit(1); });
}
export { directoryEnabled };
