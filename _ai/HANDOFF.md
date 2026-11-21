# HANDOFF

状态：本地 App v0.1 完成，`npm test`（22 项）与 `npm run e2e`（13 步）通过。`site/` 由另一个 agent 负责，未触碰。

## 未验证
- 真实 cloudflared 隧道（本机未安装）、真实目录 register/resolve/unregister（按契约实现，仅 mock 思路）。
- iCloud CalDAV（tsdav）与飞书适配器无真实账号验证；ICS 仅用本地夹具测试。
- 页面视觉效果未在浏览器中截图检查（仅做了 JS 语法检查与 HTML 转义测试）。

## 下一步
- 与 site 联调目录 API；真机 macOS 测试 cloudflared + launchd。
- 补 docs/screenshots；Google OAuth。
