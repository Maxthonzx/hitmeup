// 命令行参数与环境变量
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** --k v / --k=v / --flag；重复的 key 变数组；其余为位置参数 */
export function parseArgs(argv) {
  const flags = {}, pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      let k = a.slice(2), v = true;
      const eq = k.indexOf('=');
      if (eq >= 0) { v = k.slice(eq + 1); k = k.slice(0, eq); }
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) v = argv[++i];
      if (k in flags) flags[k] = [].concat(flags[k], v); else flags[k] = v;
    } else pos.push(a);
  }
  return { flags, pos };
}

export function runtimeOpts(flags = {}, env = process.env) {
  const pick = (f, e, d) => (flags[f] !== undefined && flags[f] !== true ? flags[f] : env[e] !== undefined ? env[e] : d);
  return {
    dataDir: path.resolve(pick('data', 'HITMEUP_DATA_DIR', path.join(ROOT, 'data'))),
    publicPort: Number(pick('public-port', 'HITMEUP_PUBLIC_PORT', 7788)),
    adminPort: Number(pick('admin-port', 'HITMEUP_ADMIN_PORT', 7790)),
    publicUrl: pick('public-url', 'HITMEUP_PUBLIC_URL', '') || null,
    directory: pick('directory', 'HITMEUP_DIRECTORY', 'https://hitmeup-agent.pages.dev'),
    noTunnel: flags['no-tunnel'] === true || flags['no-tunnel'] === 'true' || env.HITMEUP_NO_TUNNEL === '1',
  };
}
