# Magic 文件系统与目录边界指南

本文说明 Super Magic 运行时几个重要目录的职责、持久性和 checkpoint 边界。新增文件前先判断它属于哪一类数据，再选择目录；不要仅因为某个目录「看起来方便」就写入。

## 目录基本规则

```text
.chat_history/       = 运行期聊天记录持久状态，即 agfs localfs 空间的挂载，随 checkpoint 增量记账
.topic/chat_history/ = 话题卷上的交接源：启动时从它恢复（一次性迁移/兜底）
.topic/archives/     = 按能力有限保留的排查档案，只接收完整生成的内容
.runtime/       = 可重新生成的运行数据，不需要 checkpoint，不进入归档
.box/           = Agent 使用的本地工作目录，沙盒重建清空，不进 checkpoint
.workspace/     = 用户文件，由现有文件 checkpoint 机制单独处理
.workspace/.magic/startup/ = 每次沙盒启动执行的任务定义
.checkpoints/   = checkpoint 自身，不能复制进自己
```

这些目录不是同一层级的不同叫法，而是不同的数据责任：

- `.chat_history/` 保存 Agent 运行期继续理解和恢复一个话题所需的持久数据。沙箱内它是指向 agfs localfs 空间挂载的 symlink（`/app/.chat_history` → `/mnt/agfs-vol/agfs/localfs/chat_history`，gateway 在 bind 时创建）：数据只落 agfs-server 容器本地盘，无元数据服务/S3 依赖，每次保存由 checkpoint hook 以 per-file 帧增量记账进 checkpoint。本地开发环境（无 agfs 挂载）它是普通本地目录，功能不受影响，只是没有帧记账。
- `.topic/chat_history/` 是话题卷上的交接副本：沙箱启动时若它有数据则据此恢复本地 `.chat_history/`（一次性迁移/兜底）；每轮运行结束后聊天历史打包上传 zip。
- `.topic/archives/<capability>/` 是排查存档位置；各能力管理自己的保留数量和清理，不随聊天历史交接源清空。
- `.runtime/` 保存进程运行期间的临时文件、调试日志和可重新计算结果。
- `.workspace/` 保存用户需要长期保留、下载或继续编辑的文件。
- `.checkpoints/` 保存文件 checkpoint 和操作流水、内容帧本身。

## Topic artifact 不等于 MagicFS 文件

`.topic/` 在线上通常是 AGFS/MagicFS 挂载入口。把文件写入这个目录，意味着它可能进入
文件元数据、版本树和 checkpoint 处理；这适合需要被用户浏览、下载、重命名、恢复和按文件
管理的内容。topic 只是业务归属和生命周期范围，不代表每个 topic 内部对象都必须注册成
MagicFS 文件。

| 数据类型 | 线上保存方式 | 本地无 AGFS 运行方式 | 是否进入 MagicFS 文件管理 |
|---|---|---|---|
| 用户需要长期管理的文件 | `.workspace/`，沿用现有 MagicFS 文件流程 | 项目本地 `.workspace/` 兼容实现 | 是 |
| Agent 活动会话和交接源 | `.chat_history/`、`.topic/chat_history/`，沿用既有 checkpoint／归档 | 普通本地目录 | 按既有会话规则 |
| 只供模型或工具读取的 topic artifact | 直接写对象存储，保存稳定 artifact key，由 owner 负责 TTL 或 topic 删除清理 | `.topic/` 下受控的普通本地文件 | 否 |
| 可重新生成的单次运行缓存 | `.runtime/<capability>/` | 同一路径 | 否 |

例如浏览器截图只需要让下一次模型请求重新读取，不需要出现在用户文件树中。线上应使用
topic-scoped 对象 artifact，避免为每张截图创建 MagicFS 元数据、版本树和 checkpoint 记录；
本地单独运行 Python 时，对应 provider 才把同一个逻辑 key 映射到普通 `.topic` 文件。两种
环境都只把稳定 artifact 引用写入消息历史，渲染请求时再用系统临时目录做 staging，处理结束
立即删除 staging。

对象存储直传不自动解决生命周期问题。新增 topic artifact 前必须确认对象存储前缀 TTL、
topic 删除清理或其他明确回收入口；没有回收责任时，不能为了省 MagicFS 元数据而静默制造
无界对象。对象 artifact 的临时 URL、绝对路径和 `.runtime` 路径都不能写入可跨运行恢复的
消息历史。

## 活动会话的读写位置

`.topic/` 是网络文件系统挂载。Agent 的一次回合会反复保存消息、会话状态、Horizon 和 token usage；若这些活动文件直接位于 `.topic/`，每次打开、读取、覆盖和关闭文件都可能产生网络往返，累积为明显的运行延迟。文件较小、保留数量较少或使用异步 I/O，都不能消除频繁访问网络文件系统的成本。

| 阶段／用途 | 读写位置 | 约束 |
|---|---|---|
| 主 Agent、普通子 Agent 运行 | 配置的 `.chat_history/`、`.chat_history/subagents/` | 保存 history、session、Horizon 等活动会话文件 |
| 后台压缩、Memory After Run 运行 | `.runtime/<capability>/` | 保存临时会话，不使用话题持久卷 |
| 启动恢复 | `.topic/chat_history/` 或远端历史压缩包 → `.chat_history/` | 恢复到活动目录后再启动 Agent |
| 持久化和排查存档 | 本地生成完整内容 → 由对应 owner 归档上传或低频写入持久卷 | 各能力定义自己的保留和清理规则，不能把活动会话改成逐条网络写入 |

业务代码通过 `PathManager` 获取目录，并使用项目异步文件 API 读写。聊天历史归档通过相同的文件 API 复制、压缩和上传，不区分普通 macOS／Linux 电脑与线上沙盒，不检测挂载，也不读取 inode 或平台 file_id。

禁止将活动 `chat_history_dir` 指向 `.topic/`，包括经软链接指向该目录；平台配置的 `.chat_history/` 根映射由平台管理。`.runtime/` 保存临时运行数据，`.topic/` 用于话题持久数据和低频存档，跨沙盒恢复沿用现有归档流程。

## 存储层与写入耗时

沙盒里同一棵目录树下混着三类存储，小文件写入耗时相差上万倍。写入耗时按文件个数算，不按大小算：一个几十 MB 的文件很快写完，大量碎文件会耗费大量时间。另有套餐配额：单个项目的文件个数和总存储容量都有上限，其中总存储容量是严格的硬限制，超出后写入失败。耗时和配额是两回事，不要混成「按文件个数收费」。

| 存储层 | 范围 | 小文件写入 | 持久／用户可见 |
|---|---|---|---|
| magicfs 网络空间 | `<AGFS_FUSE_MOUNT_PATH>/magicfs/` 下的 project、topic、user、referenced-projects（`.workspace`、`.topic` 都解析到这里），背后是对象存储 | 约 2 秒／个 | 是 |
| 平台内部本地挂载 | 同一挂载点下的其他插件，例如 localfs 的 `chat_history` | 快 | 由平台管理 |
| 容器本地盘 | 不在挂载点下的路径，如 `.box`、`.runtime`、`/tmp`；以及 magicfs 里的影子目录 | 毫秒级 | 否，沙盒重建清空 |

- 影子目录：magicfs 对白名单目录名不落对象存储，内容直接放在容器本地盘。白名单来自 `sandbox-components` 的 gateway 环境变量 `AGFS_MAGICFS_LOCAL_SHADOW_PATH`（默认 `.venv:node_modules:vendor`），本仓库不维护；只对 `mkdir` 创建的目录生效，上传或导入的同名目录仍在对象存储。沙盒重建后影子目录表现为空目录，所以启动任务要用包管理器自身的幂等安装，不能用「目录存在」判断已安装。
- 网络路径里的软链只存在于 agfs-server 内存，沙盒重启后消失，不能用来调整目录布局。
- `.box` 与 `.runtime` 都在容器本地盘：`.runtime` 归应用所有，由各 owner 按数量、容量和存活时间淘汰；`.box` 归 Agent 自由使用（子进程环境变量 `MAGIC_BOX_DIR`，Python 字节码经 `PYTHONPYCACHEPREFIX` 写到 `.box/pycache`），不做时间淘汰，靠沙盒重建清空。
- 判断方法：agfs-fuse 按插件名给节点生成 `user.<插件名>.*` 扩展属性，影子目录不经过插件、没有扩展属性。`app/utils/path_storage.py` 按这一规则判断任意路径的存储层，`inspect_path_storage` 工具把结果说明给 Agent。
- 运行环境：`PathManager.get_runtime_environment()` 按 `.workspace` 解析后是否位于 `<挂载点>/magicfs/` 下区分 sandbox／local；系统提示词只注入对应的 `agents/prompts/runtime_environment/<环境>.prompt`。本地开发环境没有挂载点，所有路径都是本机普通磁盘。
- 启动任务：`.workspace/.magic/startup/<task_id>.md` 由 `StartupTaskService` 在 `AgentDispatcher.on_runtime_ready()` 后台按顺序执行，作为普通后台 shell 任务运行；任务记录确认时的 `project_id`，与当前项目不一致时跳过。

## 目标目录结构

```text
project_root/
├── .chat_history/                          运行期聊天记录（localfs 空间挂载的 symlink；本地开发为普通目录）
│   ├── magic<main>.json                    主 Agent 聊天记录
│   ├── magic<main>.session.json            主 Agent 会话配置和运行状态
│   ├── magic<main>.horizon.json            主 Agent Horizon 持久状态
│   ├── magic<main>.token_usage.json        主 Agent token 使用记录
│   ├── magic<main>.tools.json              主 Agent 能力盘点输入
│   ├── compacted/                          压缩前历史
│   └── subagents/                          子 Agent 持久状态
├── .topic/                                 话题持久卷（agfs-fuse 挂载）
│   ├── chat_history/                       启动交接源（见上文），结构与 .chat_history/ 相同
│   └── archives/
│       └── llm_requests/                   最近 3 份完整 LLM 失败日志
├── .runtime/                              可重新生成的运行数据
│   ├── background_compact/                后台压缩临时上下文
│   ├── llm_requests/                      LLM 调试日志
│   ├── memory_after_run/                  记忆整理活动会话，结束后另存有限副本
│   ├── chat_history_archive/              本地复制 staging 与 zip，操作结束清理
│   ├── bg_shell/                          后台 shell 日志
│   ├── mcp_outputs/                       MCP 自动保存的大结果
│   └── slide-template-maker/              幻灯片模板作者过程的中间文件
├── .box/                                  Agent 本地工作目录（MAGIC_BOX_DIR），沙盒重建清空
│   └── pycache/                           Python 字节码缓存（PYTHONPYCACHEPREFIX）
│
└── .workspace/                            用户文件
    ├── .magic/                            工作区级 Agent、Skill、cron 配置
    │   └── startup/                       启动任务定义，每次沙盒启动后台执行
    └── ...                                 用户创建或需要保留的文件
```

## checkpoint 边界

`.topic/` 由基础设施在容器启动阶段通过 agfs-fuse 挂载为当前 topic 的持久卷。应用层不重复判断操作系统挂载点，只检查 `.topic/chat_history/` 是否可用；聊天历史状态未确认或恢复失败时继续使用 zip 下载/上传兜底。

checkpoint 数据保存在 `.checkpoints/`，挂载内文件由 agfs 侧 checkpoint hook 按空间分区记录内容帧（project / topic 由 magicfs 插件记账，chat_history 由 localfs 插件记账）：

```text
.checkpoints/checkpoint_manifest.json          共享清单（Python 写、agfs 侧 hook 读）
.checkpoints/<checkpoint_id>/checkpoint_info.json      Python 簿记（id/created_time，只写一次）
.checkpoints/<checkpoint_id>/project/operations.json   project 操作流水 + file_snapshots/
.checkpoints/<checkpoint_id>/user/operations.json      user 挂载内文件的流水 + file_snapshots/
.checkpoints/<checkpoint_id>/topic/operations.json     topic 挂载内文件的流水 + file_snapshots/
.checkpoints/<checkpoint_id>/chat_history/operations.json   聊天历史空间的流水 + file_snapshots/
```

- `checkpoint_info.json` 是 Python 私有的；`operations.json` 与内容帧由 agfs 侧 hook 写入各自空间分区，Python 只读。
- `.chat_history/` 的每次保存（含子代理保存）由 localfs 的 checkpoint hook 增量记账：initial 帧 = 本 checkpoint 内该文件首次变更前的字节，latest 帧 = 最近一次变更后的字节。Python 侧不再做整目录快照。
- manifest 带 `activity` 字段（idle / rollback / restore）：任何非 idle 活动期间 hook 跳过记账——rollback 表示 Python 正在按流水重放历史状态，restore 表示正在从远端归档恢复会话数据；创建新 checkpoint 时回到 idle。
- 流水条目带两个协议字段：`file_path` 是 agent 可见绝对路径，恢复目标即路径本身；`space` 标记来源空间，用于按空间施加策略。
- 恢复顺序契约：沙箱启动时聊天历史恢复（zip 解压 / topic 恢复 / 清空）必须先于 checkpoint manifest 落地——恢复阶段 hook 因"无 manifest"静默跳过，恢复出的文件不会被记成 created。manifest 下载挪到恢复之前会把整个聊天历史灌进旧 checkpoint。

checkpoint 由主 Agent 创建：每个用户回合开始前登记新 checkpoint 并写入簿记，此后 agfs 侧 hook 自动对挂载内所有空间的变更入账。

回滚时 `RollbackExecutor` 读聚合后的流水：工作区回放非内部状态空间条目，topic 与 chat_history 条目走同一条尽力而为重放路径，共用同一套 operation 感知重放——反向（undo）用 initial 帧、正向（redo）用 latest 帧。文件版本创建只针对工作区条目。未被帧追踪的杂散文件保持现状；某空间没有 operations.json 时视为该空间无条目。

空间分类（工作区 / 内部状态）的唯一事实来源是空间注册表（`entity/checkpoint.py` 的 `WORKSPACE_SPACES` / `INTERNAL_SPACES` + `is_internal_space`）：新增需要回滚的空间 = 注册表登记一行 + agfs/gateway 侧挂载，回滚执行器与附件过滤零改动。

升级前旧 checkpoint 的远端归档中可能仍存在聊天历史整目录快照目录（`initial/latest_chat_history_snapshots/`）；回滚执行器不再读取它们——回滚到这类 checkpoint 时工作区与 topic 照常按帧恢复，聊天历史以 zip 启动恢复兜底。

聊天历史帧覆盖 `.chat_history/` 下全部持久数据：

- 主 Agent 的 history、session、Horizon、token usage 和其它话题辅助 JSON。
- `compacted/` 中的压缩前历史。
- `subagents/` 中主 Agent 产生的子 Agent 目录的全部持久状态。

不进入聊天历史记账的：

- `llm_request/` 调试日志目录（现位于 `.runtime/llm_request/`，不在聊天历史目录内）。
- `.runtime/` 下的临时上下文、后台 shell 日志和 MCP 大结果。
- `.workspace/` 下的用户文件走工作区帧；`.checkpoints/` 本身不在任何挂载内，也不会复制进自己。

## 文件放置判断

| 问题 | 放置位置 |
|---|---|
| Agent 之后还需要从中恢复话题或查找历史吗？ | `.chat_history/`（运行期，localfs 空间挂载），随归档交接 |
| 进程结束后能否重新生成，或只是调试、临时、中间结果？ | `.runtime/` |
| 用户需要长期保留、下载或继续编辑吗？ | `.workspace/` |
| 它是 checkpoint 的索引、快照或文件操作记录吗？ | `.checkpoints/` |

如果一个文件同时满足多类描述，优先按它的持久责任放置，而不是按生成它的 Agent 放置。例如：

- 后台压缩 Agent 的临时 history 放 `.runtime/background_compact/`，不放 `.topic/chat_history/subagents/`。
- 压缩前的主 Agent 完整历史是用户话题的可检索证据，放在本地 `.chat_history/compacted/`，随既有归档上传和 checkpoint 保存、恢复。
- LLM 请求调试日志放 `.runtime/llm_requests/`，不进入聊天历史归档或 checkpoint。
- 完整失败日志另外直接写入 `.topic/archives/llm_requests/`，跨模型合计保留最近 3 份；半写残留不占完整档案名额。写入确认后才淘汰旧档案，成功日志不进入这里。
- Memory After Run 在 `.runtime/memory_after_run/` 完成本地运行后，将实际生成的整套会话文件复制到 `.chat_history/subagents/`，再主动上传现有聊天历史 zip；成功、失败、中断合计保留最近 3 次完整运行，runtime 源仍按 7 天清理。
- 旧版本聊天历史中的 `.chat_history/llm_request/` 与当前的 `llm_requests/` 都由迁移和归档逻辑排除；已挂载的 `.topic/chat_history/llm_request/` 会在启动后异步删除，不阻塞启动主链路。

两类有限副本使用 `diagnostic_retention` 下各自的正整数配额。记忆整理档案由 `ChatHistoryCleanupService` 独立管理，不受普通子 Agent 的年龄、数量和总容量淘汰影响；它仍占用真实存储空间，并随普通 `subagents` 进入历史 zip 和聊天历史 checkpoint。最近 3 次限制当前目录数量，不能据此推断历史 checkpoint 和云端累计空间。

`ChatHistoryArchiveService` 统一协调主任务与记忆整理的上传顺序。记忆整理先保存本地完整副本，再获取凭证；上传关闭或失败时保留本地记录，只有成功上传才具备跨容器恢复条件。打包期间源文件变化或 JSON 不完整时放弃本次上传，不覆盖远端旧包。

## subagent 目录和父 Agent

`subagents/` 的目录只说明「这一组文件属于谁」：

```text
.chat_history/subagents/
├── magic<research-01>/
└── explore<check-02>/
```

父 Agent 不通过目录层级推断，而记录在对应 `.session.json` 的 `subagent` 区域：

```json
{
  "parent_agent_name": "magic",
  "parent_agent_id": "main"
}
```

如果未来开放一层 subagent 调用 subagent，仍然只记录直接父 Agent；不增加祖先链文件，也不依赖目录嵌套表达关系。

## 维护要求

- 新增目录 getter 前，先确认数据责任，避免复制已有职责。
- 异步运行时代码中的文件操作必须使用 `app/utils/async_file_utils.py`。
- 可重新生成的数据默认不得写入 `.chat_history/` 或 `.workspace/`；上述记忆整理完整档案是有独立数量配额的排查例外，不能扩展为所有临时会话回迁。
- 需要修改 checkpoint 边界时，必须同步更新本文、`RollbackExecutor` 的模块注释和相关方案；topic 挂载的 hook 排除范围由 sandbox-gateway 的 `AGFS_MAGICFS_CHECKPOINT_TOPIC_EXCLUDE_PREFIXES` 管理。
- 不要为聊天记录新增 `manifest`、`bundle`、`segment`、`transcript` 等项目未采用的抽象；使用现有目录、文件名和 `.session.json`。
