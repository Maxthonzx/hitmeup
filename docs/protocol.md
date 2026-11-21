# 协议

公开服务器（默认 7788）。写入类接口每 IP 每小时 10 次（`CF-Connecting-IP`），请求体 <= 16KB，待处理请求上限 50。

## REST
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 资料卡页面 |
| GET | `/api/profile` | 公开资料（无联系方式） |
| GET | `/api/slots?duration=60&n=12` | 可约时间 `[{start,end,label}]` + `timezone` |
| POST | `/api/hi` | `{name,intro,contact,message}`，隐藏字段 `website` 为蜜罐 |
| POST | `/api/meetup` | `{name,intro,contact(必填),title,durationMin,meetupType,place,note,slot:{start,end}}` → `{ok,id,token,url}`；时间不可约时 409 并附 `freeSlots` |
| GET | `/api/requests/<id>?t=<token>` | 状态 pending/accepted/declined/counter；accepted 才含 slot/place/contacts/addLinks |
| POST | `/api/requests/<id>/confirm?t=` | 确认主人建议的新时间（counter） |
| GET | `/r/<id>?t=` / `/r/<id>.ics?t=` | 状态页 / 日历文件 |
| GET | `/api/ping`, `/llms.txt` | 探活 / 给 AI 的说明 |

## A2A（v0.3，JSON-RPC 2.0）
- `GET /.well-known/agent-card.json`，`url` = 公网地址 + `/a2a`。
- `POST /a2a`：`message/send`（`params.message.parts` 中放 DataPart，用 `data.type` 区分）、`tasks/get`（`params.id`）。

| data.type | 载荷 | 结果 |
|---|---|---|
| `get-profile` | — | completed，artifact `{profile}` |
| `say-hi` | `{from:{name,intro,contact?}, message}` | completed |
| `request-meetup` | `{from:{name,intro,contact,handle?,agentUrl?}, meeting:{title,durationMin,meetupType,place?,note?}, slots:[{start,end}]}` | 有交集 → `input-required`（等主人确认，task id 用于轮询）；无交集 → `rejected` + artifact `{freeSlots}`（主人最好的 8 个空闲时段） |
| `confirm-counter` | `{taskId}` | 确认主人的新时间 → completed |

`tasks/get`：待确认 `input-required`；主人建议改时间 → `input-required` + artifact `{counterSlot, counterPlace}`；接受 → `completed` + artifact `{slot, place, contacts}`；婉拒 → `rejected`。错误码：-32001 任务不存在，-32602 参数错误。

## 管理 API（127.0.0.1:7790，仅本机）
写请求须带头 `x-hitmeup-admin: 1`，且 Host 必须是 127.0.0.1/localhost:端口。主要路径：`GET /api/state`、`POST /api/requests/<id>/{accept,counter,decline}`、`POST /api/outbound`、`POST /api/outbound/<id>/confirm`、`PUT /api/profile`、`PUT /api/config`、`POST /api/notify-test`、`GET /api/calendar-check`。

## 目录服务（由 site 提供）
`POST /api/register {handle,url,secret,listed,card}`、`GET /api/resolve/<handle>`、`POST /api/unregister {handle,secret}`。Hit Me Up 仅在启动、隧道地址变化、以及每 12 小时最多一次时登记。设 `HITMEUP_DIRECTORY=off` 可完全关闭。
