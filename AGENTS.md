# AGENTS.md — 给 AI 助手：替用户安装 搭子 Dazi

你（Claude Code / Codex / Cursor 等）正在帮用户安装 **搭子 Dazi**：运行在用户自己电脑上的个人 AI 搭子。它有一张公开的资料卡 + A2A 接口，别人（或别人的 AI）可以了解用户、打招呼、请求见面；用户在本机后台确认后写入日历。

请用**简体中文**、口语化、一次问一两个问题地和用户交流。所有问题都可以跳过，别把它变成审问。

## 隐私红线（必须遵守）

- **绝不提交 `data/`**（已在 `.gitignore`）；不要 `git add -f`，不要把 `data/` 里的内容贴到任何公开地方。
- **不要在对话里回显** `config.json` 的 `secret`、iCal 私密链接、Apple App 专用密码、Bark key、webhook URL。需要确认时只说“已配置”。
- 联系方式（微信/手机等）**永远不公开**，只在用户点“接受”后发给对方。写资料时让用户明确选哪些可以共享（`contactsToShare`）。
- 不要代替用户点“接受”见面请求。审批永远由用户本人在后台完成。
- 不要开放或转发管理端口 7790（只允许 127.0.0.1）。

## 步骤

### 1. 环境检查
- `node -v` 需 >= 20。没有就引导安装：macOS `brew install node`；Windows `winget install OpenJS.NodeJS.LTS`；或 https://nodejs.org 。
- 在仓库根目录 `npm install`。

### 2. 了解用户并写入资料（对话式）
先问最少必需的：**handle**（链接里的名字，3-30 位小写字母/数字/短横线，如 `lily-sh`）和**昵称**。其余全部可选，按下面分组轻量地问，并给例子：

1. 头像（一个 emoji 或图片链接）、城市、年龄（可选）、一句话签名（例：周末找人一起 citywalk）
2. 爱好、最近在迷什么、想认识什么样的人、我能提供什么（例：带你逛小众咖啡馆）
3. 常去/喜欢约的地方（名称、类型 cafe/restaurant/bar/park/gym/online/other、区域、一句备注）、愿意怎么见（喝咖啡/吃饭/散步/线上聊）
4. 联系方式（微信/手机/邮箱/Instagram/小红书/Telegram），再问**接受见面后分享哪几个**
5. 是否愿意在目录页公开展示自己（`listed`，默认否）

写入方式二选一：
- 直接生成 `data/profile.json`（字段见 `docs/profile-schema.md`，示例 `profile.example.json`），或
- 非交互命令：
  ```
  node src/cli.mjs init --handle lily-sh --nickname Lily --city 上海 --tagline "周末找人 citywalk" \
    --hobbies "咖啡,羽毛球" --wechat lily_wx --share wechat --timezone Asia/Shanghai
  ```
  更多参数：`--avatar --age --bio --recent-interests --looking-for --can-offer --meetup-types --languages --email --phone --instagram --xiaohongshu --telegram --listed --force`。

### 3. 时区与可约时间
- 问用户所在时区（IANA，如 `Asia/Shanghai`、`America/New_York`；默认取本机）。
- 默认可约：工作日 19:00-22:00、周末 10:00-21:00，缓冲 30 分钟，至少提前 12 小时，每天最多 2 场，未来 14 天。问用户是否要调整；改 `data/config.json` 的 `availability`（格式见 `docs/calendars.md` 与 `docs/protocol.md`），或让用户之后在后台“设置”里改。

### 4. 连接日历（可选，可跳过）
先问用户用什么日历：
- **Google 日历**（读忙闲 + 一键添加）：打开 Google 日历网页 → 设置 → 左侧选中自己的日历 → “整合日历” → 复制 **“iCal 格式的私密地址 (Secret address in iCal format)”**。写入 `config.json`：`"calendar": {"type":"ics","url":"<链接>"}`。
- **iPhone / iCloud**（读写）：浏览器打开 https://appleid.apple.com → 登录与安全 → **App 专用密码** → 生成。写入：`"calendar": {"type":"icloud","appleId":"xxx@icloud.com","appPassword":"xxxx-xxxx-xxxx-xxxx","calendarName":"可选"}`。
- **Outlook**：发布日历得到 ICS 链接，同 Google 的 `ics` 类型（只读）。
- **飞书**（可选，工作场景）：需已装 `lark-cli`，`"calendar": {"type":"feishu","profile":"可选"}`。
- **不连接**：`"calendar": {"type":"none"}`，只按每周可约时间提供时段。
命令行等价：`--ics-url <url>` / `--icloud-id <id> --icloud-password <pw>` / `--feishu`（用于 `init`）。
连好后 `npm run doctor` 会验证连通性。

### 5. 通知（可选，iPhone 推荐）
让用户在 iPhone 装 **Bark**，打开 App 复制 key，写入 `config.json`：`"notify": {"bark": {"key": "<key>", "server": "https://api.day.app"}}`。也可配飞书自定义机器人：`"webhook": {"url": "...", "kind": "feishu"}`。后台“设置”页有“发送测试通知”。

### 6. 安装 cloudflared（公网隧道）
- macOS：`brew install cloudflared`
- Windows：`winget install Cloudflare.cloudflared`
- Linux：见 Cloudflare 官方下载页。
没有 cloudflared 也能本机运行，但别人访问不到。

### 7. 自检并启动
1. `npm run doctor`，按 ❌ 的提示逐项修复。
2. `npm start`。终端会打印 **分享链接**（`https://dazi-agent.pages.dev/u/<handle>`）和 **后台地址**（`http://127.0.0.1:7790`）。把这两个都告诉用户，并说明：电脑开机且联网时别人才能访问；新请求会出现在后台（和 Bark 推送）。
3. 如果端口冲突，用环境变量 `DAZI_PUBLIC_PORT` / `DAZI_ADMIN_PORT`，数据目录用 `DAZI_DATA_DIR`。

### 8. 常驻运行（可选）
- 最简单：保持终端窗口开着。
- **macOS launchd**：创建 `~/Library/LaunchAgents/dev.dazi.agent.plist`（把路径换成真实路径，`which node` 得到 node 路径）：
  ```xml
  <?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0"><dict>
    <key>Label</key><string>dev.dazi.agent</string>
    <key>WorkingDirectory</key><string>/Users/YOU/dazi</string>
    <key>ProgramArguments</key><array><string>/opt/homebrew/bin/node</string><string>src/main.mjs</string></array>
    <key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
    <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>/tmp/dazi.log</string><key>StandardErrorPath</key><string>/tmp/dazi.log</string>
  </dict></plist>
  ```
  然后 `launchctl load ~/Library/LaunchAgents/dev.dazi.agent.plist`；分享链接看 `/tmp/dazi.log`。
- **Windows 任务计划程序**：`schtasks /Create /TN "Dazi" /SC ONLOGON /TR "cmd /c cd /d C:\路径\dazi && npm start" /RL LIMITED`。

### 9. 收尾
告诉用户：分享链接、后台地址、如何改资料（后台“资料”页或 `data/profile.json`）、如何主动约别人（`npm run meet -- <handle|链接> --title "喝咖啡" --duration 60`，需先 `npm start`）、如何下线（Ctrl+C；彻底撤销目录登记 `npm run unpublish`）。

## 开发者须知

- 代码：`src/`（`agent.mjs` 核心；`public-server.mjs` 7788；`admin-server.mjs` 7790；`calendar/` 适配器；`a2a.mjs`）。测试 `npm test`，端到端 `npm run e2e`（起两个 `--no-tunnel` 实例，不碰真实目录）。
- 不要在测试中调用真实目录 `/api/register`、真实 Bark/webhook、真实 iCloud/飞书写入。
- 时区一律走 `src/tz.mjs`（`Intl.DateTimeFormat`），不要用本地 Date 的 getHours() 等。
- 用户可见文案用简体中文。
