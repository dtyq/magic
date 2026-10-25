---
name: frontend-storage-requirements
description: 新增、修改、评审或排查 Magic Web 浏览器存储时使用。覆盖 localStorage、sessionStorage、IndexedDB、Cache Storage、同源配额、写入失败，以及缓存膨胀或写满 origin 的情况。
---

# 前端存储使用要求

同源配额由 IndexedDB、Cache Storage、OPFS 共用。缓存只是加速，不能当成业务对不对的依据。写入随时可能失败；存储不可用时，核心流程还要能走下去。

本仓库存储用法不统一。本 skill 只管新代码怎么想，不要求旧实现改成同一种写法。不要随便抄一个 `setItem`，也不要借机重写旧库。

Service Worker 分桶按 **sw-best-practices**。`logger.error` 字段按 **magic-web-error-logging**。

## 何时使用

新增或修改浏览器持久化、评审会落到本地的数据，或处理配额满、无痕模式、写入失败。

## 先看数据，再选层

先问：敏不敏感、要不要最新、丢了能不能重建、谁负责清理。

| 数据形态 | 倾向 | 不要 |
| --- | --- | --- |
| 小型偏好、布局开关 | 带版本的 Web Storage | 没有上限的大 JSON |
| 仅当前标签页的标记 | `sessionStorage` | 长期持久化 |
| 结构化业务数据、未同步草稿、聊天正文 | 现有 IndexedDB 入口 | `localStorage`、共享 Cache Storage |
| 能重新拉取的媒体或 HTTP 正文 | SW 分桶或带上限的 IDB 正文表 | Web Storage |
| 请求去重、渲染缓存 | 内存 | 任何持久化 |
| 登录态、消息正文 | 沿用现有身份库 / 消息库 | 再开 token 缓存、把整段消息塞进 `localStorage` |

小草稿或带 TTL 的元数据可以走 Web Storage。能重建的可以丢；不能重建的不要为了给缓存腾位去删。

IndexedDB 用 Dexie，现网本来就有多份库，不要为了「统一」并成一个。先搜现有读写，再决定落哪：

- 登录态、账号、主题、集群这类全局配置：给 `magic-global` 加 `version` 和 Repository，不要 `new Dexie("magic-global")`。
- 聊天、Super Magic 流记录、编辑器草稿、HTML 沙箱、画布离线媒体：已有独立库，改这些数据走原库，不要并进 `magic-global`，也不要平行再开一份。
- 和某功能绑在一起的新数据：落在该功能现有库里。只有生命周期和隔离都对不上任何现有库时，才允许新的 Dexie 库名。
- 可重建的大图/正文：给相关库加带上限的表，不要为了一块缓存新开库。

页面不要自己 `caches.open`。同源 HTTP/静态缓存只加 SW 分桶，按 **sw-best-practices**。

## 原则

1. **缓存命中不能代替业务结果。** 本地写成功也不等于服务端已经写成功。
2. **持久化写入都可能失败。** 接住异常。可选缓存保住内存态继续走；只有落盘失败会丢用户数据时，才给能恢复的提示。
3. **按身份隔离。** 跟用户、组织或集群绑定的数据，不要复用别人的 key 或库行。
4. **可重建的缓存要有上限和版本。** 现有消息库、登录态、未同步草稿不要求补硬顶。
5. **观测不要改平台 API，也不要另做配额探测。** 不要 patch 原型，不要轮询 `estimate()`，不要为了探活去 `open()`。
6. **日志不倒存储内容。** 只报产品 key 名。配额写满统一用 `eventKey: storage_quota_exceeded`、`errorKind: quota`，具体通路放 `context.source`，不要再发明新的超限 key。占用偏高快照仍是 `storage_quota_high`。

## 新写入

新写 Web Storage 优先复用现有封装，走 `reportCaughtStorageFailure`。必须直接写平台 API 或独立 IndexedDB 时，自己 `try/catch`；超限同样走这个 helper，不要另起 eventKey。不要把封装里的 `clear()` 当成只清自己的 key。不要平行再开一套存储入口。
