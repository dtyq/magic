# Agent Engineering Rules

本文件适用于整个 `super-magic` 项目。

本项目只支持 Linux/macOS。代码、路径处理和运行命令按 POSIX 语义实现，不主动增加 Windows 盘符、UNC 路径、反斜杠分隔符转换或 Windows 专属运行分支。

## 1. 先贴合项目，再考虑抽象

- 优先复用现有命名、目录、机制、文件结构
- 不要轻易发明新概念、新 ID、新层级、新 sidecar 文件
- 现有结构能承载时，不要新建体系

## 2. 避免过度设计

- 不要为了"未来可能需要"而提前引入复杂抽象
- 不要写没有新增语义的包装层
- 抽象只有在满足以下至少一项时才成立：新增语义、屏蔽复杂性、减少重复决策、显著降低错误率
- AGENTS.md 只保留影响全项目开发的长期规则；具体模块的行为、配置、阈值和设计原因写在对应代码注释中。
- 修改既有机制前先理解调用关系和历史约束；不要借局部需求改变无关的权限、性能保护、异常恢复或生命周期。

### 用行为对照和具体例子解释代码

- 注释应让维护者看懂业务含义、判断依据和行为边界，不只复述函数名或语法。涉及开关、自动与手动操作、状态流转、部分完成或容易混淆的职责时，主动用简短对照表、前后示例或数据流程解释。
- 不以注释越少越好为目标。关键取舍要写清楚；简单赋值不逐行解释，同一规则放在职责归属处，避免到处重复。示例使用通用业务和具体输入／结果，不依赖当前对话背景。
- 注释只描述真实契约和已确认的取舍。不要用低概率假设堆砌复杂解释，也不要为了让注释成立而增加无必要的检查或状态。

示例一：说明开关影响什么、保留什么。

```python
# | 操作         | 自动同步关闭后             |
# | 定时同步     | 不再自动执行               |
# | 用户手动同步 | 仍可执行，遵守原有权限     |
# 开关只控制自动调度，不改变同步能力和访问权限。
```

示例二：用具体结果说明状态含义。

```python
# 例：批量处理 4 项，3 项成功、1 项失败。
# 保留 3 项已完成结果，同时返回失败项及原因；不能把整批标成全部成功。
```

### 用行为对照和具体例子解释代码

- 注释应让维护者看懂业务含义、判断依据和行为边界，不只复述函数名或语法。涉及开关、自动与手动操作、状态流转、部分完成或容易混淆的职责时，主动用简短对照表、前后示例或数据流程解释。
- 不以注释越少越好为目标。关键取舍要写清楚；简单赋值不逐行解释，同一规则放在职责归属处，避免到处重复。示例使用通用业务和具体输入／结果，不依赖当前对话背景。
- 注释只描述真实契约和已确认的取舍。不要用低概率假设堆砌复杂解释，也不要为了让注释成立而增加无必要的检查或状态。

示例一：说明开关影响什么、保留什么。

```python
# | 操作         | 自动同步关闭后             |
# | 定时同步     | 不再自动执行               |
# | 用户手动同步 | 仍可执行，遵守原有权限     |
# 开关只控制自动调度，不改变同步能力和访问权限。
```

示例二：用具体结果说明状态含义。

```python
# 例：批量处理 4 项，3 项成功、1 项失败。
# 保留 3 项已完成结果，同时返回失败项及原因；不能把整批标成全部成功。
```

## 3. 明确区分内容受众

- `ToolResult.content` 给大模型读，必须是人类可读、可继续推理的自然语言，默认英文，通常不额外维护双语版本
- `ToolResult.data` 给前端或调用方消费，存放结构化数据
- `ToolResult.extra_info` 仅用于 Python 项目内部，不给前端，不进入模型上下文
- 面向用户或前端展示的 `remark` / `action` 要走 i18n，不要硬编码语言
- 不要混淆模型文案、日志文案、展示文案，也不要把 JSON 或程序内部结构直接塞进 `content`
- **所有会进入模型上下文的内容一律使用英文**。判断标准：这段文字是代码生成的、最终会被 LLM 读到吗？是 → 英文。用户自己输入的内容不受此约束，只有代码生成的文案需要遵守。

`ToolResult` 创建方式：

```python
return ToolResult(content="操作完成")                                    # 成功
return ToolResult(content="操作完成", data={"key": "value"})             # 成功带数据
return ToolResult.error("文件不存在")                                    # 失败
return ToolResult.error("转换失败", extra_info={"path": "/tmp/file"})    # 失败带内部数据
```

合法字段：`content`（必填）、`ok`、`data`、`extra_info`、`system`、`execution_time`、`tool_call_id`、`name`、`use_custom_remark`。

### 3.1 时间展示必须人类友好并带时区

- 所有展示给用户或进入模型上下文的时间，都必须是人类友好的时间文本，并且明确带时区
- 适用范围包括但不限于：`ToolResult.content`、`ToolDetail`、工具友好提示、摘要、报告、Markdown 详情页
- 不要把裸 Unix timestamp、毫秒时间戳、无时区 ISO 字符串直接展示给用户或放进模型可读正文
- `ToolResult.data` / `data_view` 面向程序消费，默认保留来源原始值即可；不要为了展示或模型阅读，在结构化数据里额外塞格式化时间副本，除非该字段本身就是稳定对外契约
- 时间展示时优先使用数据来源明确给出的时区；如果来源没有可靠时区，使用 `UTC`，不要静默使用服务器本地时区
- 面向特定区域且产品语义稳定的来源，可以使用该来源的产品时区；国际化或跨区域来源默认使用 `UTC`
- 推荐格式：`YYYY-MM-DD HH:mm:ss UTC` 或 `YYYY-MM-DD HH:mm:ss UTC+08:00`
- 同一个工具的一次输出中，时间格式、精度和时区口径必须一致
- 如果原始时间字段可能是秒级或毫秒级时间戳，必须先规范化再展示，避免出现年份错误

### 3.2 ToolResult 在 Code Mode 中的默认读取规则

- `ToolResult.content` 是工具提供给模型的语义接口。无论成功或失败，都必须清楚说明执行状态、实际结果和必要的下一步信息，使模型只读 `content` 也能理解发生了什么并继续推理
- `ToolResult.ok` 表示该工具所定义的业务操作是否成功，供代码做程序化分支判断，不是 `content` 的替代。不能只因请求完成、进程正常退出或代码未抛异常就返回 `ok=True`
- `ok` 的成功标准由工具的业务契约决定。合法的空结果可以是成功；部分完成是否成功取决于该工具是否将其定义为有效结果。遇到空结果或部分完成时，`content` 必须清楚说明实际状态、完成范围和未完成原因
- `ok` 与 `content` 的语义必须一致。发现现有工具将技术执行成功误报为业务成功，或结构化状态与模型可读说明矛盾时，应修正工具实现
- `ToolResult.data` 是结构化编排接口，主要用于跨工具传递精确 ID、句柄、路径等字段，处理大数据量，连接同一管线的中间节点，或执行必须依赖结构化字段的程序分支
- Skill 和 Code Mode 示例默认应打印并阅读 `result.content`。只有确实需要程序化编排时才读取 `result.data`，不要在 `content` 已足够时从 `data` 重新拼装一份语义摘要
- 大型 `data` 不得完整打印进模型上下文。应在代码中完成筛选、聚合或校验，只输出结论、相关证据和后续所需的少量精确字段
- 工具实现不能因为已经返回 `data` 就降低 `content` 质量；两者服务不同用途，`content` 必须始终能独立支持模型理解和继续决策
- `ok=False` 不表示代码必须立即终止。调用方应先保留或输出 `content`，再根据步骤间的依赖关系决定重试、改用其它路径、继续独立步骤或向用户说明；只有该结果是后续步骤的必要前置时才终止管线

- 面向不同受众的结果转换，应在各自统一出口处理；不得原地改写其它消费者仍持有的共享对象，也不得改变业务状态或调度信号。
- 截断、预览或文件化都必须说明完整性；不能把交付成功当成业务成功，也不能为恢复输出自动重复有副作用的操作。

## 4. 给你（当前这个助手）的规则

- 给用户看的所有内容——对话回复、方案说明、计划文档、`docs/plans/` 下的 Markdown——使用用户当前使用的语言
- 不要因为项目内部 prompt 要求英文，就把给用户看的方案文档也写成英文，这是两件事
- 解释复杂问题时先说背景，再分清层次，然后说明为什么会发生、要怎么处理、为什么这种处理是对的。优先用用户能直接理解的业务语义和系统角色讲清楚，不要一上来堆实现细节、缩写和内部名词。
- 当问题涉及多层语义时，先判断每一层分别服务谁、解决什么问题、依赖什么事实，再决定哪一层应该改、哪一层不应该改。解释和修复都要围绕这些边界展开，不要把某一层的规则混到另一层里。
- 给用户说明方案时，默认使用“说人话版”：短句、常用词、少术语；必要术语必须先解释它在当前场景里扮演什么角色，再给出代码层面的名字。

## 5. 所有进入模型上下文的内容必须高质量

### 5.1 适用范围

- `@tool()` 类的 docstring、参数 description、get_prompt_hint() 返回内容都会进入模型提示词
- prompt 文件中的正文、agent 组装后的静态提示内容，也按同样标准处理

### 5.2 通用质量要求

- 这些内容必须简洁、高密度、讲人话，避免翻译腔和实现噪音
- 不要把低质量文案、低密度注释、冗长解释直接放进工具提示词
- docstring 与参数 description 分工明确：docstring 只保留核心用途，参数语义在 description 中完整描述，两者不重复
- 不用符号（`**`、`✓`、`✗`、`❌`）标注重点，改用文字（应该、不要、[正确]、[错误]），确保各模型稳定理解
- 精简时务必保证信息完整性，不因小失大

### 5.3 示例、协议与推荐写法

- 示例使用通用占位符，不用真实姓名、路径、ID；提供具体判断标准、操作指导或正反示例，而非空泛描述
- 考虑实际上下文结构，明确告诉 AI 如何获取所需信息

#### 5.3.1 解析器宽兼容，提示词只推荐一种写法

- 总原则：解析器要尽量接受各种自然变体（旧写法、自闭合与否、单双引号等），提示词、技能文档、示例负责窄推荐。解析器应尽量兼容常见变体、旧写法与自然写法；提示词层只推荐一套最常见、最稳定、最少歧义的主写法。
- 不要把所有兼容写法都暴露给模型；兼容面属于运行时兜底，不属于提示词教学内容，否则会让模型输出发散、增加长期维护成本。
- 新增或调整语法时，先确认解析器已兜住旧写法和高频自然写法，再决定是否把新写法升级为默认推荐写法。
- [正确] 解析器同时兼容 `![alt](a.png)`、`<img src="a.png">`、`<img src="a.png" />`，但提示词只推荐其中一种主写法。
- [错误] 把所有兼容写法都写进技能文档，让模型在 Markdown、HTML、自定义标签之间来回切换。
- 适用场景：自定义标签协议、工具参数格式、结构化输出格式、命令片段模板等"模型来写、程序来解析"的地方。

#### 5.3.2 Skill、Code Mode 与直接挂载工具的边界

- `Skill` 是能力说明的按需加载入口，解决“什么时候把什么说明送进模型上下文”的问题
- `Code Mode` 是“模型先生成代码，再由代码调用工具”的执行模式，不属于 Skill 私有能力；Skill 只是它的常见承载方式之一
- `直接挂载工具` 是工具本身直接暴露给模型；此时模型主要依赖工具自己的 docstring、参数 description、`get_prompt_hint()` 来理解如何使用工具
- `Code Mode` 的典型形态：
  ```python
  from sdk.tool import tool

  result = tool.call("call_subagent", {
      "agent_name": "explore",
      "prompt": "Analyze the target module and summarize key risks.",
  })
  print(result.content)
  ```
- 其运行链路是：模型先生成 Python 代码，代码由 `run_sdk_snippet` 等执行环境运行，再通过 SDK 发起真实工具调用；因此 Code Mode 本质上是“代码调工具”，不是“Skill 专属工具”
- Skill 与直接挂载工具是两条并行能力链路，不是互斥关系；Skill 可以补充高层工作流、长示例、多步决策
- 但只要某个工具仍可能被直接挂载给模型，它自身的提示词就必须足以支持独立使用；不要因为“这个能力已经写进 Skill”就把本应留在工具上的关键信息转移走
- 只有在明确取消直接挂载工具入口并完成统一迁移后，才可以同步收缩该工具面向模型的高层提示内容
- 判断标准：如果模型完全不读 Skill、只看工具定义，是否仍能正确理解并使用这个工具？如果不能，说明你把本应属于工具的信息错误地转移到了 Skill
- `@tool(code_mode_only=True)` 是上述规则的明确例外：它只作为 Code Mode 的执行底座，不提供直接挂载入口。完整的模型使用说明、参数组合、返回值和示例必须维护在对应 Skill；工具代码只保留最小 schema 语义和运行时错误信息
- CodeModeOnly 工具类附近必须用普通代码注释标明对应 Skill 的仓库路径。修改这类工具的模型提示词前，先检查并优先更新对应 Skill，避免把完整说明重新写回 Python

### 5.4 双语注释的适用范围与语言要求

`<!--zh -->` 中文注释由 `annotation_remover.py` 在内容进入模型前自动剥离，给模型看的有效正文使用英文，中文仅作开发者注释。双语格式统一采用"中文注释在上，英文正文在下"，避免中英混排。

**允许使用双语格式的场景**（代码会自动剥离中文部分）：

- `.agent` 文件的 prompt 正文（frontmatter 后的内容）
- `.prompt` 文件（由 `SyntaxProcessor` 处理）
- 工具类（`@tool()`）的 docstring（工具描述）
- 工具参数的 `Field(description=...)` 字符串
- `get_prompt_hint()` 的返回值

**禁止使用双语格式的场景**：

- `SKILL.md` 及 skill 目录下的引用文件——Skill 文档直接面向 agent，必须直接写高质量英文
- `.agent` / `SKILL.md` 的 frontmatter YAML 字段——不经过注释剥离，写了会原样进入模型
- Python 普通注释（`#`）、非工具类的 docstring——不进入模型，直接用中文写即可
- `AGENTS.md`、`guides/`、`docs/` 等人类文档——直接用中文写即可

### 5.5 双语格式与书写方式

- 短内容使用行内格式：`<!--zh: 中文说明-->` 下一行写英文正文
- 长内容使用块格式：
  ```text
  <!--zh
  中文说明
  可以多行
  -->
  English content
  Can be multiple lines
  ```
- `Field(description=...)` 跨行时用三引号包裹，写成双语结构：
  ```python
  description="""<!--zh: 中文说明-->
  English description"""
  ```
- `get_prompt_hint()` 返回多行内容时，用三引号与 `\` 起始，避免缩进影响：
  ```python
  def get_prompt_hint(self) -> str:
      return """\
  <!--zh
  中文内容
  -->
  English content
  """
  ```
- 复杂内容优先用整块注释，不要写成一行中文一行英文的交错结构：
  ```text
  # 不推荐
  <!--zh: 第一行-->
  Line 1
  <!--zh: 第二行-->
  Line 2

  # 推荐
  <!--zh
  第一行
  第二行
  -->
  Line 1
  Line 2
  ```

### 5.6 翻译要求

- 翻译按语义块进行，不要逐句硬对齐；英文必须完整保留中文语义，不能为了省 token 擅自简化、漏译或改写约束
- 英文要地道、准确，不能为了精简丢失关键信息。例如中文写"务必根据用户使用的语言命名"，英文不能只写"Name files appropriately"，应写"Must name according to the user's language"
- 涉及语种的描述不要写死示例，改用条件式：用户使用中文时…、用户使用英文时…、用户使用日文时…

### 5.7 提示词体积控制

- 修复 Agent 误用时，先从全局结构优化，不要为每次错误追加一段特例提示词
- 优先替换、合并或移动低频内容，尽量让主 Skill 体积小幅增加甚至不变
- 主 Skill 只放高频决策原则和入口；字段细节、排障代码、低频能力放到 reference/schema
- 新增提示词前先问：这句话能否举一反三？能否替换已有低效文字？是否只是在修一个单点错误？

### 5.8 数据工具 Skill 编写原则

- 数据工具同样遵循 3.2 的默认读取规则；`result.data`、`data_view` 只用于结构化编排，不替代 `result.content` 的模型语义
- 主 Skill 不堆 data schema 字段清单；字段契约写进 reference/data-schema.md 或 reference/xxx-data-schema.md 中
- schema 必须说明字段可能缺失、为空或类型随上游变化
- schema 应提供结构查看方法：字段取不到时先打印 `data_view` 的 keys、类型和少量截断样例，不要将大量完整数据打印到 Agent 上下文中
- 新增或修改数据工具时，验收必须覆盖三层：上游响应非空、formatter 后的 `data_view` 关键字段非空、`result.content` 对模型可读；不能只用 HTTP 200 或原始 payload 非空判断可用

### 5.9 数据工具的用户展示与模型上下文要分开

- `result.content` 是给 Agent 继续分析和传参用的，可以保留下一步工具需要的 id、cursor、offset、token 等字段
- `ToolDetail` 是给用户看的，只展示用户能理解的内容；不要把内部技术字段直接放进去，头像、封面、图片、视频这类媒体不要直接展示一长串 URL；能渲染就渲染成图片或视频控件，视频可以保留下载链接
- Markdown 里混用 HTML 时要生成块级结构，媒体块和列表、正文之间留空行，避免图片、视频、列表文字挤在同一段里
- 不要把 raw dict、完整原始 payload 或 `result.content.splitlines()` 直接塞进详情页；哪怕是低频 Reference 工具，也要整理成人能读懂的摘要
- 同一个字段在不同来源里可能不是同一个口径；不确定时宁可说明缺失或单独展示，不要悄悄覆盖已有字段
- ToolDetail 中的图片必须使用 `<img>` 标签并通过 `style="max-height:Xpx"` 限制最大高度，避免大图撑满屏幕。不要用 `height` 属性（固定高度会导致非正方形图片变形）。标准写法：`<img src="URL" alt="描述" style="max-height:240px">`。各平台 `_base.py` 的 `markdown_image()` 已统一实现此规范，新增平台必须复用同一模式

## 6. 命名与展示文案要有产品感

- 所有会展示给前端或用户的命名与文案，都不要使用生硬的接口腔、论文腔、实现腔表达
- 优先使用贴近真实产品心智、任务流转和用户感知的表达
- 先表达用户能理解的动作、状态和结果，再避免暴露底层 RPC 概念、内部对象名和实现细节
- Skill 的 `description` 只写触发条件，用来帮助 Agent 判断何时加载 Skill；不要把原理、工作流等说明塞进 description
- 高成本或低频能力要做成单独工具，并在 Skill 中提示“需要时再调用”；不要并入默认详情工具，避免每次普通分析都多花成本

## 7. 强类型优先，但不要为了类型而复杂化

- 稳定闭集字段优先使用 `Enum` / `StrEnum`
- 明确结构优先使用 dataclass 或模型，不要滥用 `Dict`
- 尽量减少不必要的 `Optional` / nullable
- 内部稳定契约对象要直接访问字段，不要用 `getattr(obj, "field", default)` 掩盖契约缺失。缺字段应尽早暴露，说明上游对象、测试桩或类型定义需要修正
- `getattr` 只用于边界层和弱契约对象，例如第三方 SDK 返回、历史 JSON、外部 payload、可选能力探测、日志/调试里的最佳努力展示。进入核心业务路径前应转成明确类型
- 单元测试里的 mock / `SimpleNamespace` 必须补齐真实对象契约字段；不要为了迁就测试桩而放宽生产代码字段访问
- 不要为了"类型完美"引入复杂状态机、过多子类或额外生命周期体系
- 函数返回多个相关值时，用 dataclass 而不是裸元组——字段名比位置索引更能表达语义，也避免调用方写出 `a, b, c = foo()` 后不清楚各位含义。判断标准：如果调用方必须靠注释或文档才能理解元组各位是什么，就应该换成 dataclass

## 8. 减少不确定性，但不能降低运行时稳定性

- 优先做最小收紧：补必填字段、补枚举、补轻量校验、补兼容兜底
- 不要做会显著增加异常面、破坏旧数据兼容、提高调用脆弱性的"理论正确"改造

## 9. 对 nullable 保持警惕

- 大量 `Optional` 往往说明状态设计不清晰
- 优先让"必然有值"的字段非 nullable
- 阶段性字段可以 nullable，但要用最小必要校验约束合法组合

## 10. 文件操作必须使用异步工具

本项目运行在 asyncio 事件循环中。**任何** Python 代码中的文件操作都必须使用 `app/utils/async_file_utils.py` 提供的异步函数。

禁止的写法（会阻塞事件循环）：

- `open()` / `with open(...)` — 用 `async_read_text` / `async_write_text` / `async_read_json` 等替代
- `os.path.exists()` / `Path.exists()` — 用 `async_exists` 替代
- `os.stat()` / `Path.stat()` — 用 `async_stat` 替代
- `os.rename()` / `Path.rename()` — 用 `async_rename` 替代
- `os.mkdir()` / `Path.mkdir()` — 用 `async_mkdir` 替代
- `os.remove()` / `os.unlink()` — 用 `async_unlink` 替代
- `shutil.copy2()` / `shutil.copytree()` / `shutil.rmtree()` — 用 `async_copy2` / `async_copytree` / `async_rmtree` 替代
- `json.load(open(...))` — 用 `async_read_json` / `async_try_read_json` 替代
- `os.scandir()` / `Path.iterdir()` — 用 `async_scandir` / `async_iterdir` 替代

这条规则没有例外。包括工具类、监听器、启动逻辑、辅助函数在内的所有 async 上下文中的文件操作，一律使用异步版本。

可用函数：

| 操作 | 函数 |
|------|------|
| 读文本 | `async_read_text` / `async_try_read_text`（不抛异常版） |
| 写文本 | `async_write_text` / `async_write_text_with_retry`（失败自动重试版） |
| 读二进制 | `async_read_bytes` |
| 写二进制 | `async_write_bytes` |
| 读/写 JSON | `async_read_json` / `async_write_json` / `async_try_read_json`（不抛异常版） |
| 读 Markdown | `async_read_markdown` / `async_try_read_markdown`（不抛异常版） |
| 统计行数 | `async_count_text_lines` / `async_try_count_text_lines`（不抛异常版） |
| 复制文件 | `async_copy2` |
| 复制目录 | `async_copytree` |
| 重命名/移动 | `async_rename` |
| 删除文件 | `async_unlink` |
| 删除目录 | `async_rmtree` / `async_rmdir` |
| 创建目录 | `async_mkdir` |
| 检查存在 | `async_exists` |
| 获取 stat | `async_stat` |

## 11. `.topic` / `.workspace` 网络挂载文件写入规范

`.topic` 和 `.workspace` 通常通过 AGFS 挂载，底层文件对象会映射到
`magic_super_agent_task_files`。在这些目录中，文件系统操作不只是本地磁盘操作：
一次 `create + rename/replace` 可能被 AGFS/magic-service 记录为“创建新的
file_id，再软删除旧记录”。因此，**同一个逻辑文件的重复覆盖不能默认使用临时文件
加 rename/replace**。

### 11.1 默认目标

- 同一个逻辑路径（同一父目录、同一文件名）应尽量复用已有的活跃文件记录和 `file_id`。
- 文件内容应先在本地临时目录完整生成、校验，再写回网络挂载目录。
- 写回网络挂载目录时，优先对已有目标执行直接覆盖写；不要为了“原子替换”在挂载目录
  中创建额外临时文件。
- 只有在确认 AGFS 对该类文件的原位写入仍会生成新 `file_id` 时，才引入
  magic-service/AGFS 的按 `file_id` 更新内容接口。

### 11.2 推荐写法

适用于 `merged_metadata.json`、任务状态 JSON、checkpoint 等可完整生成的小文件：

```text
本地临时目录生成完整内容
    -> 本地 JSON/大小/业务字段校验
    -> 直接覆盖 .workspace 或 .topic 中的已有目标文件
    -> 等待远端文件稳定
    -> 校验远端大小；JSON 文件再尝试解析
```

适用于大文件：

- 在本地 ASR 缓存或其他本地临时目录完成合并；
- 最后一次性直接写回已有远端目标；
- 写回后等待文件稳定并校验大小；
- 不要在 `.workspace` 中先写 `.tmp_*`，再 rename 到正式文件名。

### 11.3 禁止或需评审的写法

在 `.topic` / `.workspace` 中，以下写法默认禁止，除非有明确的 AGFS 语义验证和评审记录：

- `open(temp, "w")` 后执行 `os.replace(temp, target)`；
- `Path.replace()`、`Path.rename()`、`os.rename()` 将临时文件替换正式文件；
- 通过“删除旧文件，再创建同名新文件”实现更新；
- 每次状态更新都生成随机临时文件名；
- 为了避免半写文件，在网络挂载目录引入额外 sidecar 文件，但没有定义清理和生命周期；
- 直接修改 `magic_super_agent_task_files` 做去重或修复历史数据。

注意：本地磁盘上的原子写入模式不一定适用于 AGFS。是否“原子”不能只看 POSIX
接口名称，必须看 AGFS 对 `create`、`write`、`truncate`、`rename`、`unlink` 的
落库语义。

### 11.4 错误事件和处理要求

文件写入失败、远端状态不一致或发现重复记录时，必须记录结构化日志，至少包含：

- `workspace_type`：`.topic` 或 `.workspace`；
- `file_path`、`parent_id`、`file_name`；
- `operation`：`create`、`direct_overwrite`、`rename`、`replace`、`delete`；
- `task_key` / `topic_id`（如果有）；
- `local_size`、`remote_size`、`file_id`（如果有）；
- 重试次数和最终结果。

建议使用以下事件分类，便于告警和排查：

- `NETWORK_FILE_WRITE_FAILED`：网络文件写入或复制失败；
- `NETWORK_FILE_NOT_READY`：远端文件未达到稳定状态或大小不完整；
- `NETWORK_FILE_CONTENT_INVALID`：JSON/元数据内容解析失败；
- `NETWORK_FILE_REPLACE_FORBIDDEN`：在网络挂载目录执行了临时文件替换；
- `NETWORK_FILE_DUPLICATE_RECORD_SUSPECTED`：同一父目录和文件名在短时间内出现多个 file_id；
- `NETWORK_FILE_CHECKPOINT_INCONSISTENT`：checkpoint 文件只存在一部分，或 metadata 与内容不匹配。

处理原则：

1. 直接覆盖失败时可以重试，但不能先无条件删除旧的活跃文件；
2. 发现旧目标存在时，失败清理只能删除本次新建的残留文件，不能删除旧版本；
3. checkpoint 不完整时，先停止增量合并并重新校验，不要继续制造新的替换记录；
4. 线上发现重复记录时，先保留数据库和 AGFS 操作证据，再决定是否清理，禁止直接 SQL 去重；
5. 新增网络文件写入路径时，必须补充测试，证明重复更新不会调用远端 `rename/replace`。

### 11.5 验收指标

每个新增或修改的网络文件写入功能至少验证：

- 连续更新同一文件多次后，活跃 `file_id` 数量为 1；
- `created_at` 不因内容更新持续增加，`updated_at` 正常变化；
- 写入失败不会删除原有可用文件；
- 读取方不会把半截 JSON 当成有效状态；
- 任务完成后的源目录清理不会误删最终产物或其他任务文件。
| 遍历目录 | `async_scandir`（返回 DirEntry，判断类型无需额外 stat）/ `async_iterdir`（返回 Path） |

## 11. 新功能必须支持用户中断（Cancel）机制

中断链路：用户点击终止 → `stop_run()` 设置 `interruption_event` → 所有监听该事件的等待点检测到信号后退出 → 抛 `asyncio.CancelledError` 终止当前 run。

新增长时操作时，逐项检查：

- 耗时等待是否同时监听了 `agent_context.get_interruption_event()`？应使用 `asyncio.wait([work_task, interrupt_task], return_when=FIRST_COMPLETED)` 并行等待，interrupt_task 完成即退出。参考 `streaming_context.py` 中 chunk_task 与 interrupt_task 的写法。
- 中断退出时必须抛 `asyncio.CancelledError`，不能抛 `RuntimeError`。`CancelledError` 是 `BaseException`，不被 `except Exception` 捕获，能正确终止 Agent；`RuntimeError` 则会被上层 `except Exception` 捕获并触发降级重试，导致中断信号被静默绕过。典型陷阱：流式调用检测到中断信号提前退出、收到 0 个 chunks，若此时抛 `RuntimeError("No stream data received")`，`processor_manager` 会降级为非流式重试，中断完全失效。
- 检查所有 `except Exception` / `except BaseException` / 裸 `except:` 块，确认不会吞掉 `CancelledError`。如果 fallback 逻辑需要在中断时跳过，在进入 fallback 前先检查 `agent_context.is_interruption_requested()`。
- 新建的 `asyncio.create_task()` 子任务若需随父级一并取消（如调用子 Agent），在父级的 `_run_cleanup_registry` 中注册清理逻辑，不要依赖 Python 自动传播（父 Task 被 cancel 不会自动取消独立创建的子 Task）。

## 12. 长时间阻塞的工具必须续期活跃时间

沙盒环境会检测进程闲置时间，超过阈值后自动杀掉沙盒。工具执行期间若长时间无输出（如等待后台任务、轮询 API 结果），沙盒会误判为闲置。

统一入口 `app/tools/core/tool_keepalive.py`：

```python
from app.tools.core.tool_keepalive import start_tool_keep_alive, stop_tool_keep_alive

keep_alive_task = start_tool_keep_alive(tool_context)
try:
    await some_long_blocking_operation()
finally:
    stop_tool_keep_alive(keep_alive_task)
```

规则：

- 预期等待超过 60 秒的阻塞操作，必须启动续期
- 续期默认每 30 秒调用一次 `agent_context.update_activity_time()`
- `start_tool_keep_alive` 返回 `None` 时为 no-op（agent_context 不可用），`stop_tool_keep_alive` 接受 `None` 无副作用
- 必须在 `finally` 中取消续期任务，避免泄漏
- 对于自带轮询循环的工具（如 audio_understanding 的进度轮询），可以在每次轮询迭代中直接调用 `agent_context.update_activity_time()` 代替独立续期任务，效果等价
- 不要与 `KeepaliveRegistry`（全局 72h 连接保活）混淆，两者职责不同：`tool_keepalive` 是工具执行期的短期续期，`KeepaliveRegistry` 是沙盒生命周期的长期保活

## 13. 业务逻辑必须保持主线程单事件循环语义

- 项目的业务逻辑一律运行在主线程的主事件循环中；`AgentDispatcher`、`AgentContext`、subagent 运行时、工具调度、运行时注册表等设施默认都建立在这个前提上
- 子线程只允许用于文件 I/O、同步库封装、阻塞式 SDK 回调桥接等辅助工作，不允许在子线程中直接执行业务逻辑，也不允许直接读写上述运行时设施
- 来自子线程的回调或事件，必须先通过 `asyncio.run_coroutine_threadsafe(...)` 或 `loop.call_soon_threadsafe(...)` 切回主事件循环，再进入业务逻辑
- 默认不要为业务运行时设施增加多线程锁；如果未来某个设施必须被多线程直接访问，必须先明确这是架构变更，并单独设计线程安全边界，而不是局部补锁

## 14. 工具新增后需在 `__init__.py` 显式导入

在 `app/tools/` 增加新工具，需同步在 `app/tools/__init__.py` 中 `import` 该类并加入 `__all__`。未在 `__init__.py` 显式导入将导致工具模块未被加载，运行期报错 `No module named 'app.tools.<tool_name>'`。

## 15. 不要手动修改工具定义缓存

- `config/tool_definitions.json` 是缓存文件，不要手动编辑
- 修改工具的真实来源应为 `app/tools/` 下的工具代码；缓存如有需要应走项目既有生成流程刷新

## 16. 工具失败时必须提供人类友好的错误展示

工具执行失败时，用户看到的 `remark` 和 `ToolDetail` 必须有信息量，不能只显示"工具调用失败"这类空洞文案。

规则：

- `remark`：由 `task_message_factory` 统一设置，面向用户传达"AI 正在处理，不必焦虑"的信号，已通过 i18n key `tool.call_failed_remark` 统一管理，新增工具必须有更友好的多语言提示
- `ToolDetail`：工具的 `get_tool_detail()` 在 `result.ok == False` 时，不应直接返回 `None`；应返回包含错误摘要的文本 detail，让用户能看到发生了什么
- 错误信息应脱敏：不暴露上游供应商名称、内部 URL、API key、堆栈等技术细节；只展示用户能理解的错误描述（如"数据获取失败"、"服务暂时不可用"等）
- `ToolResult.content` 面向模型，保留完整错误信息供模型推理和自行修复

存量工具的 `get_tool_detail()` 大多在失败时返回 `None`，等后续统一治理。新增工具必须遵守此规范。

## 17. MagicFS 工作区不是临时目录

`.workspace/` 是 MagicFS 接管的云端持久工作区，写入可能产生对象同步、checkpoint 和文件版本；即使随后删除本地文件，也不能视为已释放云端存储。临时脚本、中间文件、缓存、后台日志、自动大结果和其它可重建数据不得写入 `.workspace/`，包括 `.workspace/.tmp` 等隐藏目录。

项目根 `.runtime/` 与 `.workspace/` 同级，是 sandbox 本地、应用管理、可清理的运行数据目录。需要短期续读、跨应用进程恢复或人工排查的运行文件统一写入 `.runtime/<capability>/`：目录使用 `0700`，文件使用 `0600`；可即时删除的文件在 `finally` 清理，其余文件由 owner 在下一次同类执行时按数量、容量和宽松最长存活时间机会式淘汰。不要依赖操作系统临时目录的清理时间，也不要把本项目运行文件散落到系统临时根目录。

`.runtime/` 不承诺跨 sandbox 重建保留，sandbox 重建时其中内容会被整体清除；但 Claw 等运行形态可能让同一个 sandbox 持续运行数月甚至更久，因此不能把 sandbox 重建当作日常清理机制。每类运行文件仍必须实现代码层面的即时删除或机会式淘汰，防止长期运行期间持续积累。

`.runtime/` 不得作为用户交付或业务持久存储。只有用户需要长期保留、下载、展示或继续编辑的最终文件才写入当前 `.workspace/`。不要因为路径以点开头、应用层不展示或会执行删除，就假设 MagicFS 不会记录或计费。

### 17.1 Agent 活动会话目录

- `.topic/` 是网络文件系统挂载。Agent 会频繁读写 history、session、Horizon、token usage 等会话文件；每次网络文件操作的往返延迟会累积到运行耗时，异步 I/O 也不能消除这项成本。
- 主 Agent 和普通子 Agent 使用配置的 `.chat_history/`、`.chat_history/subagents/`；后台压缩、Memory After Run 等临时会话使用 `.runtime/<capability>/`。通过 `PathManager` 获取目录，使用项目异步文件 API 操作；聊天历史归档不识别存储后端，不因平台配置根软链接而拒绝执行。禁止把活动 `chat_history_dir` 指向 `.topic/`，包括经软链接指向该目录。
- `.topic/chat_history/` 只作启动恢复和交接源：先恢复活动目录再运行，持久化沿用现有 checkpoint 和归档上传流程。需要跨沙盒保留的排查资料由 owner 在内容生成完成后按保留策略低频存档；持久化需求不改变活动目录的用途。

### 17.2 有限保留的排查档案

- `.topic/archives/<capability>/` 集中保存完整生成的排查资料，各能力只清理自己的目录。LLM 失败日志由 `debug_logger` 直接写入 `archives/llm_requests/`，默认保留最近 3 份完整日志；写入成功后才淘汰旧档案，不使用网络目录内的临时文件替换。
- Memory After Run 继续在 `.runtime/memory_after_run/` 运行，结束后由 `ChatHistoryArchiveService` 保存整次会话到配置的 `.chat_history/subagents/` 并主动上传。`ChatHistoryCleanupService` 独立保留最近 3 次完整终态运行，成功、失败、中断都计入；普通子 Agent 的年龄、数量和总容量规则不淘汰这组档案。
- runtime 源文件仍按原规则清理。有限副本使用 `diagnostic_retention` 配额，不放宽 runtime helper 的路径边界；会话复制与远端上传结果分别报告。3 份／3 次限制活跃档案数量，不限制 checkpoint 历史和云端累计空间。

## 18. 工作区文件转 URL 必须走统一入口

`.workspace/` 下的本地文件转可访问 URL，统一调用：

```python
from app.service.file_service import FileService, WorkspaceFileURLError

try:
    url = await FileService().get_workspace_file_url(
        file_path=resolved_local_path,   # 必须是绝对路径，由调用方完成路径解析
        expires_in=3600,
        options=None,                    # 仅图片缩放等场景按需传，例如 {"resize": 80}
    )
except FileNotFoundError:
    ...    # 本地文件不存在
except WorkspaceFileURLError:
    ...    # xattr 缺失或对象存储后端未返回 URL
```

唯一合法的解析链路：

`本地文件 → xattr user.magicfs.s3_key → FileService.get_download_url_by_file_key → presigned URL`

不允许做的事：

- 把工作区相对路径直接拼到对象存储 key 上（绕过 magicfs 真实 s3_key）
- xattr 读不到时静默回落到"按相对路径猜 key"
- 在通用 helper 里硬编码业务专属参数（例如图片缩放 `resize`）；图片场景由 `generate_image` 自己传 `{"resize": 80}`，视频/音频不传
- 把"路径解析"塞进 `FileService.get_workspace_file_url`；候选路径、output_path 前缀拼接、模糊匹配等属于工具层职责，先解析出绝对路径再调本方法

xattr 缺失说明文件尚未与对象存储同步完成，应直接抛错让上层感知，而不是回落到不可靠的路径。

例外（语义不同，保留各自实现）：

- `app/service/agent_event/file_storage_listener_service.py::_construct_file_key`
  上传链路里读 `user.magicfs.s3_key` xattr 直出 `file_key`，没有 xattr 视为「magicfs 未接管」直接跳过、不上报 attachment——同样遵守"只走 xattr → 真实 key"这条主链路。
- `app/api/routes/file.py::get_file_download_url`
  对外 HTTP API，路径由外部调用方传入，不属于"本机本地文件 → URL"的范畴。

## 19. 深度参考文档索引

以下文档不需要常驻上下文，按需查阅：

| 文档 | 路径 | 何时查阅 |
|------|------|---------|
| Agent 运行时与发布链路 | `agents/guides/AGENT_RUNTIME_AND_PUBLISH_GUIDE.md` | 需要理解 Crew/Claw 运行时、Agent 编译流程、发布链路时 |
| 工具/Skill/Code Mode/CLI 范式 | `agents/guides/AGENT_TOOL_SKILL_CODE_MODE_CLI.md` | 设计新能力、决定用工具还是 Skill、理解 Code Mode 机制时 |
| Skill + Tool 双活机制 | `agents/guides/TOOL_OR_SKILL.md` | 将工具迁移到 Skill 范式时、理解工具层与 Skill 层信息隔离规则、preload 机制时 |
| Skill 概念与加载链路 | `agents/guides/SKILLS_OVERVIEW.md` | 快速了解 Skill 是什么、加载方式、来源与模型使用规则时 |
| Skill 开发指南 | `agents/guides/SKILLS_DEVELOPMENT_GUIDE.md` | 新建或修改 Skill、需要了解 SKILL.md 规范和最佳实践时 |
| Magic 文件系统与目录边界 | `agents/guides/MAGIC_FILE_SYSTEM_GUIDE.md` | 新增运行文件、聊天记录、checkpoint、workspace 或 runtime 数据时，确认目录归属和持久化边界 |

## 20. 每次改动前自检

### 运行周期术语

| 术语 | 本项目中的含义 | 边界 |
|---|---|---|
| 业务任务 Task | Magic Service 的任务记录；metadata.super_magic_task_id | 与一次运行有关联，恢复和系统运行时不能假设严格一一对应 |
| 完整 Agent Loop／Main Run | 主 Agent 接受一次 AgentRunRequest，完成其中全部推理、工具调用和结果检查，直到终态 | 对应 Claude Code、Codex 产品交互层的一个 Turn |
| 核心循环 | Agent._handle_agent_loop | 负责 Loop 内反复执行；外层还有会话准备和清理 |
| 循环迭代 | 核心循环中的一个重复步骤 | 一个完整 Loop 可以有多次迭代 |
| 模型请求 LLM request | 对模型服务的一次请求 | 重试、压缩或内部调用不能视为主 Loop 完成 |
| 工具批次 | 一次模型输出中的工具调用及执行结果 | 不是完整主运行的边界 |
| asyncio.Task | Python 并发调度对象 | 不能与业务 Task 或 Main Run 混用 |

例如：用户提出问题 → 模型调用工具 → 检查结果并再次调用工具 → 最终回复，
是一次完整 Agent Loop，即一次 Main Run。用户资料首次查询后，只在完整主 Loop
正常结束时自动刷新一次，不随内部工具批次、重试或附件发送次数刷新。

外部术语必须注明来源和层次。Claude Agent SDK 的 turn 表示 Loop 内一次模型／工具往返，
比产品层 Turn 小；外层 Goal、定时或主动 Loop 又可能跨多个 Main Run。
此对应关系不要求重命名现有代码、事件或新增 loop_id／turn_id。

官方定义：

- [Claude Code 团队：Getting started with loops](https://x.com/ClaudeDevs/status/2074208949205881033)：重复工作直到满足停止条件；普通提示触发的全过程称为 agentic loop。
- [Claude Code Glossary：Turn](https://code.claude.com/docs/en/glossary#turn)：从用户发消息到完成回复，期间允许任意多次工具调用。
- [Codex App Server：Core primitives](https://developers.openai.com/codex/app-server/#core-primitives)：一个用户请求及其后续 Agent 工作。
- [Claude Agent SDK：Turns and messages](https://code.claude.com/docs/en/agent-sdk/agent-loop#turns-and-messages)：turn 是 Loop 内一次往返。

### 修改检查

- 这是在解决真实问题，还是在满足抽象冲动？
- 这层包装有没有新增语义？
- 这套命名是否贴合现有项目风格？
- 这段内容到底是给模型、前端、用户还是程序员看的？
- 这段文字最终会被 LLM 读到吗？如果是代码生成的系统文案，是否已使用英文？

## 21. 大模型可用性是项目运行前提

- super-magic 的正常运行环境始终至少有一个可调用的大模型；`auto` 模型必须可用，否则属于项目或基础设施故障，不是正常业务状态
- 新增 AI Ability 时，不要把「没有任何模型可用」设计成可配置的正常模式，也不要提供以本地规则长期替代模型能力的关闭开关
- 专属模型配置缺失时，应使用明确的默认模型，并按能力需要允许 fallback 到 `auto`
- 确定性本地降级只用于模型配置异常、能力不匹配、调用失败或结构化输出非法等故障场景，不能把降级路径当作无模型运行方案

## 22. Agent 上下文 fork 必须由统一入口管理

- 完整上下文 fork 只能通过 `AgentContextSnapshotService` 编排；调用方不得直接复制 ChatHistory、session 或 Horizon 文件
- 当前可 fork 的可重启上下文固定包括 ChatHistory messages、完整 session 文档和 Horizon 持久化状态
- `AgentModelContext`、中断与清理状态、活动 run、活动 tool call、subagent runtime handle、token usage manager、streams 和事件 sink 都属于运行时状态，不得进入 fork
- 后台压缩、`call_subagent(fork=True)` 和需要延续会话的 Python cron 必须复用同一套 snapshot 语义，不得增加调用方专属的局部 fork 分支
- 新增需要随 Agent 重启延续且需要被 fork 的状态时，必须同时更新统一 snapshot 类型、`AgentContextSnapshotService` 的组件清单、状态 owner 的编解码入口和本节内容
- 禁止重新增加 `ChatHistory.fork_from()`、`fork_source_chat_history`，或任何只复制部分上下文 JSON 文件的旁路
