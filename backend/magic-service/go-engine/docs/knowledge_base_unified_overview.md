# 知识库统一架构、职责边界与数据流总览（当前现状）

本文档基于当前仓库最新实现，统一回答三个问题：

1. 当前知识库系统整体长什么样。
2. PHP 和 Go 现在各自负责什么，哪些已经收口，哪些还没收口。
3. 当前知识库数据究竟如何从来源进入系统、落库、向量化、检索、重建和修复。

## 1. 文档定位

这是一份“当前现状文档”，不是历史迁移方案文档。

因此它遵循以下原则：

- 只写当前代码能验证的事实。
- 明确区分“主链路”和“遗留/旁路链路”。
- 不把“目标态”写成“现状”。
- 对 PHP 的描述以“当前仍承担哪些职责”为准，而不是直接写成“PHP 已废弃”。

## 1.1 当前分片设计口径

当前系统已经**永久移除 `parent_child` 父子分片模式**。

这里需要明确区分两件事：

- 已移除的是“把父块/子块当成一种独立分片模式”的设计。
- 仍然保留的是层级分片内部使用的层级树元数据。

当前有效口径如下：

- 系统只存在三类分片模式：普通分片、自动分片、层级分片。
- 层级分片按标题层级边界拆正文，实际写入向量库的分片文本直接包含文档标题、层级路径、当前标题和正文。
- `tree_node_id`、`parent_node_id`、`section_chunk_index` 仅用于层级树回显、同标题续切归并和顺序定位。
- 这些字段不是“父子分片模式”的遗留入口，也不代表系统仍支持父子分片。
- `document_nodes` 只是展示层树结构，不是后端存储/检索层的父子块模型。

## 2. 当前系统总览

当前知识库系统不是“纯 PHP”，也不是“纯 Go”。

更准确的现状是：

- 知识库主 API CRUD、文档主 API CRUD、分片 API CRUD、分片预览、分片 API similarity、rebuild，核心执行已经在 Go。
- 这些主 API 的最终响应结构现在也由 Go 定义并直出，PHP 不再对主知识库/文档/片段接口做 `Assembler + DTO + PageDTO` 二次封装。
- PHP 仍然承担权限校验、请求参数归一化、JSON-RPC 协议兼容、组织/用户上下文注入。
- 第三方文件的权限、来源展开和 Teamshare 取源仍通过 PHP/enterprise 侧 RPC 提供给 Go，但第三方文件正文解析已经统一下沉到 Go；项目文件仍通过 PHP RPC 提供访问端口。
- Flow/Teamshare 运行时的知识检索、片段写入、片段删除，已经通过 PHP app service + JSON-RPC 收口到 Go `svc.knowledge.fragment.runtime*`；PHP 侧仍保留权限、兼容接口外壳、表达式编排，以及一批未删除的历史 helper / subscriber 代码。

所以当前最准确的描述是：

- “主 API 已大幅 Go 化”
- “PHP 不是纯转发壳”
- “系统当前是 Go 主链 + Go runtime fragment RPC + PHP 边界层 + 少量待清理遗留代码”

## 3. 分层与职责边界

### 3.1 PHP 侧分层

PHP 侧当前主要承担四类职责：

1. Interfaces / Facade
   - HTTP API 入口
   - DTO 组装
   - 调用 AppService

2. Application
   - 权限校验
   - DataIsolation / BusinessParams 注入
   - JSON-RPC 调 Go
   - 主知识库/文档/片段接口已经收口为“原样透传 Go 响应”
   - 保留少量事件转发与兼容逻辑

3. Domain
   - 仍保留知识库、文档、分片的本地 domain service
   - 但主 API 已不再以这些 domain service 为唯一执行入口

4. Runtime adapters and legacy leftovers
   - Flow / Teamshare 节点与 tool 通过 PHP app service 调 Go runtime fragment RPC
   - `KnowledgeSearchNodeRunner` 仍在 PHP 做权限资源与表达式编排，但知识库基础数据改走 Go `knowledgeBase.queries`
   - 仓库里仍保留 `KnowledgeSimilarityManager`、fragment sync subscriber、collection / point 清理 subscriber 等历史代码，后续可继续收缩

### 3.2 Go 侧分层

Go 侧当前主要分为四层：

1. RPC / Interfaces
   - `internal/interfaces/rpc/jsonrpc/knowledge/...`
   - 负责请求映射、参数校验、错误转换

2. Application
   - `knowledgebase`
   - `document`
   - `fragment`
   - `rebuild`
   - 负责跨子域编排

3. Domain
   - `internal/domain/knowledge/...`
   - 负责实体、规则、同步计划、检索策略、rebuild 策略
   - `entity/model/repository/shared/metadata` 承载稳定领域模型与契约
   - `service` 只承载领域服务和业务规则，不再作为实体/Repository 的长期入口

4. Infrastructure
   - MySQL
   - Vector DB
   - PHP RPC ports
   - project / third-platform resolver
   - 允许依赖 domain 的稳定模型与契约
   - 禁止依赖 `internal/domain/**/service` 这类业务流程包

### 3.3 当前真实边界

当前真正的边界可以概括成一句话：

- “Go 负责知识库主 API、文档同步和 Flow/Teamshare runtime fragment 主链，PHP 负责权限、协议适配、外部取源，以及少量兼容与遗留外壳。”
- 在 Go 内部，`application` 负责跨子域编排，`interfaces` 只依赖 `application`，`infrastructure` 只实现稳定 domain 契约，不直接挂到 domain `service` 业务流程包上。

## 4. PHP / Go 职责矩阵（按当前代码）

### 4.1 已经由 Go 核心执行的主链路

以下能力，PHP 当前主要负责权限和 RPC 适配，真正执行业务的是 Go：

| 能力 | PHP 当前角色 | Go 当前角色 | 现状判断 |
| --- | --- | --- | --- |
| 知识库创建/更新/详情/列表/删除 | 权限校验、参数归一化、RPC 转发 | 实际执行 + 定义最终响应 | 主 API 已 Go 直出 |
| 知识库 rebuild | 组装参数、RPC 转发 | 实际执行 | 主 API 已 Go 化 |
| 修复历史来源绑定 | RPC 转发 | 实际执行 | 主 API 已 Go 化 |
| 文档创建/更新/详情/列表/删除 | 权限校验、参数归一化、RPC 转发 | 实际执行 + 定义最终响应 | 主 API 已 Go 直出 |
| 文档 `reVectorized` | 权限校验、状态校验、异步调度重向量化 | 实际执行 | 主 API 已 Go 化 |
| 按 third file 查询 document | RPC 转发 | 实际执行 | 主 API 已 Go 化 |
| 按 third file 触发重向量化 | RPC 转发 | 实际执行 | 主 API 已 Go 化 |
| 分片创建/查询/详情/删除 | 权限校验、RPC 转发 | 实际执行 + 定义最终响应 | 主 API 已 Go 直出 |
| 分片预览 | RPC 转发 | 实际执行 + 定义最终响应 | 主 API 已 Go 直出 |
| 分片 API similarity | RPC 转发 | 实际执行 + 定义最终响应 | 主 API 已 Go 直出 |

对应 PHP 代表实现：

- `app/Application/KnowledgeBase/Service/KnowledgeBaseAppService.php`
- `app/Application/KnowledgeBase/Service/KnowledgeBaseDocumentAppService.php`
- `app/Application/KnowledgeBase/Service/KnowledgeBaseFragmentAppService.php`
- `app/Infrastructure/Rpc/JsonRpc/Client/Knowledge/KnowledgeBaseRpcClient.php`
- `app/Infrastructure/Rpc/JsonRpc/Client/Knowledge/DocumentRpcClient.php`
- `app/Infrastructure/Rpc/JsonRpc/Client/Knowledge/FragmentRpcClient.php`

补充当前 Go 主链删除语义口径：

- 知识库删除：Go 主链为真删，删除知识库行前会先清空向量库、source binding、document、fragment 等关联数据。
- 文档删除：Go 主链为真删，先删向量点，再删 fragment，再删 document 行；批量清空知识库文档也是真删。
- 分片删除：Go 主链为真删。
- PHP 遗留旁路是否仍保留软删语义，不属于这份 Go 主链现状口径。

### 4.2 PHP 仍在执行的编排职责

这部分不能算“完全无逻辑”，但主接口层已经不再做响应 DTO 装配：

1. 权限与资源归属校验
   - `AbstractKnowledgeAppService::checkKnowledgeBaseOperation`
   - 当前没有独立的文档级权限模型；PHP 主要做知识库级权限校验，必要时读取 document / fragment 做归属与兼容参数校验

2. 协议兼容与字段归一化
   - `knowledge_code` / `knowledge_base_code`
   - `source_type` / `platform_type`
   - `third_id` / `third_file_id`
   - `model` / `embedding_config.model_id`
   - `document_file` payload 结构兼容

3. DataIsolation / BusinessParams 注入
   - 组织、用户、业务 ID 由 PHP 先补齐后传给 Go

4. 非主链兼容补洞
   - 主知识库/文档/片段接口已经不再在 PHP 侧组装 `PageDTO`
   - 企业兼容接口、Open/Admin 外壳、KnowledgeSearchNodeRunner 表达式编排和部分历史代码仍保留在 PHP

### 4.3 Flow / Teamshare runtime 已收口到 Go，PHP 保留边界职责

以下 runtime 入口当前已经不再在 PHP 本地直接做 embedding、查点、写点和删点：

| 能力 | 当前执行位置 | 说明 |
| --- | --- | --- |
| Flow 知识检索节点 v0/v1 | PHP 节点编排 -> Go `svc.knowledge.fragment.runtimeSimilarity` | PHP 负责表达式求值、DataIsolation 注入；Go 负责多库检索、route resolve 和结果返回 |
| Flow 向量存储节点 | PHP 节点编排 -> Go `runtimeCreate` | Go 内负责文档归属、保存 fragment，并在当前请求内同步写向量 |
| Flow 向量删除节点 | PHP 节点编排 -> Go `runtimeDestroyByBusinessId` / `runtimeDestroyByMetadataFilter` | metadata 删除不再走 PHP 本地查点删点 |
| AIImage 知识库 tool | PHP tool -> Go `runtimeSimilarity` | 与 Flow 节点共用同一 runtime 检索链路 |
| Teamshare 知识检索节点 v0/v1 | 企业包 PHP 节点编排 -> Go `runtimeSimilarity` | 与主仓 runtime 检索链路一致 |
| Teamshare 知识检索内置 tool | 企业包 PHP tool -> Go `runtimeSimilarity` | 与 Teamshare 节点共用 |
| deprecated Admin `fragmentSave` | PHP 兼容 facade -> Go `runtimeCreate` | 保留 `id` 兼容字段，但当前不是按 `id` 更新 fragment |
| deprecated Open 外部 fragment 直操接口 | PHP Open facade 直接返回成功 | `/open/external-api/magic/knowledge/fragment*` 已是 no-op，不再调用 Go |
| `KnowledgeSearchNodeRunner` | PHP + Go | 知识库基础数据来自 Go `knowledgeBase.queries`；权限资源筛选、表达式编排和结果集差集仍在 PHP |

当前仍保留在 PHP 的，更多是边界职责和旧代码，而不是这些 runtime 入口的执行真值：

- `app/Application/Flow/ExecuteManager/NodeRunner/Knowledge/KnowledgeSimilarityNodeRunner.php`
- `app/Application/Flow/ExecuteManager/NodeRunner/Knowledge/V1/KnowledgeSimilarityNodeRunner.php`
- `app/Application/Flow/ExecuteManager/NodeRunner/Knowledge/KnowledgeFragmentStoreNodeRunner.php`
- `app/Application/Flow/ExecuteManager/NodeRunner/Knowledge/KnowledgeFragmentRemoveNodeRunner.php`
- `app/Application/Flow/ExecuteManager/BuiltIn/ToolSet/AIImage/Tools/KnowledgeSimilarityBuiltInTool.php`
- `backend/magic-enterprise-service/src/Application/Flow/ExecuteManager/NodeRunner/Teamshare/TeamshareKnowledgeSimilarityNodeRunner.php`
- `backend/magic-enterprise-service/src/Application/Flow/ExecuteManager/NodeRunner/Teamshare/V1/TeamshareKnowledgeSimilarityNodeRunner.php`
- `backend/magic-enterprise-service/src/Application/Flow/ExecuteManager/BuiltIn/ToolSet/TeamshareBox/Tools/TeamshareKnowledgeSearchBuiltInTool.php`
- `backend/magic-enterprise-service/src/Application/Flow/Service/MagicFlowKnowledgeAppService.php`
- `backend/magic-enterprise-service/src/Application/Flow/ExecuteManager/NodeRunner/Search/KnowledgeSearchNodeRunner.php`

仓库里仍保留但不再是上述迁移入口必经路径的历史代码：

- `app/Application/KnowledgeBase/VectorDatabase/Similarity/KnowledgeSimilarityManager.php`
- `app/Application/KnowledgeBase/Event/Subscribe/KnowledgeBaseFragmentSyncSubscriber.php`
- `app/Application/KnowledgeBase/Event/Subscribe/KnowledgeBaseSyncSubscriber.php`
- `app/Application/KnowledgeBase/Event/Subscribe/KnowledgeBaseDestroySubscriber.php`
- `app/Application/KnowledgeBase/Event/Subscribe/KnowledgeBaseDocumentDestroySubscriber.php`
- `app/Application/KnowledgeBase/Event/Subscribe/KnowledgeBaseFragmentDestroySubscriber.php`

### 4.4 第三方与项目文件解析边界

这部分当前已经变成“Go 执行业务主链与文件解析，PHP 提供取源/展开端口”：

1. 第三方文档解析
   - PHP 提供：`svc.knowledge.thirdPlatformDocument.resolve`
   - `resolve` 返回 `source_kind/raw_content/download_url/doc_type/document_file`
   - Go 调用该端口后统一完成正文解析、同步、切片、预览和重向量化

2. 第三方来源展开
   - PHP 提供：`svc.knowledge.thirdPlatformDocument.expand`
   - Go 用于 source binding 物化时展开第三方文件

3. 项目文件解析
   - PHP 提供 project file RPC service
   - Go 用于 project source binding 物化与项目文件变更同步

这意味着：

- Teamshare / 第三方文件的权限、来源展开和下载地址/正文获取仍依赖 PHP
- 但真正的第三方文件正文解析、知识库文档同步、预览与重向量化主链已经在 Go

## 5. 当前核心数据模型

### 5.1 知识库

主表：`magic_flow_knowledge`

核心字段：

- `code`
- `name`
- `description`
- `type`
- `model`
- `vector_db`
- `business_id`
- `retrieve_config`
- `fragment_config`
- `embedding_config`
- `expected_num`
- `completed_num`
- `source_type`

当前语义：

- `business_id` 是知识库级外部绑定字段，不是 document 定位字段
- `source_type` 用于描述来源类型，但真正的来源运行态以 source binding 为准
- `knowledge_base_type` 才是产品线字段；`source_type` 不能反推产品线
- 当前 `source_type` 取值：
  - 旧向量知识库：`1 = 本地文件`，`4/1001 = 企业知识库（兼容 raw 值）`
  - 数字员工知识库：`1 = 本地文件`，`2 = 自定义内容`，`3 = 项目文件`，`4/1001 = 企业知识库（兼容 raw 值）`
- Go 侧另外维护统一语义映射，避免业务逻辑直接散落比较 raw int：
  - `1` => `local`
  - `2` => `custom`
  - `3` => `project`
  - `1001/4` => `enterprise`

产品线判定口径：

| 场景 | 先看什么 | 说明 |
| --- | --- | --- |
| 创建 | `agent_codes` | 非空即 `digital_employee`，为空即 `flow_vector` |
| 更新 | 存量 `knowledge_base_type` | 不按本次请求重新判产品线 |
| 详情 / 列表 / 下游消费 | 存量 `knowledge_base_type` | `source_type` 只能在已确定产品线下解释 |

禁止性规则：

- `source_type` 不能判产品线
- enterprise raw 值兼容 `4/1001`，业务判断只能看产品线 + 统一来源语义
- source binding 只能参与 flow 缺失 `source_type` 时的来源推断，不能覆盖创建时 `agent_codes` 的产品线判定

### 5.2 文档

主表：`knowledge_base_documents`

核心字段：

- `knowledge_base_code`
- `source_binding_id`
- `source_item_id`
- `auto_added`
- `code`
- `name`
- `doc_type`
- `document_file`
- `third_platform_type`
- `third_file_id`
- `sync_status`
- `sync_status_message`
- `embedding_model`
- `word_count`

当前语义：

- 文档已经是知识库运行时的一等对象
- 不只是上传文件记录
- 也是 source binding 物化后的托管 document
- 项目/企业知识来源统一通过 `source_binding_id`、`source_item_id` 和 `document_file` 衍生，不再依赖 `knowledge_base_documents` 上的旧 `project_*` 物理列
- `knowledge_base_documents.doc_type` 表示内部持久化的文档精确类型，不表示产品线，也不表示来源类型
- 内部持久化 `doc_type` 典型值应按语义名理解，而不是只看裸数字：
  - `DocTypeText = 1`
  - `DocTypeMarkdown = 2`
  - `DocTypePDF = 3`
  - `DocTypeCloudDocument = 1001`
  - `DocTypeMultiTable = 1002`
- 数字员工知识库里出现 `doc_type=1001/1002` 是合法的；这表示企业文档子类型，不表示它变成了 flow
- 主 API 响应顶层 `doc_type` 是前端历史契约里的“知识库来源类型”，由 Go RPC 兼容响应层按知识库产品线和 `source_type` 投影：
  - 数字员工知识库：本地文件 `1`，自定义内容 `2`，项目文件 `3`，企业知识库 `4`
  - flow 向量知识库：本地文件 `1`，企业知识库 `1001`
- 因此，内部 `knowledge_base_documents.doc_type=2` 的 Teamshare Markdown 文档，在数字员工企业知识库详情响应中顶层 `doc_type` 应返回 `4`
- 文档片段列表/详情和 similarity 响应同样遵循这个顶层 `doc_type` 契约：片段里的 `document_type` 表示内部精确文件类型，片段顶层 `doc_type` 表示知识库来源类型
- Teamshare 文件自身类型不借用顶层 `doc_type` 表达：
  - 原始 Teamshare 文件类型使用 `document_file.third_file_type` / `document_file.teamshare_file_type`
  - 文件扩展名使用 `document_file.extension` / `document_file.third_file_extension_name`
- 文档列表查询入参 `doc_type` 当前仍按内部持久化的精确文件/文档类型过滤，本次语义拆分不改变查询过滤口径
- 进入同步链路时另外还有一层 `DocumentInputKind` 三态：
  - `DocumentInputKindText = 1`
  - `DocumentInputKindFile = 2`
  - `DocumentInputKindURL = 3`
  - 它只描述输入形态，不等同于主表 `doc_type`

### 5.3 来源绑定

主表：

- `knowledge_source_bindings`
- `knowledge_source_binding_targets`
- `knowledge_source_items`
- `knowledge_source_binding_items`

当前 provider：

- `project`
- `teamshare`
- `local_upload`

它们共同表示：

- 知识库绑定了哪些来源
- 来源里有哪些 item 被解析出来
- 哪些 item 已经被物化成 document

### 5.4 片段

主表：`magic_flow_knowledge_fragment`

核心字段：

- `knowledge_code`
- `document_code`
- `document_name`
- `document_type`
- `content`
- `metadata`
- `point_id`
- `content_hash`
- `chunk_index`
- `section_path`
- `section_title`
- `section_level`
- `business_id`

当前语义：

- `document_code` 是标准归属字段
- `document_type` 是片段所属文档的内部精确文件/文档类型，通常来自 `knowledge_base_documents.doc_type`
- 片段主 API 和 similarity 响应里的顶层 `doc_type` 不等同于 `document_type`；它按知识库上下文投影为前端历史契约中的知识库来源类型
- `business_id` 仅保留兼容意义
- point 与 MySQL 片段记录仍然是双存储结构

### 5.5 向量数据

当前系统里的向量数据是双层结构：

1. MySQL
   - 保存知识库、文档、片段、来源绑定元数据

2. Vector DB
   - 保存 point、dense vector、sparse input、payload

当前 Go 主链已经按 hybrid retrieval 设计。

当前主文档同步、第三方重向量化、Flow/Teamshare `runtimeCreate` 都由 Go 写 point。

需要单独注意的是：

- 主 API `fragment.create` 仍是“确保 document / 保存 fragment 记录”的公共分片语义，不承担 runtime 立即写向量的职责
- PHP 仓库里仍保留历史 subscriber / manager 代码，但它们不再是当前已迁移 runtime 入口的必经路径

### 5.6 统一路由模型

当前 Go 主链已经把知识库运行时路由统一收口到一个完整对象：`ResolvedRoute`。

这个模型专门用来解决共享集合蓝绿重建时“逻辑名”和“物理名”并存的问题。

1. `collection_name`
   - 逻辑名
   - 面向业务语义，要求稳定
   - 表示“这套知识库共享集合”的身份

2. `physical_collection_name`
   - 当前 active 物理集合
   - 蓝绿切换后可能变化
   - 表示当前主链默认应该命中的真实向量集合

3. `ResolvedRoute.VectorCollectionName`
   - 本次执行真正用于向量读写删查的集合名
   - 允许被 rebuild override 改写
   - Go 主链里唯一允许传给 vector repo 的集合字段

4. `ResolvedRoute.TermCollectionName`
   - 本次执行真正用于 sparse / term namespace 的集合名
   - 默认与 `VectorCollectionName` 一致
   - 只有 rebuild 显式指定 `TargetTermCollection` 时才会分离

5. `ResolvedRoute.Model` / `ResolvedRoute.SparseBackend`
   - 描述本次执行的 embedding 模型与 sparse backend
   - override 优先于 collection meta，collection meta 优先于默认值

6. rebuild override
   - 只改变“本次执行命中哪里”
   - 不改变逻辑名定义本身
   - override 可以指向逻辑名，也可以直接指向目标 physical collection

当前边界已经明确：

- `rebuild/policy` 负责决定 active / shadow、target slot 和 cutover 条件
- `shared/route` 负责把 meta + override 解释成运行时命中结果
- Go 主链业务代码不能再自行判断该选逻辑名、物理名还是 override 字段

当前 `ResolvedRoute` 不只覆盖主 API，也覆盖了 runtime fragment 链路。

- Go 主 API CRUD / sync / similarity / delete / rebuild resync 已统一消费 `ResolvedRoute`
- Go `runtimeSimilarity` / `runtimeCreate` / `runtimeDestroy*` 也统一走 `ResolvedRoute`
- PHP 仓库里仍有历史代码保留，但不再是当前 Flow / Teamshare runtime 真值链路

## 6. Go 主链：知识库、文档、片段、检索

### 6.1 知识库创建与来源文档物化

入口：`KnowledgeBaseAppService.Create(...)`

当前主流程：

1. 先按 `agent_codes` 判产品线
   - 非空 => `digital_employee`
   - 为空 => `flow_vector`
2. 归一化 `source_bindings`
3. 在该产品线下解析 / 推断 `source_type`
   - `digital_employee` 缺失 `source_type` 直接报错
   - `flow_vector` 缺失 `source_type` 时，按 binding 语义推断 `1 / 1001`
   - 两条产品线显式传 `4 / 1001` 时，都按 `enterprise` 语义解释并保留 raw 值
4. 按统一来源语义校验 binding
5. 构造知识库实体
6. 解析统一运行时路由 `ResolvedRoute`
7. 持久化 `magic_flow_knowledge`
8. 若请求带 `source_bindings`
   - 替换 binding
   - 清空已有 managed documents
   - 根据 binding 物化出新的 document
   - 为每个 document 调度一次 `create sync`

当前建库主链已经不是旧式“直接带 `document_files` 逐个建文档”，而是“knowledge + source binding + document materialize”。

补充一点：

- Go 当前已经把 `source_type` 的兼容、产品线识别和统一语义判断收口在自身领域、应用层与 RPC 层。
- repository / mapper 对 `source_type` 采用 raw 值原样保存、原样读取，不做归一化改写。

知识库更新链路与创建不同：

- 更新时产品线固定以存量 `knowledge_base_type` 为准
- 不允许用本次请求里的 `source_type` 或 binding 重新判产品线
- flow 缺失 `source_type` 时，优先从当前 / 新 binding 恢复来源语义；数字员工缺失则直接报错

### 6.2 文档创建

入口：`DocumentAppService.Create(...)`

当前流程：

1. 按知识库上下文构造 document
2. 继承知识库级 route / model / config
3. 持久化 `knowledge_base_documents`
4. 若 `AutoSync=true`
   - 主 API `POST /documents` 默认异步调度一次 `create sync`
   - 接口返回新落库 document 当前状态，默认保持 `pending`
   - `sync_status/sync_status_message` 由后台任务推进更新
5. source binding materialize、project realtime auto-create 等内部托管文档链路仍保持“调度一次 `create sync`”

### 6.2.1 文档更新

入口：`DocumentAppService.Update(...)`

当前流程：

1. 读取 document 并应用更新 patch
2. 持久化 `knowledge_base_documents`
3. 如果本次更新没有改变实际生效的解析/分片配置，则直接返回
4. 如果本次更新触发重同步
   - 主 API `PUT /documents/{code}` 默认异步调度一次 `resync`
   - 接口返回更新后的当前 document 状态；是否进入 `syncing` 由后台 worker 真正开始执行时标记
   - 同步失败后的 `sync_failed` 状态由后台任务回写
5. 其他内部更新链路仍可以继续使用异步调度

### 6.3 文档同步

入口：`DocumentAppService.Sync(...)`

当前真实分流：

1. 取 document 并校验组织
2. 如果是 project file document，先尝试注入 `SourceOverride`
3. 如果是第三方 document 的 `resync`，且本次没有显式 override，则重定向到“按 third file 重向量化”；默认异步调度
4. 其余情况进入标准同步

标准同步流程：

1. 解析统一运行时路由 `ResolvedRoute`
2. 预检文档源
3. 标记 document 为 `syncing`
4. 解析内容
5. 切片构造 fragment
6. 同步 fragment 到 MySQL 与 Vector DB
7. 标记 document 为 `synced`

### 6.4 文档 `create` 与 `resync`

- `create`
  - 先清理旧 fragment / point
  - 走全量同步

- `resync`
  - 走增量 resync plan
  - 不再简单粗暴地“整文档先删后重建”

### 6.5 第三方文件重向量化

入口：

- `svc.knowledge.document.reVectorizedByThirdFileId`
- `DocumentAppService.ReVectorizedByThirdFileID(...)`

当前流程：

1. 归一化 `(organization_code, third_platform_type, third_file_id)`
2. 投 MQ 前先判断组织内是否存在 enabled + realtime 绑定下的映射 document
3. 执行时按 third file 查询所有 enabled + realtime 绑定命中的 document
4. 在 app 层批量过滤 `knowledge_base.enabled = true` 的目标知识库
5. 对过滤后的每个 document 直接生成一条自包含的 `document_sync` MQ task
6. 单文档 consumer 再按标准同步链解析最新 source、切片并写 MySQL / Vector DB

关键变化：

- 当前不是“third file 只能映射一个 document”
- 而是允许一个 third file fan-out 到多个 document
- third-file 入口不再向 MQ 投递 source task，也不再依赖 Redis state / wakeup recovery 补发
- 主文档 `reVectorized` 接口统一异步调度，不再提供 `sync=true` 强制同步执行
- 如果前端在 `PUT /documents/{code}` 成功后又额外调用一次 `/re-vectorized`，当前会重复执行一轮重向量化；主 API 本身不做这层短路

### 6.6 项目文件实时同步

入口：

- `svc.knowledge.projectFile.notifyChange`
- `DocumentAppService.NotifyProjectFileChange(...)`

当前流程：

1. 按 `project_file_id` 读取最新项目文件轻量元数据
2. 投 MQ 前先判断是否命中 enabled + realtime 项目来源绑定，或已存在 enabled + realtime 绑定物化出的 project-file document
3. 找出该 project 下所有 enabled + realtime binding 和当前已落库的 project-file document
4. 在 app 层批量过滤 `knowledge_base.enabled = true` 的目标知识库
5. 生成执行计划：
   - 删除失效 document
   - 重同步已有 document
   - 自动创建新命中的 document
6. 对需要同步的目标直接投递多条自包含的 `document_sync` MQ task
7. 真正执行单文档同步时：
   - 标准项目知识库通过 `svc.knowledge.projectFile.getLink` 取最新文件链接，再重新解析正文
   - 企业知识库按需先注入 `SourceOverride`，再进入标准同步链

这条链不走第三方重向量化逻辑，而是直接复用标准同步链。

RabbitMQ 文档同步当前只消费新版自包含 `document_sync` task 消息。可解码任务执行失败时会用 Redis 记录重试次数并 `Nack(false, true)` 重新入队，最多 requeue 10 次；第 11 次仍失败时会 ack 并调用终态处理，把文档落为 `document sync retry exhausted`，同时推进知识库级重向量化进度。Redis 计数 TTL 默认 1 天，任务成功或终态化后会清理计数。旧生产环境遗留的 wakeup 消息、缺字段消息、未知 task kind 或非法 JSON 会被 consumer 直接 ack 并记录 skip 日志，不读取旧 Redis state，不触发 recovery / delayed retry 补发。RabbitMQ 不可用或任务结构不符合新版 `document_sync` 时只跳过，不做本地内存同步。

### 6.7 分片 API 与 runtime 分片链路

入口：`FragmentAppService`

当前 Go 已同时承接“主 API 分片能力”和“Flow / Teamshare runtime 分片能力”：

- 分片创建
- 分片列表 / 详情 / 删除
- 分片预览
- 分片 similarity
- 旧第三方 fragment 初始化兼容
- `runtimeCreate`
- `runtimeSimilarity`
- `runtimeDestroyByBusinessId`
- `runtimeDestroyByMetadataFilter`

其中有几个容易混淆的点：

1. 主 API `Create(...)`
   - 仍是公共分片创建语义
   - 要求显式 `document_code` 或历史兼容 `metadata.file_id`
   - 负责确保 document + 保存 fragment 记录
   - 当前不会在这个公共入口里立即写向量点

2. `RuntimeCreate(...)`
   - 面向 Flow / Teamshare runtime
   - 输入已经是“最终片段内容”，不是走“上传文档 -> 解析正文 -> 自动切片”的文档导入链路
   - 若传了 `document_code`，优先挂到该文档
   - 若 `metadata.file_id` 命中历史第三方文档兼容路径，则复用或补建映射文档
   - 否则确保默认 document
   - 保存 fragment 后会在当前请求内调用 `SyncFragment(...)`，当前实现是同步写向量

3. `RuntimeSimilarity(...)`
   - 支持多 knowledge base
   - 面向 Flow / Teamshare runtime，Go 侧信任上游传入的 `knowledge_codes` 已经过助理/流程绑定约束，不再按当前执行用户逐库校验知识库 read 权限
   - 未显式传 `top_k / score_threshold` 时，整次检索沿用首个知识库的 `retrieve_config`
   - 检索结果按 `knowledge_codes` 顺序拼接，不做跨库全局重排
   - `question` 非空时用于 embedding query，否则回退到 `query`
   - 返回结果链路会补齐 `business_id`；历史点会通过 `FindByPointIDs(...)` 批量回填

4. `RuntimeDestroyByBusinessID(...)` / `RuntimeDestroyByMetadataFilter(...)`
   - 前者先按 `knowledge_code + business_id` 分页查 fragment，再统一批删 MySQL 与向量点；找不到目标时直接报错
   - 后者要求非空 filter；会先在向量库按 filter 扫 point，再批量 `FindByPointIDs + DestroyBatch`，不再走 PHP 本地删点

### 6.8 检索链路

入口：`FragmentAppService.Similarity(...)`

当前流程：

1. 先做检索权限判定
2. 再取 knowledge base
3. 解析统一运行时路由 `ResolvedRoute`
4. 进入 retrieval service
5. 根据知识库配置执行：
   - legacy similarity search
   - enhanced similarity search
6. enhanced 模式下执行：
   - query rewrite
   - hard / soft filter
   - dense 命中 `VectorCollectionName`，sparse 命中 `TermCollectionName`
   - 候选重打分

这条链已经是 Go 主 API 的检索真值。

补充边界：

- 普通 `svc.knowledge.fragment.similarity` 对显式 `knowledge_base_code` 的权限语义是：如果该知识库在当前组织绑定了 `super_magic_agent`，则按当前用户是否可访问任一绑定 agent 判定；如果没有绑定 agent，则回退到知识库 read 权限。
- `svc.knowledge.fragment.similarityByAgent` 先校验当前用户可访问该 agent，再只在该 agent 绑定且 `enabled=true` 的知识库中检索。
- Flow / Teamshare `svc.knowledge.fragment.runtimeSimilarity` 信任上游绑定校验，只按传入知识库做组织范围加载、enabled 校验和检索。
- 显式指定 `knowledge_base_code` 的普通 fragment similarity 仍然不受知识库启用状态影响。

## 7. Flow / Teamshare runtime 与仍保留的 PHP 代码

### 7.1 当前 runtime 真值链路

迁移后的 Flow / Teamshare runtime 入口已经统一到 Go `svc.knowledge.fragment.runtime*`：

1. 检索
   - Flow 节点、AIImage tool、Teamshare 节点、Teamshare tool 都通过 `KnowledgeBaseFragmentAppService::runtimeSimilarityByDataIsolation(...)`
   - PHP 负责表达式求值、知识库 code 收集、DataIsolation / BusinessParams 注入
   - Go 负责加载 knowledge base、resolve route、执行多库检索并返回统一结果

2. 写入
   - Flow 向量存储节点和 deprecated Admin `fragmentSave` 都改走 `runtimeCreate`
   - deprecated Open 外部 `fragmentSave` 当前在 PHP Open facade 直接返回成功，不再调用 Go
   - 当前语义是“写入一条已经准备好的 runtime fragment”
   - 不是“先创建文档，再交给 Go 解析文档并自动切片”的文档导入规范链路

3. 删除
   - Flow 向量删除节点的 `business_id` 删除改走 `runtimeDestroyByBusinessId`
   - Flow 兼容入口的 metadata 删除改走 `runtimeDestroyByMetadataFilter`
   - deprecated Open 外部 fragment 删除和 metadata 删除当前在 PHP Open facade 直接返回成功，不再调用 Go
   - 删 fragment 和删 point 的实际执行都已经在 Go

4. 列表匹配
   - `KnowledgeSearchNodeRunner` 不再直接查 PHP `KnowledgeBaseModel`
   - 基础数据改走 Go `knowledgeBase.queries`
   - `=` / `contains` 尽量下推到 Go 查询；`!=` / `not contains` 仍由 PHP 做结果集差集

### 7.2 `runtimeCreate` 的真实语义

`runtimeCreate` 当前是“runtime 手工写片段”能力，不是文档同步链路的缩写版。

它的当前行为是：

1. 先读取知识库并解析运行时路由
2. 根据输入决定 fragment 挂载到哪个 document
   - 优先使用显式 `document_code`
   - 否则兼容历史 `metadata.file_id`
   - 都没有时，落到默认 document
3. 先保存 MySQL fragment 记录
4. 再在当前请求内调用 `SyncFragment(...)` 写 embedding / point

所以当前实现下：

- runtime 写入是同步写向量的
- 同一条 flow 后续节点可以立即检索到刚写入的片段
- 它遵循的是“知识库已存在，runtime 直接写片段”的语义，而不是“上传原文档后再解析出片段”的文档导入语义

### 7.3 PHP 当前仍承担的职责

即使 runtime 已迁到 Go，PHP 仍不是纯转发壳，当前还承担：

1. 主 API 和 runtime 写入/删除的知识库级权限校验、runtime similarity 上游绑定约束、组织/用户上下文注入、BusinessParams 组装
2. Open/Admin 兼容 HTTP 外壳与 Teamshare open token 鉴权
3. `KnowledgeSearchNodeRunner` 的权限资源选择、表达式编排和结果集集合运算
4. Teamshare / 第三方来源展开、取源、权限与租户上下文相关 RPC

### 7.4 仍保留但已不是当前 runtime 入口真值的历史代码

仓库里仍保留若干旧 helper / subscriber：

- `KnowledgeSimilarityManager`
- `KnowledgeBaseFragmentSyncSubscriber`
- `KnowledgeBaseSyncSubscriber`
- `KnowledgeBaseDestroySubscriber`
- `KnowledgeBaseDocumentDestroySubscriber`
- `KnowledgeBaseFragmentDestroySubscriber`

这些代码说明 PHP 侧历史上确实做过本地 embedding、写点、删点和 collection 管理，但就当前迁移后的 Flow / Teamshare runtime 入口来说，它们已经不是必经路径，更适合作为下一批清理对象。

## 8. rebuild 与历史修复

### 8.1 rebuild

入口：

- PHP：`KnowledgeBaseAppService::rebuild(...)`
- Go：`svc.knowledge.knowledgeBase.rebuild`

当前 rebuild 真正执行在 Go。

执行前 Go 还会先做 `PrepareRebuild(...)`：

1. 对 knowledge base / organization / all scope：
   - 补齐或 bootstrap source binding
   - 清空知识库下托管 document
   - 重新物化 document

2. 然后 Runner 再执行：
   - mode 选择
   - collection alias / physical collection 管理
   - 批量 document resync
   - bluegreen 切换

### 8.2 RepairSourceBindings

入口：

- PHP：`KnowledgeBaseAppService::repairSourceBindings(...)`
- Go：`KnowledgeBaseAppService.RepairSourceBindings(...)`

当前流程：

1. 扫描历史 third-file repair group
2. 规划缺失的 teamshare binding
3. 物化缺失 document
4. 按 third file 回填 fragment 的 `document_code`

### 8.3 fixlegacy

Go 侧仍保留 `fixlegacy` 工具链，用于：

- 扫描 `document_code` 为空的历史 fragment
- 补默认 document
- 回填 `document_code`
- 重新同步这些 fragment

这不是运行时主链，而是历史数据修复工具。

## 9. 当前阶段的关键判断

截至当前仓库现状，可以得出以下结论：

1. 知识库主 API 的核心执行已经大幅收口到 Go。

2. PHP 当前不是纯转发壳。

3. Teamshare / 第三方文件的权限、来源展开和取源仍依赖 PHP 提供 RPC 端口；第三方文件正文解析已统一在 Go。

4. Flow / Teamshare runtime 的知识检索、片段写入、片段删除，以及 Admin 兼容 `fragmentSave` / Flow metadata delete，当前已经收口到 Go runtime fragment RPC；deprecated Open 外部 fragment 直操接口当前由 PHP 直接返回成功。

5. 当前系统的边界更准确地说是：
   - 主 API、文档同步、runtime fragment 读写删走 Go
   - 权限、协议兼容、外部取源、KnowledgeSearchNodeRunner 表达式编排仍在 PHP

6. 下一步真正值得继续清理的，不是主 CRUD 或已迁移 runtime 入口，而是仓库里仍保留的历史 helper / subscriber，以及其他尚未确认的非主链调用点。

## 10. 后续维护建议

如果今后继续维护这一份统一文档，建议用下面的判断标准更新内容：

1. 这条能力的核心业务执行是不是已经进入 Go application / domain 主链。
2. PHP 是否只做权限、DTO、上下文和外部取源，而不再直接碰 embedding、切片、向量库和第三方文件正文解析。
3. 当前入口是否已经切到 Go runtime RPC，还是仍停留在 PHP 本地执行。
4. 历史 helper / subscriber 是否仍是必经路径，还是只剩代码存量待清理。

只有这四点同时满足，才应把某项能力标记为“已完全收口到 Go”。

## 11. 一句话总结

当前知识库系统已经进入“Go 主链 + Go runtime fragment RPC + PHP 边界层 + 少量历史遗留代码”阶段。

主 API、文档同步和 Flow / Teamshare runtime 片段链路，Go 已经是核心执行者；后续收口重点不在 CRUD 本身，而在继续清理 PHP 侧仍保留的历史 helper / subscriber，以及排查是否还有新的旁路入口。
