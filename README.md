# 搭子 Dazi

**你的 AI 搭子：替你破冰，帮你约见面。** · *Your AI wingman that breaks the ice and books the meetup.*

开源、本地运行的个人 Agent。你的电脑开着、联网时，别人（或他们的 AI）可以通过一个公开链接了解你、打招呼、约你见面；**对方永远看不到你的日历，只看到你愿意给的空闲时间**，你确认后才成交，成交后事件写入你的日历。

- 目录与主页：https://dazi-agent.pages.dev　·　仓库：https://github.com/Maxthonzx/dazi
- 截图：`docs/screenshots/`（占位，待补）

## 快速开始

### 方式一：让 AI 帮你装（推荐）
把下面这段话粘贴给 Claude Code / Codex / Cursor：

> 请 clone https://github.com/Maxthonzx/dazi ，然后阅读并严格按照仓库里的 AGENTS.md，一步步帮我安装并启动搭子 Dazi。

### 方式二：手动
```bash
git clone https://github.com/Maxthonzx/dazi && cd dazi
npm install            # 需要 Node >= 20
npm run setup          # 问答式向导：资料、时区、日历、通知
brew install cloudflared            # macOS；Windows: winget install Cloudflare.cloudflared
npm run doctor         # 自检
npm start              # 打印分享链接 + 后台地址 http://127.0.0.1:7790
```
主动约别人：`npm run meet -- <handle|链接> --title "喝咖啡" --duration 60`。下线并撤销目录登记：`npm run unpublish`。

## 工作原理

```
访客浏览器 / 访客的 AI ──HTTPS──> Cloudflare 快速隧道 ──> 你的电脑 127.0.0.1:7788（公开：资料卡 + REST + A2A）
                                                      127.0.0.1:7790（后台：仅你本人，永不暴露）
                    目录站 dazi-agent.pages.dev：只存 handle -> 当前隧道地址 + 展示卡片（12 小时内最多登记一次）
请求 ──> 你在后台 接受 / 换个时间 / 婉拒 ──> 写入日历（或给你一键添加链接）──> 对方拿到时间、地点、你同意分享的联系方式
```

## 隐私模型
- 日历**不出本机**：对外只提供“空闲时段”（已考虑缓冲、提前量、每日上限）。
- 联系方式**从不公开**，仅在你接受后发给该请求方。
- 管理后台只监听 127.0.0.1，且校验 Host 与自定义头，防 DNS 重绑定/跨站请求。
- 公开面有限流、请求体 16KB 上限、蜜罐字段、待处理上限；所有展示内容转义。
- 数据全部在 `data/`（已 gitignore）：`profile.json`、`config.json`（含 secret）、`requests.json`、`inbox.json`。

## 日历支持

| 日历 | 读忙闲 | 写入 | 方式 |
|---|---|---|---|
| Google 日历 | ✅ | 一键添加链接 + .ics | iCal 私密地址（ics） |
| iPhone / iCloud | ✅ | ✅ | CalDAV + App 专用密码 |
| Outlook | ✅ | .ics / 链接 | 发布的 ICS 链接 |
| 飞书 | 可选 | 可选 | lark-cli |
| 不连接 | — | .ics / 链接 | 仅按每周可约时间 |

详见 [docs/calendars.md](docs/calendars.md)。协议与 API：[docs/protocol.md](docs/protocol.md)；资料字段：[docs/profile-schema.md](docs/profile-schema.md)。

## Roadmap
- Google Calendar OAuth（读写）　- 多语言界面　- 对方 AI 自动谈判更多轮　- 移动端后台　- 自有域名/命名隧道一键配置

## 开发
`npm test`（单元测试）· `npm run e2e`（两实例端到端，`--no-tunnel`，不访问真实目录）。

## English
**Dazi** is an open-source personal agent that runs on your own computer. While it is on and online, a public profile card plus an A2A (v0.3) endpoint is reachable through a Cloudflare quick tunnel. Visitors — humans or their AI agents — can learn about you, say hi, and request a meetup, but never see your calendar, only the free slots you offer. You approve; the event goes into your calendar; the requester receives time, place and the contacts you chose to share. Quick start: `npm install && npm run setup && npm start`, or paste the prompt above into your AI coding agent. Node >= 20; macOS and Windows supported. Calendars: Google (secret iCal URL, read + add-link), iCloud (CalDAV, read/write), Outlook (ICS), Feishu (optional). MIT licensed.

## License
MIT © 2026 Maxthonzx
