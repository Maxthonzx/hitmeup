# 日历适配器

所有适配器：`listBusy(startISO, endISO) -> [{start,end}]`；`createEvent({start,end,summary,description,location}) -> {written, ref?, addLinks?}`；`check()`。

忙闲读取失败时 Dazi 只记录日志，退化为仅按每周可约时间 + 已确认见面提供时段。

## none
不读不写。成交后后台给出“添加到 Google 日历”链接和 `.ics` 下载。

## ics（只读）
`"calendar": {"type":"ics","url":"..."}`。缓存 5 分钟，展开重复事件（RRULE/EXDATE/单次改动，夏令时正确），忽略全天事件与“显示为空闲”的事件。
- **Google**：设置 → 选中日历 → 整合日历 → “iCal 格式的私密地址”。该链接等同于密码，别外传。
- **iCloud 共享/公开日历**：`webcal://` 会自动换成 `https://`。
- **Outlook**：设置 → 日历 → 共享日历 → 发布，复制 ICS 链接。

## icloud（读写）
`"calendar": {"type":"icloud","appleId":"..","appPassword":"xxxx-xxxx-xxxx-xxxx","calendarName":"可选"}`。
App 专用密码：appleid.apple.com → 登录与安全 → App 专用密码。读取账号下所有支持 VEVENT 的日历；写入 `calendarName` 或第一个日历。通过 `tsdav` + CalDAV `https://caldav.icloud.com`。

## feishu（可选）
`"calendar": {"type":"feishu","profile":"可选","dryRun":false}`；依赖已登录的 `lark-cli`（`calendar +freebusy` / `+create`）。

## google OAuth
v1 未实现（路线图）。用 ics 读 + 一键添加链接即可。
