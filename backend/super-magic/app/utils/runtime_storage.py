""".runtime 运行数据存储与清理规则（维护者说明）。

阅读顺序：
    1. 先看“清理规则短索引”，快速确认每个目录放什么、谁负责、何时删除。
    2. 再看“目录树”，确认每种数据的路径和删除单位。
    3. 再看“统一清理流程”，确认一次运行从创建到淘汰会经历什么。
    4. 最后看 API、策略字段、配置来源和边界说明。

本文只描述当前代码事实。线上 `.runtime` 的清理数值统一来自
`config/config.yaml` 的 `runtime_cleanup`；owner 代码仍决定数据路径、保护对象和触发时机。
`verification/real_compaction` 是本地跑测目录，数值由脚本自己管理，不读取
`runtime_cleanup`。如果代码中的配置名、路径或触发点发生变化，必须同步更新本文。

===============================================================================
一、清理规则短索引
===============================================================================

删除动作只有两种：

    按单个文件删除
        路径形态：.runtime/<capability>/<file>
        删除调用：async_unlink(file)
        一个文件单独成为候选项，删除时只删除这个文件。

    按整次运行目录删除
        路径形态：.runtime/<capability>/<run>/
        删除调用：async_rmtree(run_dir)
        一次运行产生的一组文件作为一个整体，删除时整目录一起删除。

background_compact 和 memory_after_run 使用“按整次运行目录删除”。一次 Agent 运行会同时
产生 history、session、horizon、token usage、tools 等相互关联的文件；这些文件必须一起
保留或一起删除，不能只删除其中一个文件。

-------------------------------------------------------------------------------
[01] bg_shell
-------------------------------------------------------------------------------
路径：      .runtime/bg_shell/<task-id>.log
内容：      后台 Shell 任务日志；单个日志超过 8 MiB 时，保留头部 1 MiB 和尾部 1 MiB。
owner：     BackgroundProcessManager、BgOutputStore
立即处理：  不在任务结束时立即删除；超大日志先原地截断。
延后处理：  启动、注册任务、任务完成、错误、kill 时机会式清理。
活动保护：  RUNNING 任务的日志不删除；只处理已结束任务的日志。
淘汰规则：  超过 7 天删除；文件数 50 个触发，删除到 40 个；容量 256 MiB 触发，删除到
            192 MiB。
配置：      `runtime_cleanup.bg_shell`（年龄、文件数、容量、单文件截断、头尾保留值）。
实现归属：  owner 自己的 evict_if_needed()，不是通用 evict_runtime_files()。

-------------------------------------------------------------------------------
[02] mcp_outputs
-------------------------------------------------------------------------------
路径：      .runtime/mcp_outputs/<tool>-<timestamp>.json
内容：      MCP 结果超过 8 KiB，且调用方没有指定输出路径时自动保存的 JSON。
owner：     MCP tool、app/mcp/tool/result_saver.py
立即处理：  不即时删除；用户指定 .workspace 或外部绝对路径时不进入此目录。
延后处理：  每次 MCP 工具调用开始前机会式清理。
活动保护：  当前没有额外保护集合；只处理直接子文件中的 JSON。
淘汰规则：  超过 7 天删除；文件数 128 个触发，删除到 96 个；容量 256 MiB 触发，删除到
            192 MiB。
配置：      `runtime_cleanup.mcp_outputs`（年龄、文件数、容量和自动落盘阈值）。
实现归属：  通用 evict_runtime_files()。

-------------------------------------------------------------------------------
[03] oauth2 callback
-------------------------------------------------------------------------------
路径：      .runtime/oauth2/callback_relay/local/callbacks/<state-hash>.json
内容：      本地 OAuth2 callback 暂存数据。
owner：     LocalOAuth2CallbackRelay
立即处理：  delete_callback() 消费完成后可以立即删除。
延后处理：  save_callback()、fetch_callback() 时机会式清理。
活动保护：  活跃 OAuth state 对应的文件通过 protected_paths 保护。
淘汰规则：  超过 24 小时删除；文件数 128 个触发，删除到 96 个；只处理 JSON。
配置：      `runtime_cleanup.oauth2_callback`（年龄和文件数）。
实现归属：  通用 evict_runtime_files()。

-------------------------------------------------------------------------------
[04] Python / SDK snippets
-------------------------------------------------------------------------------
路径：      .runtime/snippets/run_python/<temporary>.py
            .runtime/snippets/run_sdk/<temporary>.py
内容：      每次 Python 或 SDK snippet 执行生成的临时脚本。
owner：     SnippetEnvironment、run_python_snippet、run_sdk_snippet
立即处理：  正常完成、失败、取消后在工具 finally 中删除；删除失败才留给延后清理。
延后处理：  创建脚本后机会式清理。
活动保护：  _active_scripts 中的活动脚本通过 protected_paths 保护；只处理 PY 文件。
淘汰规则：  超过 7 天删除；文件数 64 个触发，删除到 48 个；容量 16 MiB 触发，删除到
            12 MiB。
配置：      `runtime_cleanup.snippets`（年龄、文件数和容量）。
实现归属：  通用 evict_runtime_files()。

-------------------------------------------------------------------------------
[05] llm_requests
-------------------------------------------------------------------------------
路径：      .runtime/llm_requests/<model>_<time>_<duration>_<id>_<status>.log
兼容边界：  `.runtime` 只使用 `llm_requests`；`.topic` 迁移和归档同时排除旧的
            `llm_request` 和当前的 `llm_requests`，启动时删除旧的
            `.topic/chat_history/llm_request/`；该删除在后台异步执行，不阻塞启动主链路。
内容：      LLM 调试请求日志；失败请求总是记录，成功请求由
            ENABLE_LLM_SUCCESS_REQUEST_LOG 控制。
owner：     agentlang/agentlang/llms/utils/debug_logger.py、ChatHistoryCleanupService
立即处理：  每次请求结束时，debug_logger 按配置保留最新日志；默认 10，设为 0 表示不按
            文件数清理。
延后处理：  ChatHistoryCleanupService 在服务启动、隔离 Agent 结束、主 Agent 压缩等已有
            时机再次按同一文件数配置清理；不再按年龄或总容量清理。
活动保护：  该目录没有额外保护集合。
淘汰规则：  `runtime_cleanup.llm_request.max_file_count` 控制文件数量，默认 10；设为 0
            时关闭数量清理。
配置：      `runtime_cleanup.llm_request.max_file_count`。
实现归属：  debug_logger 和 ChatHistoryCleanupService 共用文件数配置；清理动作使用通用
            evict_runtime_files()。
持久副本：  debug_logger 另将完整失败日志写入 .topic/archives/llm_requests/，由
            diagnostic_retention.llm_failed_max_count 独立保留最近 3 份；本模块不管理
            持久副本，也不放宽 runtime 路径校验。成功日志不占持久名额。

-------------------------------------------------------------------------------
[06] background_compact
-------------------------------------------------------------------------------
路径：      .runtime/background_compact/<agent-name><agent-id>/
内容：      一次后台压缩 Agent 的完整会话文件，可能包含 history、session、horizon、
            token usage、tools 等多个文件。
owner：     start_background_compact、run_compaction_agent、ws_server 启动清理
立即处理：  成功、失败、取消后都保留，不在 run_compaction_agent() 结束时删除。
延后处理：  创建会话目录后触发；服务启动时再次检查；超过 7 天后淘汰。
活动保护：  当前新建目录通过 protected_paths 保护。
淘汰规则：  按整次运行目录删除，不支持只删除其中某个会话文件。
配置：      `runtime_cleanup.background_compact.max_age_days`。
实现归属：  通用 evict_runtime_directories()。

-------------------------------------------------------------------------------
[07] memory_after_run
-------------------------------------------------------------------------------
路径：      .runtime/memory_after_run/<agent-name><agent-id>/
内容：      一次运行后的记忆整理 Agent 完整会话，同样是一组相互关联的文件。
owner：     MemoryExtractionService、ws_server 启动清理
立即处理：  成功、失败、取消后都保留，便于 debug。
延后处理：  创建会话目录后触发；服务启动时再次检查；超过 7 天后淘汰。
活动保护：  当前新建目录通过 protected_paths 保护。
淘汰规则：  runtime 源按整次运行目录删除，不直接进入持久历史，也不作为 resume 入口。
持久副本：  整理结束后由 ChatHistoryArchiveService 将完整终态会话复制到配置的
            .chat_history/subagents/；归档上传成功后可跨沙盒恢复。
            ChatHistoryCleanupService 独立保留最近 3 次，不按普通历史的年龄和容量规则删除。配置位于
            diagnostic_retention.memory_after_run_max_count，不影响 runtime 的 7 天策略。
配置：      `runtime_cleanup.memory_after_run.max_age_days`。
实现归属：  通用 evict_runtime_directories()。

-------------------------------------------------------------------------------
[08] verification/real_compaction
-------------------------------------------------------------------------------
路径：      .runtime/verification/real_compaction/<run-id>/
内容：      scripts/verify_real_compaction.py 产生的真实压缩验证产物。
owner：     scripts/verify_real_compaction.py
立即处理：  默认验证结束时删除本次 Agent、subagent 和新增 LLM 日志；使用
            --keep-artifacts 时保留本次产物。
延后处理：  每次验证开始前同步清理旧产物。
活动保护：  容量淘汰只处理修改时间超过 1 小时的目录。
淘汰规则：  超过 7 天删除；目录数 10 个触发，删除到 8 个；容量 512 MiB 触发，删除到
            384 MiB。
实现归属：  脚本自己的 owner 清理逻辑，不使用通用 evict_runtime_directories()。

-------------------------------------------------------------------------------
[09] slide-template-maker
-------------------------------------------------------------------------------
路径：      .runtime/slide-template-maker/<template-id>/
内容：      SlideTemplateBuilder 的模板处理中间工作目录。
owner：     SlideTemplateBuilder
立即处理：  cleanup_template_intermediates() 可以在处理完成后显式删除。
延后处理：  创建工作目录后触发 owner 自己的机会式清理 helper。
活动保护：  当前工作目录通过 protected_paths 保护。
淘汰规则：  超过 3 天删除；最多保留 16 个目录。
配置：      `runtime_cleanup.slide_template_maker`（目录最长保留时间和目录数量）。
实现归属：  owner 自己的目录淘汰 helper，不使用通用 evict_runtime_directories()。

-------------------------------------------------------------------------------
[10] micro-app
-------------------------------------------------------------------------------
路径：      .runtime/micro-app/scope.json
内容：      本会话累积的 @micro_app MagicBase project 范围。
owner：     app/service/mention/utils/micro_app_prompt.py
立即处理：  无。无 @ 或 SDK 全部失败时保留已有文件。
延后处理：  无。0–1 个文件，不接入 runtime_cleanup。
活动保护：  当前会话正在使用的 scope 即该文件本身。
淘汰规则：  新 @ 增量合并；沙箱重建后丢失。不按年龄/数量清理。
配置：      无
实现归属：  owner 自己的 persist/clear，不使用通用 evict_runtime_files()。

-------------------------------------------------------------------------------
[11] native_visual_cache
-------------------------------------------------------------------------------
路径：      .runtime/native_visual_cache/<cache-key-sha256>.json
内容：      原生视觉图片压缩后的 Base64 Data URL，用于跨 run 复用同一张图的处理结果。
            一个 JSON 记录 version、完整缓存键（源文件路径/mtime/size 与压缩参数）、
            data_url、图片宽高、产出体积和创建时间。缓存键任一字段变化都视为 miss，
            所以图片被替换或压缩参数变化时不需要额外失效逻辑。
owner：     ImageBase64Cache、ImageCompressionService
立即处理：  不即时删除；缓存本身就是为后续 run 复用而保留。
延后处理：  写入新缓存项后机会式清理。
活动保护：  当前没有额外保护集合；只处理直接子文件中的 JSON。
淘汰规则：  超过 7 天删除；文件数 512 个触发，删除到 384 个；容量 256 MiB 触发，
            删除到 192 MiB。
配置：      `runtime_cleanup.native_visual_cache`（年龄、文件数和容量）。
实现归属：  通用 evict_runtime_files()。
说明：      缓存只是加速手段，不是业务依赖。目录不可用、文件损坏或权限不足时，
            owner 静默降级为"未命中"，由调用方照常重新压缩，不影响图片处理结果。

-------------------------------------------------------------------------------
[12] file_edits
-------------------------------------------------------------------------------
路径：      .runtime/file_edits/<range-id 或 replacement-id>.json
内容：      当前 AgentContext 的单次编辑范围和失败后可复用的新文本。
owner：     find_file_ranges、edit_file_ranges、edit_file、AgentRuntimeResetService
立即处理：  成功应用的范围标记为已使用；上下文重置时删除当前上下文的记录。
延后处理：  创建记录后机会式清理。
活动保护：  范围的 owner_context_id 不匹配时不可读取；沙盒重建后不承诺保留。
淘汰规则：  超过 7 天删除；文件数 128 个触发，删除到 96 个；容量 256 MiB 触发，删除到
            192 MiB。
配置：      `runtime_cleanup.file_edits`（年龄、文件数和容量）。
实现归属：  通用 evict_runtime_files()。
说明：      模型只看到 8 位短 ID；记录同时绑定上下文、文件路径和源内容摘要。文件变化、
            沙盒重启、上下文重置或范围成功应用后，原 ID 都不能继续使用。

-------------------------------------------------------------------------------
[12] follow_up_suggestions
-------------------------------------------------------------------------------
路径：      .runtime/follow_up_suggestions/<task-id>.json
内容：      一次任务的追加问题状态和问题列表。同一份结果仍上报 magic-service。
owner：     FollowUpSuggestionStore、FollowUpSuggestionService
立即处理：  不即时删除。完成或失败后保留，供调试客户端在聊天结束后查询。
延后处理：  每次写入后机会式清理。
活动保护：  本次写入的文件通过 protected_paths 保护。
淘汰规则：  超过 7 天删除；文件数 64 个触发，删除到 48 个。
配置：      `runtime_cleanup.follow_up_suggestions`（年龄和文件数）。
实现归属：  通用 evict_runtime_files()。
说明：      终态文件不会被后到的生成中状态覆盖。产品前端不读这个目录。

===============================================================================
[14] skill_publish 与 prepared confirmations
===============================================================================

路径：      .runtime/skill-publish/<prepare-token>/（整次快照目录）
            .runtime/canvas-operations/<topic-hash>/<tool-call-hash>.json（兼容旧确认目录）
内容：      发布前供审查的固定文件副本；与话题、用户、版本及范围绑定的确认记录。
owner：     PrepareSkillPublish、PreparedOperationConfirmation
立即处理：  拒绝确认时删除确认记录；完成记录保留用于响应丢失后的幂等重试。
延后处理：  新快照创建后机会式清理；新确认创建前清理过期记录。
活动保护：  本次写入的快照通过 protected_paths 保护；已发布云端版本不在本地清理范围。
淘汰规则：  快照超过 24 小时删除；目录数 32 个触发到 24 个；容量 500 MiB 触发到 400 MiB。
            确认记录最多 256 条，超过 24 小时不可再用于确认；新建前清理过期记录。
配置：      `runtime_cleanup.skill_publish`（快照年龄、目录数及容量）。
实现归属：  快照使用通用 evict_runtime_directories()；确认由 owner 管理。

===============================================================================
二、目录树与删除单位
===============================================================================

下面是代码约定的目录树。某个目录按需创建，所以实际磁盘上不存在它不代表路径契约
不存在；历史残留存在，也不代表会被通用 helper 自动接管。

    .runtime/
    ├── bg_shell/                         直接子文件，一个任务一个日志
    │   └── <task-id>.log
    ├── mcp_outputs/                      直接子文件，临时 MCP 结果
    │   └── <tool>-<timestamp>.json
    ├── oauth2/
    │   └── callback_relay/local/callbacks/
    │       └── <state-hash>.json
    ├── snippets/
    │   ├── run_python/                   直接子文件，临时 Python 脚本
    │   │   └── <temporary>.py
    │   └── run_sdk/                      直接子文件，临时 SDK 脚本
    │       └── <temporary>.py
    ├── native_visual_cache/              直接子文件，图片 Base64 复用缓存
    │   └── <cache-key-sha256>.json
    ├── file_edits/                       直接子文件，两阶段文件编辑记录
    │   └── <range-id 或 replacement-id>.json
    ├── follow_up_suggestions/            直接子文件，追加问题本地查询副本
    │   └── <task-id>.json
    ├── llm_requests/                     直接子文件，LLM 调试日志
    │   └── <model>_<time>_<status>.log
    ├── background_compact/               一个目录代表一次后台压缩运行
    │   └── <agent-name><agent-id>/
    │       ├── <agent-name><agent-id>.json
    │       ├── <agent-name><agent-id>.session.json
    │       ├── <agent-name><agent-id>.horizon.json
    │       └── ...
    ├── memory_after_run/                 一个目录代表一次记忆整理运行
    │   └── <agent-name><agent-id>/
    │       ├── <agent-name><agent-id>.json
    │       ├── <agent-name><agent-id>.session.json
    │       ├── <agent-name><agent-id>.horizon.json
    │       └── ...
    ├── verification/real_compaction/     owner 自己清理的验证目录
    │   └── <verification-run-id>/
    ├── slide-template-maker/             owner 自己清理的模板工作目录
    │   └── <template-id>/
    └── micro-app/                        累积 @micro_app MagicBase 范围
        └── scope.json

通用 helper 的扫描范围：

    evict_runtime_files(directory)
        只扫描 directory 的直接普通文件。
        例如：扫描 .runtime/mcp_outputs/，候选是其中的 JSON 文件。
        不递归，不删除 capability 根目录。

    evict_runtime_directories(directory)
        只扫描 directory 的直接子目录，并递归统计每个子目录的普通文件大小。
        例如：扫描 .runtime/memory_after_run/，每个 Agent 会话目录是一个候选。
        删除动作是 async_rmtree(run_dir)，不会只删目录中的某个文件。

===============================================================================
三、统一清理流程
===============================================================================

A. 从业务创建数据到清理任务启动

    业务需要运行数据
           │
           ▼
    ensure_runtime_directory(path)
           │
           ├── path 不在 .runtime 内？ ───────────────► 立即报错
           │
           ├── 路径链上有软链接？ ───────────────────► 立即报错
           │
           └── 创建并设置目录权限 0700
                    │
                    ▼
             owner 写入运行数据
                    │
          ┌─────────┴─────────────────────┐
          │                               │
    用完即可丢弃                     需要短期 debug / 续读
          │                               │
          ▼                               ▼
    finally 立即删除                 保留文件或整次运行目录
    async_unlink / async_rmtree              │
                                             ▼
                               trigger_opportunistic_cleanup()
                                             │
                              ┌──────────────┴──────────────┐
                              │                             │
                       同 cleanup_key 已有任务         没有同 key 任务运行
                              │                             │
                              ▼                             ▼
                           直接跳过                  创建异步清理任务
                                                           │
                                                           ▼
                                                  当前业务继续运行

B. 异步清理任务如何选择和删除候选

    异步清理任务开始
           │
           ▼
    检查 capability 根路径
           │
           ├── 根路径不存在 ─────────────────────────► 结束，无需清理
           ├── 根路径是软链接 ───────────────────────► 抛错，记录 warning
           └── 根路径合法
                    │
                    ▼
          扫描直接子文件或直接子目录
                    │
      ┌─────────────┼──────────────────────────┐
      │             │                          │
   活动路径       软链接                    类型或后缀不匹配
 protected_paths  entry.is_symlink()         非普通文件或非目录
      │             │                          │
      ▼             ▼                          ▼
   排除候选       排除候选                    排除候选
      └─────────────┴──────────────┬───────────┘
                                   │
                                   ▼
                         剩余候选按 mtime 排序
                                   │
                                   ▼
                    先删除超过 max_age_seconds 的候选
                                   │
                                   ▼
                    重新统计剩余数量和总容量
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
             未超过数量和容量                 任一超过高水位
                    │                             │
                    ▼                             ▼
                 结束                    从最旧到最新逐个删除
                                                  │
                                                  ▼
                                  所有已配置 target 同时满足？
                                         │                 │
                                        否                是
                                         │                 │
                                         └──继续删除       └──结束

C. background_compact 和 memory_after_run 的完整生命周期

    创建本次 Agent 会话目录
              │
              ▼
    将当前目录加入 protected_paths
              │
              ▼
    Agent 运行并产生多份关联文件
              │
      ┌───────┼────────┬────────┐
      │       │        │        │
    成功    失败     取消     进程重启
      │       │        │        │
      └───────┴────────┴────────┘
              │
              ▼
    本次目录先保留，便于 debug；不进入持久化 .topic 历史
              │
      ┌───────┴──────────────────────┐
      │                              │
   下一次同类运行                  服务启动
      │                              │
      └──────────────┬───────────────┘
                     ▼
          按 7 天策略清理旧会话目录
                     │
                     ▼
          async_rmtree(整次运行目录)
                     │
                     ▼
          sandbox 重建时 .runtime 整体消失

机会式清理不是本模块创建的全局定时器。它只在 owner 已有的创建、写入、结束、服务启动等
业务时机被触发；没有新的触发时，已过期文件或目录可以继续留在当前 sandbox 中。

===============================================================================
四、通用 API 和路径安全
===============================================================================

ensure_runtime_directory(path)
    只允许创建 .runtime 内的路径。
    先对路径做 os.path.abspath，只进行词法绝对化，不解析或跟随软链接。
    从 runtime 根目录开始逐级检查路径链；任何一层是软链接都报错。
    创建目录并设置 0700 权限。

trigger_opportunistic_cleanup(cleanup_key, cleanup_factory)
    同一个 cleanup_key 同时只允许一个清理任务运行。
    已有任务运行时，新的触发直接跳过，不排队，也不补跑。
    清理任务使用 asyncio.create_task() 异步执行，不阻塞主业务。
    清理任务取消时直接结束；其他异常只记录 warning，不覆盖主流程结果。
    不同 cleanup_key 可以并行。

evict_runtime_files(directory, policy, suffixes, protected_paths)
    只处理 capability 根目录下的直接普通文件。
    可按 suffixes 过滤；软链接、目录、受保护路径都不成为候选。
    删除动作是 async_unlink(file)。

evict_runtime_directories(directory, policy, protected_paths)
    只处理 capability 根目录下的直接子目录。
    递归统计每个目录的普通文件大小，不跟随目录内软链接。
    删除动作是 async_rmtree(run_dir)，每个运行目录整体删除。

protected_paths
    以词法绝对路径比较。
    在收集候选时直接排除，所以不参与数量和容量统计，也不会因超限被删除。
    owner 必须传入所有仍然活动的文件或目录。

路径安全判断：

    输入 path
       │
       ▼
    os.path.abspath（不跟随软链接）
       │
       ├── 不在 PathManager.get_runtime_dir() 内 ──► ValueError
       │
       └── 在 runtime 内
              │
              ├── ensure：路径链任一层是软链接 ──► ValueError
              ├── evict：capability 根是软链接 ──► ValueError
              └── 扫描条目是软链接 ───────────────► 跳过，不统计、不删除

===============================================================================
五、RuntimeEvictionPolicy 的执行规则
===============================================================================

max_age_seconds
    候选 mtime 早于当前时间减去该值时，先删除这批过期候选。

max_entries + target_entries
    候选数量大于 max_entries 时，按 mtime 从旧到新删除，直到数量不大于 target_entries。

max_total_bytes + target_total_bytes
    候选总大小大于 max_total_bytes 时，按 mtime 从旧到新删除，直到容量不大于
    target_total_bytes。

固定执行顺序：

    1. 收集候选，排除 protected_paths 和软链接。
    2. 按 max_age_seconds 删除过期候选。
    3. 重新统计剩余数量和总容量。
    4. 如果数量或容量任一超过高水位，从最旧候选开始删除。
    5. 每删一个候选就重新计算剩余数量和容量。
    6. 所有已配置的 target 同时满足后停止。

参数约束：
    - max_entries 和 target_entries 必须成对配置。
    - max_total_bytes 和 target_total_bytes 必须成对配置。
    - maximum 必须大于 0；target 必须大于等于 0，且不能大于 maximum。
    - max_age_seconds 必须大于 0。
    - 未配置的限制维度不参与清理。
    - 本模块没有隐藏的全局默认保留天数。

===============================================================================
六、配置来源和当前默认值
===============================================================================

config/config.yaml 中线上 `.runtime` 的清理配置统一位于 `runtime_cleanup`：

    runtime_cleanup.bg_shell
    runtime_cleanup.mcp_outputs
    runtime_cleanup.oauth2_callback
    runtime_cleanup.snippets
    runtime_cleanup.native_visual_cache
    runtime_cleanup.llm_request
    runtime_cleanup.background_compact
    runtime_cleanup.memory_after_run
    runtime_cleanup.slide_template_maker
    runtime_cleanup.file_edits

各段的具体默认值直接查看 `config/config.yaml`。容量字段使用人类可读写法，例如 `256MB`、
`192MB`、`8KB`；解析器也接受 `MiB`、`KiB` 等写法，并按项目约定使用 1024 进制。

本地 LLM 调试日志只有一个线上清理配置：

    runtime_cleanup.llm_request.max_file_count   默认值：10

设置为 0 时，不执行按文件数的清理。
持久失败副本由 debug_logger 使用 diagnostic_retention.llm_failed_max_count 管理，
只接受正整数；它不属于本模块的清理范围。

同一段 chat_history_cleanup 配置中的下面几项目标是本地 .chat_history，不是 .runtime：

    completed_subagent_max_age_days
    completed_subagent_max_count
    compacted_max_age_days
    compacted_max_count
    total_max_bytes

`chat_history_cleanup` 中的配置仍然只服务随归档上传的 `.chat_history`，不控制
`.runtime/llm_requests`。`verification/real_compaction` 仍由
`scripts/verify_real_compaction.py` 自己管理，不读取 `runtime_cleanup`。

===============================================================================
七、.runtime 边界和不参与清理的内容
===============================================================================

.runtime 与 .workspace、.topic 同级，是 sandbox 本地运行数据目录：
    - 不属于用户持久化文件。
    - runtime 源目录不进入 checkpoint 或 archive；已完成的 LLM 失败日志和记忆整理
      会话可由各自 owner 保存有限副本，副本遵循自己的持久化和清理规则。
    - 普通 sandbox 退出或重建时自然消失。
    - Claw 可能长期运行，所以不能依赖 sandbox 退出作为日常清理机制。
    - 不提供跨 sandbox 重建恢复保证。
    - Python 文件操作必须使用 async_file_utils 的异步 API。

浏览器原生视觉的截图源不属于 `.runtime`：线上由 topic-scoped 对象 artifact 保存，线下由
普通 `.topic` provider 保存；`.runtime/native_visual_cache` 只缓存压缩后的请求数据。沙盒
重启会清空 runtime，因此不得把截图原路径或临时 staging 路径写入跨运行消息历史。

以下内容不会被这些 runtime helper 自动删除：
    - .workspace 中的用户文件。
    - .topic 下的主 Agent 历史、subagents、compacted 和其他话题存档。
    - protected_paths 指定的活动文件或目录。
    - 其他 capability 的目录。
    - 未知目录名、历史残留目录、.runtime 根目录本身。

本模块不负责：
    - 判断 Agent 是否应该继续运行。
    - 判断某个目录是否属于某个 Agent。
    - 迁移或清洗线上已有的 .topic 文件。
    - 创建全局后台定时清理服务。
    - 为普通持久化 subagent 增加删除规则。

新增 runtime capability 前，维护者需要明确：
    1. 数据是用完即删，还是保留一段时间供 debug？
    2. 数据是直接文件，还是每次运行一个完整目录？
    3. 哪些文件或目录仍在使用，如何传入 protected_paths？
    4. 清理在哪个持续发生的业务时机触发？
    5. age、count、bytes 三类策略分别是什么？

没有这些答案时，不要按文件名前缀猜测删除范围，也不要把未知路径接入通用 helper。
"""

import asyncio
import os
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.utils.async_file_utils import (
    async_chmod,
    async_exists,
    async_is_symlink,
    async_mkdir,
    async_rmtree,
    async_scandir,
    async_stat,
    async_unlink,
)

logger = get_logger(__name__)

_cleanup_tasks: dict[str, asyncio.Task[None]] = {}


@dataclass(frozen=True, slots=True)
class RuntimeEvictionPolicy:
    """runtime 文件或会话目录的容量高低水位和宽松最长存活时间。"""

    max_entries: int | None = None
    target_entries: int | None = None
    max_total_bytes: int | None = None
    target_total_bytes: int | None = None
    max_age_seconds: int | None = None

    def __post_init__(self) -> None:
        self._validate_pair("entries", self.max_entries, self.target_entries)
        self._validate_pair("total bytes", self.max_total_bytes, self.target_total_bytes)
        if self.max_age_seconds is not None and self.max_age_seconds <= 0:
            raise ValueError("max_age_seconds must be greater than zero.")

    @staticmethod
    def _validate_pair(name: str, maximum: int | None, target: int | None) -> None:
        if (maximum is None) != (target is None):
            raise ValueError(f"{name} maximum and target must be configured together.")
        if maximum is None or target is None:
            return
        if maximum <= 0 or target < 0 or target > maximum:
            raise ValueError(f"Invalid {name} watermarks: maximum={maximum}, target={target}.")


def get_runtime_config_int(key_path: str, *, minimum: int = 0) -> int:
    """Read a required non-negative integer from runtime_cleanup configuration."""
    from agentlang.config.config import config

    value = config.get(key_path)
    if isinstance(value, bool) or value is None:
        raise ValueError(f"Missing integer runtime configuration: {key_path}")
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid integer runtime configuration {key_path}={value!r}") from exc
    if parsed < minimum:
        raise ValueError(
            f"Runtime configuration {key_path} must be >= {minimum}, got {parsed}."
        )
    return parsed


def get_runtime_config_size_bytes(key_path: str, *, minimum: int = 0) -> int:
    """Read a required human-readable size from runtime_cleanup configuration."""
    from agentlang.config.config import config

    value = config.get_size_bytes(key_path)
    if value is None:
        raise ValueError(f"Missing size runtime configuration: {key_path}")
    if value < minimum:
        raise ValueError(
            f"Runtime configuration {key_path} must be >= {minimum} bytes, got {value}."
        )
    return value


@dataclass(frozen=True, slots=True)
class _RuntimeFile:
    path: Path
    size: int
    modified_at: float


@dataclass(frozen=True, slots=True)
class _RuntimeDirectory:
    path: Path
    size: int
    modified_at: float


def _absolute_path(path: Path) -> Path:
    """仅做词法绝对化，不解析或跟随文件系统中的软链接。"""
    return Path(os.path.abspath(path))


def _assert_runtime_path(path: Path) -> tuple[Path, Path]:
    runtime_root = _absolute_path(PathManager.get_runtime_dir())
    target = _absolute_path(path)
    if target != runtime_root and runtime_root not in target.parents:
        raise ValueError(f"Runtime path must stay inside {runtime_root}: {target}")
    return runtime_root, target


async def ensure_runtime_directory(directory: Path) -> Path:
    """创建 `.runtime` 内的私有目录，并拒绝路径链上的软链接。"""
    runtime_root, target = _assert_runtime_path(directory)
    relative_parts = target.relative_to(runtime_root).parts

    current = runtime_root
    for part in (None, *relative_parts):
        if part is not None:
            current = current / part
        if await async_is_symlink(current):
            raise ValueError(f"Runtime directory must not be a symbolic link: {current}")
        await async_mkdir(current, parents=True, exist_ok=True)
        await async_chmod(current, 0o700)

    return target


def trigger_opportunistic_cleanup(
    cleanup_key: str,
    cleanup_factory: Callable[[], Awaitable[None]],
) -> None:
    """按 key 启动不阻塞当前业务的 single-flight 清理任务。"""
    running_task = _cleanup_tasks.get(cleanup_key)
    if running_task is not None and not running_task.done():
        return

    task = asyncio.create_task(cleanup_factory(), name=f"runtime-cleanup:{cleanup_key}")
    _cleanup_tasks[cleanup_key] = task

    def _finish(completed: asyncio.Task[None]) -> None:
        if _cleanup_tasks.get(cleanup_key) is completed:
            _cleanup_tasks.pop(cleanup_key, None)
        try:
            completed.result()
        except asyncio.CancelledError:
            return
        except Exception as error:
            logger.warning("Runtime cleanup failed: key=%s, error=%s", cleanup_key, error)

    task.add_done_callback(_finish)


async def evict_runtime_files(
    directory: Path,
    *,
    policy: RuntimeEvictionPolicy,
    suffixes: tuple[str, ...],
    protected_paths: frozenset[Path] = frozenset(),
) -> None:
    """按 mtime 淘汰 `.runtime` 单层目录中的普通文件。"""
    _, target = _assert_runtime_path(directory)
    if not await async_exists(target):
        return
    if await async_is_symlink(target):
        raise ValueError(f"Runtime directory must not be a symbolic link: {target}")

    protected = {_absolute_path(path) for path in protected_paths}
    files: list[_RuntimeFile] = []
    for entry in await async_scandir(target):
        path = _absolute_path(Path(entry.path))
        if path in protected or entry.is_symlink() or not entry.is_file(follow_symlinks=False):
            continue
        if suffixes and path.suffix not in suffixes:
            continue
        try:
            stat = await async_stat(path)
        except FileNotFoundError:
            continue
        files.append(_RuntimeFile(path=path, size=stat.st_size, modified_at=stat.st_mtime))

    files.sort(key=lambda item: item.modified_at)
    now = time.time()

    if policy.max_age_seconds is not None:
        cutoff = now - policy.max_age_seconds
        expired = [item for item in files if item.modified_at < cutoff]
        await _delete_runtime_files(expired)
        expired_paths = {item.path for item in expired}
        files = [item for item in files if item.path not in expired_paths]

    total_bytes = sum(item.size for item in files)
    over_entries = policy.max_entries is not None and len(files) > policy.max_entries
    over_bytes = policy.max_total_bytes is not None and total_bytes > policy.max_total_bytes
    if not over_entries and not over_bytes:
        return

    remaining_entries = len(files)
    for item in files:
        entries_ok = policy.target_entries is None or remaining_entries <= policy.target_entries
        bytes_ok = policy.target_total_bytes is None or total_bytes <= policy.target_total_bytes
        if entries_ok and bytes_ok:
            break
        await async_unlink(item.path)
        remaining_entries -= 1
        total_bytes -= item.size


async def evict_runtime_directories(
    directory: Path,
    *,
    policy: RuntimeEvictionPolicy,
    protected_paths: frozenset[Path] = frozenset(),
) -> None:
    """按 mtime 淘汰 runtime capability 下的直接子目录。"""
    _, target = _assert_runtime_path(directory)
    if not await async_exists(target):
        return
    if await async_is_symlink(target):
        raise ValueError(f"Runtime directory must not be a symbolic link: {target}")

    protected = {_absolute_path(path) for path in protected_paths}
    directories: list[_RuntimeDirectory] = []
    for entry in await async_scandir(target):
        path = _absolute_path(Path(entry.path))
        if path in protected or entry.is_symlink() or not entry.is_dir(follow_symlinks=False):
            continue
        item = await _collect_runtime_directory(path)
        if item is not None:
            directories.append(item)

    directories.sort(key=lambda item: item.modified_at)
    now = time.time()

    if policy.max_age_seconds is not None:
        cutoff = now - policy.max_age_seconds
        expired = [item for item in directories if item.modified_at < cutoff]
        await _delete_runtime_directories(expired)
        expired_paths = {item.path for item in expired}
        directories = [item for item in directories if item.path not in expired_paths]

    total_bytes = sum(item.size for item in directories)
    over_entries = policy.max_entries is not None and len(directories) > policy.max_entries
    over_bytes = policy.max_total_bytes is not None and total_bytes > policy.max_total_bytes
    if not over_entries and not over_bytes:
        return

    remaining_entries = len(directories)
    for item in directories:
        entries_ok = policy.target_entries is None or remaining_entries <= policy.target_entries
        bytes_ok = policy.target_total_bytes is None or total_bytes <= policy.target_total_bytes
        if entries_ok and bytes_ok:
            break
        await async_rmtree(item.path)
        remaining_entries -= 1
        total_bytes -= item.size


async def _collect_runtime_directory(path: Path) -> _RuntimeDirectory | None:
    """递归统计目录大小和最近修改时间，不跟随目录内软链接。"""
    try:
        directory_stat = await async_stat(path)
        entries = await async_scandir(path)
    except FileNotFoundError:
        return None

    total_bytes = 0
    modified_at = directory_stat.st_mtime
    for entry in entries:
        child_path = _absolute_path(Path(entry.path))
        if entry.is_symlink():
            continue
        if entry.is_dir(follow_symlinks=False):
            child = await _collect_runtime_directory(child_path)
            if child is None:
                continue
            total_bytes += child.size
            modified_at = max(modified_at, child.modified_at)
            continue
        if not entry.is_file(follow_symlinks=False):
            continue
        try:
            file_stat = await async_stat(child_path)
        except FileNotFoundError:
            continue
        total_bytes += file_stat.st_size
        modified_at = max(modified_at, file_stat.st_mtime)

    return _RuntimeDirectory(path=path, size=total_bytes, modified_at=modified_at)


async def _delete_runtime_directories(directories: list[_RuntimeDirectory]) -> None:
    for item in directories:
        await async_rmtree(item.path)


async def _delete_runtime_files(files: list[_RuntimeFile]) -> None:
    for item in files:
        await async_unlink(item.path)
