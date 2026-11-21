# 约我 Hit Me Up — 官网 + 目录服务

静态官网（`public/`）+ Cloudflare Pages Functions（`functions/`）+ KV（绑定名 `HMU_DIR`）。
部署目标：Pages 项目 `hitmeup-agent` -> https://hitmeup-agent.pages.dev

```
public/      静态页面（index.html、explore.html、assets/、_headers、robots.txt、favicon.svg）
functions/   Pages Functions：/api/register /api/unregister /api/resolve/<h> /api/explore /u/<h>[/...]
lib/util.js  Functions 共用工具（校验、哈希、在线探测、HTML 页面）
test/smoke.mjs  冒烟测试
wrangler.toml
```

## 部署

```bash
cd site
npx wrangler kv namespace create HMU_DIR      # 记下输出里的 id
# 把 wrangler.toml 里 [[kv_namespaces]] 的 id = "REPLACE_ME" 改成上面的 id
npx wrangler pages project create hitmeup-agent --production-branch main   # 首次
npx wrangler pages deploy                       # 读取 wrangler.toml（输出目录 public）
```

注意：不要设置 `DEV_ALLOW_HTTP`（仅本地测试用，生产环境只接受 https 目标地址）。

## 本地开发 / 测试

```bash
npx wrangler pages dev public --kv HMU_DIR --binding DEV_ALLOW_HTTP=1 --port 8788
node test/smoke.mjs http://127.0.0.1:8788
```

`DEV_ALLOW_HTTP=1` 时，`http://127.0.0.1` / `http://localhost` 才允许作为目标地址。

## API

所有响应均为 JSON（`/u/*` 除外），`/api/resolve` `/api/explore` 带 `Access-Control-Allow-Origin: *`。
KV 记录：`h:<handle>` -> `{url, secretHash, listed, card:{nickname,city,tagline,avatar,tags}, updatedAt}`，`secretHash = sha256(secret)`，密钥明文不落盘。

### POST /api/register
Body（<= 4KB）：`{handle, url, secret, listed?, card?}`
- `handle`：`^[a-z0-9][a-z0-9-]{2,29}$`，且不在保留词表（api, u, www, admin, explore, hitmeup, help, about, login, static ...）
- `url`：`https://`，长度 < 300（末尾 `/` 与 query 会被去掉）
- `secret`：32–128 位十六进制，客户端首次生成并保存，之后用它更新/删除
- `listed`：是否在 /explore 公开（省略则沿用旧值，新记录默认 false）
- `card`：`nickname<=30, city<=30, tagline<=120, avatar<=8 字符的 emoji 或 https URL, tags<=8 个（每个<=20）`；省略则沿用旧名片

返回：`{ok:true, link:"https://<host>/u/<handle>"}`；错误：400 `invalid_handle|reserved_handle|invalid_url|invalid_secret|bad_json`，413 `body_too_large`，409 `handle_taken`（handle 已被别的 secret 占用）。
Agent 每次隧道地址变化时重复调用即可（幂等更新）。

### POST /api/unregister
Body：`{handle, secret}` -> `{ok:true}`；404 `not_found`；403 `forbidden`。

### GET /api/resolve/<handle>
-> `{ok:true, url, online}`（`online` = 3 秒内 `GET <url>/api/ping` 返回 2xx）；未知 handle 返回 404 `{ok:false,error:"not_found"}`。

### GET /api/explore
返回 `listed:true` 的记录（最多 100 条，在线优先）：`{ok:true, items:[{handle,nickname,city,tagline,avatar,tags,online,updatedAt}]}`。
不暴露 `secretHash` 和隧道地址。经 Cache API 缓存 60 秒（`?fresh=1` 跳过读缓存，测试用）。每个在线探测超时 2.5 秒，并行执行。

### GET /u/<handle>[/path][?query]
- 在线：302 -> `<url>/path?query`（例：`/u/alice/llms.txt`）
- 离线：503 HTML「TA 的 AI 分身暂时不在线」
- 未知：404 HTML「想要自己的 AI 分身？」

## 目标地址需要提供
`GET /api/ping` -> 2xx（本地 Hit Me Up agent 已有此约定）。
