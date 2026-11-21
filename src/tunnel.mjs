// Cloudflare quick tunnel：spawn cloudflared，解析 trycloudflare.com 地址，掉线自动重启。
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const IS_WIN = process.platform === 'win32';
export const URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

export function findCloudflared() {
  const names = IS_WIN ? ['cloudflared.exe'] : ['cloudflared'];
  for (const dir of (process.env.PATH || process.env.Path || '').split(path.delimiter)) {
    for (const n of names) { const f = path.join(dir, n); if (dir && fs.existsSync(f)) return f; }
  }
  const extra = IS_WIN
    ? ['C:\\Program Files (x86)\\cloudflared\\cloudflared.exe', 'C:\\Program Files\\cloudflared\\cloudflared.exe']
    : ['/opt/homebrew/bin/cloudflared', '/usr/local/bin/cloudflared', '/usr/bin/cloudflared'];
  return extra.find((f) => fs.existsSync(f)) || null;
}

export const INSTALL_HINT = `未找到 cloudflared（用来生成公网链接）。安装方法：
  macOS:   brew install cloudflared
  Windows: winget install Cloudflare.cloudflared
  Linux:   https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
装好后重新运行 npm start。现在会先只在本机运行（别人暂时访问不到你的链接）。`;

export function cloudflaredVersion(bin) {
  try { return spawnSync(bin, ['--version'], { encoding: 'utf8', timeout: 8000 }).stdout.trim(); } catch { return null; }
}

export function startTunnel({ bin, port, onUrl, log = console.log }) {
  let child = null, stopped = false, delay = 3000;
  function launch() {
    if (stopped) return;
    child = spawn(bin, ['tunnel', '--url', `http://127.0.0.1:${port}`, '--no-autoupdate'], { windowsHide: true });
    const onData = (d) => {
      const m = String(d).match(URL_RE);
      if (m) { delay = 3000; onUrl(m[0]); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', (e) => log(`[隧道] 启动失败: ${e.message}`));
    child.on('exit', (code) => {
      onUrl(null);
      if (stopped) return;
      log(`[隧道] cloudflared 退出（${code}），${Math.round(delay / 1000)} 秒后重启`);
      setTimeout(launch, delay);
      delay = Math.min(delay * 2, 60000);
    });
  }
  launch();
  return { stop() { stopped = true; try { child?.kill(); } catch { /* ignore */ } } };
}
