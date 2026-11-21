# profile.json 字段

除 `handle`、`nickname` 外全部可选。示例见仓库根目录 `profile.example.json`。

| 字段 | 类型 | 说明 |
|---|---|---|
| handle | string | 必填。`^[a-z0-9][a-z0-9-]{2,29}$`，分享链接里的名字 |
| nickname | string | 必填，<=30 字 |
| avatar | string | emoji 或 http(s) 图片链接 |
| gender / age | string / number | 可选；age 16-120 |
| city, tagline(<=80), bio(<=600) | string | |
| hobbies, recentInterests | string[] | 最多 20 个 |
| lookingFor | string | 想认识什么样的人 |
| canOffer | string | 我能提供什么 |
| favoritePlaces | `{name, type, area, note}[]` | type: cafe/restaurant/bar/park/gym/online/other |
| meetupTypes | string[] | 如 喝咖啡/吃饭/散步/线上聊 |
| contacts | `{wechat, phone, email, instagram, xiaohongshu, telegram, other}` | **永不公开**，仅接受后分享 |
| contactsToShare | string[] | 接受后分享 contacts 中的哪些 key |
| languages | string[] | |
| listed | boolean | 是否在目录页公开展示，默认 false |

公开接口只返回除 `contacts`、`contactsToShare`、`listed` 以外的字段。

# config.json

```json
{
  "timezone": "Asia/Shanghai",
  "availability": {
    "weekly": { "mon": [["19:00","22:00"]], "sat": [["10:00","21:00"]], "sun": [["10:00","21:00"]] },
    "bufferMin": 30, "minNoticeHours": 12, "maxMeetupsPerDay": 2, "horizonDays": 14, "defaultDurationMin": 60
  },
  "calendar": { "type": "none" },
  "notify": { "bark": { "key": "", "server": "https://api.day.app" }, "webhook": { "url": "", "kind": "feishu" } },
  "secret": "（自动生成，勿泄露）"
}
```
`weekly` 的键为 mon..sun，值是 `[开始, 结束]` 列表（本地时间，可多段）。
