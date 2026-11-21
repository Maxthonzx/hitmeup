// Smoke test for the directory service.
// Usage: node site/test/smoke.mjs http://127.0.0.1:8788
// Requires the server to run with DEV_ALLOW_HTTP=1 (local http targets).
import http from 'node:http';
import crypto from 'node:crypto';

const base = (process.argv[2] || 'http://127.0.0.1:8788').replace(/\/$/, '');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  ' + extra}`); };
const post = (path, body, raw) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ?? JSON.stringify(body) });

// tiny "owner" server
const PORT = 18799;
const owner = http.createServer((req, res) => {
  if (req.url === '/api/ping') { res.end('{"ok":true}'); return; }
  res.setHeader('content-type', 'text/plain'); res.end('hello from owner ' + req.url);
});
await new Promise((r) => owner.listen(PORT, '127.0.0.1', r));

const run = Date.now().toString(36);
const handle = 'smoke-' + run;
const offHandle = 'smoke-off-' + run;
const secret = crypto.randomBytes(24).toString('hex');
const secret2 = crypto.randomBytes(24).toString('hex');
const url = `http://127.0.0.1:${PORT}`;

try {
  // static pages
  for (const p of ['/', '/explore.html', '/favicon.svg', '/robots.txt']) {
    const r = await fetch(base + p); ok(`GET ${p} 200`, r.status === 200, r.status);
  }
  const home = await (await fetch(base + '/')).text();
  ok('index has install prompt + github link', home.includes('git clone https://github.com/Maxthonzx/dazi') && home.includes('id="prompt"'));

  // register
  let r = await post('/api/register', { handle, url, secret, listed: true, card: { nickname: 'Smoke', city: '深圳', tagline: 'hi', avatar: '🦊', tags: ['咖啡', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] } });
  let j = await r.json();
  ok('register ok', r.status === 200 && j.ok && j.link.endsWith('/u/' + handle), JSON.stringify(j));
  r = await post('/api/register', { handle, url, secret });
  ok('re-register same secret ok', r.status === 200);
  r = await post('/api/register', { handle, url, secret: secret2 });
  j = await r.json();
  ok('wrong secret -> 409 handle_taken', r.status === 409 && j.error === 'handle_taken', JSON.stringify(j));
  r = await post('/api/register', { handle: 'Bad Handle!', url, secret });
  ok('invalid handle -> 400', r.status === 400);
  r = await post('/api/register', { handle: 'admin', url, secret });
  ok('reserved handle -> 400', r.status === 400);
  r = await post('/api/register', { handle: 'ab', url, secret });
  ok('too-short handle -> 400', r.status === 400);
  r = await post('/api/register', { handle: 'x' + handle, url: 'ftp://x.com', secret });
  ok('bad url -> 400', r.status === 400);
  r = await post('/api/register', { handle: 'y' + handle, url, secret: 'zz' });
  ok('bad secret -> 400', r.status === 400);
  r = await post('/api/register', null, 'x'.repeat(5000));
  ok('oversize body -> 413', r.status === 413);
  r = await post('/api/register', null, '{nope');
  ok('bad json -> 400', r.status === 400);

  // resolve
  r = await fetch(base + '/api/resolve/' + handle); j = await r.json();
  ok('resolve online', r.status === 200 && j.ok && j.online === true && j.url === url, JSON.stringify(j));
  ok('resolve has CORS *', r.headers.get('access-control-allow-origin') === '*');
  r = await fetch(base + '/api/resolve/nobody-' + run);
  ok('resolve unknown -> 404', r.status === 404);

  // explore
  r = await fetch(base + '/api/explore?fresh=1'); j = await r.json();
  const me = j.items?.find((i) => i.handle === handle);
  ok('explore lists me', !!me && me.nickname === 'Smoke' && me.online === true, JSON.stringify(j).slice(0, 300));
  ok('explore tags capped at 8', me?.tags.length === 8);
  ok('explore never leaks secretHash', !JSON.stringify(j).includes('secretHash') && !JSON.stringify(j).includes('"url"'));

  // /u redirect
  r = await fetch(base + '/u/' + handle, { redirect: 'manual' });
  ok('/u/<handle> online -> 302 to tunnel', r.status === 302 && r.headers.get('location') === url + '/', r.status + ' ' + r.headers.get('location'));
  r = await fetch(base + '/u/' + handle + '/llms.txt?x=1', { redirect: 'manual' });
  ok('/u/<handle>/llms.txt passthrough', r.status === 302 && r.headers.get('location') === url + '/llms.txt?x=1', r.headers.get('location'));

  // offline target (nothing listens on port 1)
  r = await post('/api/register', { handle: offHandle, url: 'http://127.0.0.1:1', secret });
  ok('register offline target ok', r.status === 200);
  r = await fetch(base + '/api/resolve/' + offHandle); j = await r.json();
  ok('resolve offline -> online:false', j.ok && j.online === false);
  r = await fetch(base + '/u/' + offHandle, { redirect: 'manual' }); let t = await r.text();
  ok('/u offline -> HTML page "暂时不在线"', r.status === 503 && t.includes('暂时不在线') && (r.headers.get('content-type') || '').includes('text/html'), r.status);

  // unknown
  r = await fetch(base + '/u/nobody-' + run, { redirect: 'manual' }); t = await r.text();
  ok('/u unknown -> 404 page with CTA', r.status === 404 && t.includes('想要自己的搭子'), r.status);

  // unregister
  r = await post('/api/unregister', { handle, secret: secret2 });
  ok('unregister wrong secret -> 403', r.status === 403);
  r = await post('/api/unregister', { handle, secret }); j = await r.json();
  ok('unregister ok', r.status === 200 && j.ok);
  r = await fetch(base + '/api/resolve/' + handle);
  ok('resolve after unregister -> 404', r.status === 404);
  await post('/api/unregister', { handle: offHandle, secret });
} catch (e) {
  fail++; console.log('FAIL  exception', e);
} finally {
  owner.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
