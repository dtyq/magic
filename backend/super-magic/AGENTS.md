# Agent Engineering Rules

本文件适用于整个 `super-magic` 项目。

## 1. 先贴合项目，再考虑抽象

- 优先复用现有命名、目录、机制、文件结构
- 不要轻易发明新概念、新 ID、新层级、新 sidecar 文件
- 现有结构能承载时，不要新建体系

## 2. 避免过度设计

- 不要为了"未来可能需要"而提前引入复杂抽象
- 不要写没有新增语义的包装层
- 抽象只有在满足以下至少一项时才成立：新增语义、屏蔽复杂性、减少重复决策、显著降低错误率

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
- 或：
  ```python
  from sdk.mcp import mcp

  result = mcp.call("server_name", "tool_name", {
      "key": "value",
  })
  print(result.content)
  ```
- 其运行链路是：模型先生成 Python 代码，代码由 `run_sdk_snippet` 等执行环境运行，再通过 SDK 发起真实工具调用；因此 Code Mode 本质上是“代码调工具”，不是“Skill 专属工具”
- Skill 与直接挂载工具是两条并行能力链路，不是互斥关系；Skill 可以补充高层工作流、长示例、多步决策
- 但只要某个工具仍可能被直接挂载给模型，它自身的提示词就必须足以支持独立使用；不要因为“这个能力已经写进 Skill”就把本应留在工具上的关键信息转移走
- 只有在明确取消直接挂载工具入口并完成统一迁移后，才可以同步收缩该工具面向模型的高层提示内容
- 判断标准：如果模型完全不读 Skill、只看工具定义，是否仍能正确理解并使用这个工具？如果不能，说明你把本应属于工具的信息错误地转移到了 Skill

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

- 数据 Skill 默认引导 Agent 阅读 `result.content`；`result.data`, `data_view` 只用于跨工具传递精确 ID 和结构化脚本
- 主 Skill 不堆 data schema 字段清单；字段契约写进 reference/data-schema.md 或 reference/xxx-data-schema.md 中
- schema 必须说明字段可能缺失、为空或类型随上游变化
- schema 应提供结构查看方法：字段取不到时先打印 `data_view` 的 keys、类型和少量截断样例，不要将大量完整数据打印到 Agent 上下文中
- 新增或修改数据工具时，验收必须覆盖三层：上游响应非空、formatter 后的 `data_view` 关键字段非空、`result.content` 对模型可读；不能只用 HTTP 200 或原始 payload 非空判断可用

## 6. 命名与展示文案要有产品感

- 所有会展示给前端或用户的命名与文案，都不要使用生硬的接口腔、论文腔、实现腔表达
- 优先使用贴近真实产品心智、任务流转和用户感知的表达
- 先表达用户能理解的动作、状态和结果，再避免暴露底层 RPC 概念、内部对象名和实现细节

## 7. 强类型优先，但不要为了类型而复杂化

- 稳定闭集字段优先使用 `Enum` / `StrEnum`
- 明确结构优先使用 dataclass 或模型，不要滥用 `Dict`
- 尽量减少不必要的 `Optional` / nullable
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

Python 代码中凡是涉及文件操作，必须使用 `app/utils/async_file_utils.py`，不要直接用 `open()`、`os`、`shutil` 的同步接口。

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
| 遍历目录 | `async_scandir`（返回 DirEntry，判断类型无需额外 stat）/ `async_iterdir`（返回 Path） |

## 11. 新功能必须支持用户中断（Cancel）机制

中断链路：用户点击终止 → `stop_run()` 设置 `interruption_event` → 所有监听该事件的等待点检测到信号后退出 → 抛 `asyncio.CancelledError` 终止当前 run。

新增长时操作时，逐项检查：

- 耗时等待是否同时监听了 `agent_context.get_interruption_event()`？应使用 `asyncio.wait([work_task, interrupt_task], return_when=FIRST_COMPLETED)` 并行等待，interrupt_task 完成即退出。参考 `streaming_context.py` 中 chunk_task 与 interrupt_task 的写法。
- 中断退出时必须抛 `asyncio.CancelledError`，不能抛 `RuntimeError`。`CancelledError` 是 `BaseException`，不被 `except Exception` 捕获，能正确终止 Agent；`RuntimeError` 则会被上层 `except Exception` 捕获并触发降级重试，导致中断信号被静默绕过。典型陷阱：流式调用检测到中断信号提前退出、收到 0 个 chunks，若此时抛 `RuntimeError("No stream data received")`，`processor_manager` 会降级为非流式重试，中断完全失效。
- 检查所有 `except Exception` / `except BaseException` / 裸 `except:` 块，确认不会吞掉 `CancelledError`。如果 fallback 逻辑需要在中断时跳过，在进入 fallback 前先检查 `agent_context.is_interruption_requested()`。
- 新建的 `asyncio.create_task()` 子任务若需随父级一并取消（如调用子 Agent），在父级的 `_run_cleanup_registry` 中注册清理逻辑，不要依赖 Python 自动传播（父 Task 被 cancel 不会自动取消独立创建的子 Task）。

## 12. 业务逻辑必须保持主线程单事件循环语义

- 项目的业务逻辑一律运行在主线程的主事件循环中；`AgentDispatcher`、`AgentContext`、subagent 运行时、工具调度、运行时注册表等设施默认都建立在这个前提上
- 子线程只允许用于文件 I/O、同步库封装、阻塞式 SDK 回调桥接等辅助工作，不允许在子线程中直接执行业务逻辑，也不允许直接读写上述运行时设施
- 来自子线程的回调或事件，必须先通过 `asyncio.run_coroutine_threadsafe(...)` 或 `loop.call_soon_threadsafe(...)` 切回主事件循环，再进入业务逻辑
- 默认不要为业务运行时设施增加多线程锁；如果未来某个设施必须被多线程直接访问，必须先明确这是架构变更，并单独设计线程安全边界，而不是局部补锁

## 13. 工具新增后需在 `__init__.py` 显式导入

在 `app/tools/` 增加新工具，需同步在 `app/tools/__init__.py` 中 `import` 该类并加入 `__all__`。未在 `__init__.py` 显式导入将导致工具模块未被加载，运行期报错 `No module named 'app.tools.<tool_name>'`。

## 14. 不要手动修改工具定义缓存

- `config/tool_definitions.json` 是缓存文件，不要手动编辑
- 修改工具的真实来源应为 `app/tools/` 下的工具代码；缓存如有需要应走项目既有生成流程刷新

## 15. 深度参考文档索引

以下文档不需要常驻上下文，按需查阅：

| 文档 | 路径 | 何时查阅 |
|------|------|---------|
| Agent 运行时与发布链路 | `agents/guides/AGENT_RUNTIME_AND_PUBLISH_GUIDE.md` | 需要理解 Crew/Claw 运行时、Agent 编译流程、发布链路时 |
| 工具/Skill/Code Mode/CLI 范式 | `agents/guides/AGENT_TOOL_SKILL_CODE_MODE_CLI.md` | 设计新能力、决定用工具还是 Skill、理解 Code Mode 机制时 |
| Skill + Tool 双活机制 | `agents/guides/TOOL_OR_SKILL.md` | 将工具迁移到 Skill 范式时、理解工具层与 Skill 层信息隔离规则、preload 机制时 |
| Skill 概念与加载链路 | `agents/guides/SKILLS_OVERVIEW.md` | 快速了解 Skill 是什么、加载方式、来源与模型使用规则时 |
| Skill 开发指南 | `agents/guides/SKILLS_DEVELOPMENT_GUIDE.md` | 新建或修改 Skill、需要了解 SKILL.md 规范和最佳实践时 |

## 16. 每次改动前自检

- 这是在解决真实问题，还是在满足抽象冲动？
- 这层包装有没有新增语义？
- 这套命名是否贴合现有项目风格？
- 这段内容到底是给模型、前端、用户还是程序员看的？
- 这段文字最终会被 LLM 读到吗？如果是代码生成的系统文案，是否已使用英文？
