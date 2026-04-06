---
name: generating-videos
description: General video generation skill for text-to-video, reference-guided video, and start/end-frame video. Use when users ask to generate a video, make a video from text or images, or continue checking an in-progress video task. Handles both initial creation and follow-up status checks in one skill.

name-cn: 通用视频生成技能
description-cn: 通用视频生成技能，负责文生视频、参考图视频、首尾帧视频，以及视频任务续查。当用户要求生成视频、用图片做视频、或继续查询视频进度时使用。一个技能同时覆盖首次创建与后续续查。
---

<!--zh
# 通用视频生成技能
-->
# General Video Generation Skill

<!--zh: 提供文生视频、参考图引导视频、首尾帧视频，以及视频任务续查能力。-->
Provides text-to-video, reference-guided video, start/end frame video, and follow-up querying.

---

<!--zh
## 如何使用本文档
-->
## How to Use This Document

<!--zh
按场景阅读：

- **首次生成** → [reference/initial-generation.md](reference/initial-generation.md)
- **续查进度** → [reference/follow-up.md](reference/follow-up.md)
- **参数与失败处理** → [reference/parameters-and-errors.md](reference/parameters-and-errors.md)
-->
Read by scenario:

- **Initial generation** → [reference/initial-generation.md](reference/initial-generation.md)
- **Follow-up** → [reference/follow-up.md](reference/follow-up.md)
- **Parameters and errors** → [reference/parameters-and-errors.md](reference/parameters-and-errors.md)

---

<!--zh
## 代码执行方式（关键）
-->
## Code Execution Method (Critical)

<!--zh
本技能中的 Python 示例必须通过 `run_sdk_snippet` 执行。
-->
All Python examples in this skill must be executed via `run_sdk_snippet`.
Video-related tool calls in this skill automatically use long timeouts. Do not ask the model to reason about timeout values.

```python
run_sdk_snippet(
    python_code="""
from sdk.tool import tool

result = tool.call('generate_video', {
    "prompt": "黄昏海边，镜头缓慢推进，电影感光影"
})
"""
)
```

---

<!--zh
## 什么时候使用
-->
## Use This Skill When

<!--zh
- 用户说“帮我生成视频”“文生视频”“做一个短片”“做个动画镜头”
- 用户说“用这张图片做视频”“根据首尾帧生成视频”
- 用户追问“好了没 / 继续 / 刷新一下 / 再查一下进度 / status”
-->
- User says “generate a video”, “text-to-video”, “make a short clip”, or “make an animated shot”
- User says “make a video from this image” or “generate video from start/end frames”
- User follows up with “is it done / continue / refresh / check progress / status”

<!--zh
## 不要用于
-->
## Do Not Use This Skill For

<!--zh
- 设计项目中的画布视频 → 使用 `designing-canvas-videos`
- 静态图片生成 → 使用图片工作流
- 视频分析、转录、YouTube 下载 → 使用对应视频分析链路
-->
- Canvas/design-project video generation → use `designing-canvas-videos`
- Static image generation → use image workflow
- Video analysis, transcription, YouTube download → use dedicated video analysis workflow

---

<!--zh
## 快速开始
-->
## Quick Start

<!--zh
### 1. 文生视频
-->
### 1. Text-to-Video

```python
from sdk.tool import tool

result = tool.call('generate_video', {
    "prompt": "黄昏海边，镜头缓慢推进，电影感光影"
})
```

<!--zh
### 2. 参考图视频
-->
### 2. Reference-Guided Video

```python
from sdk.tool import tool

result = tool.call('generate_video', {
    "prompt": "让角色缓慢转身并微笑，保持参考图中的服装和面部特征",
    "reference_image_paths": ["/workspace/images/character.png"]
})
```

<!--zh
### 3. 续查任务
仅在创建工具已轮询到超时、且用户明确要求查询进度时使用。
-->
### 3. Follow Up a Task

Only use this after the creation tool has already timed out and the user explicitly asks to check progress.

```python
from sdk.tool import tool

result = tool.call('query_video_generation', {
    "operation_id": "op_xxx"
})
```

<!--zh
### 4. 只有用户明确要求时，才补重点参数
-->
### 4. Add Priority Parameters Only When User Explicitly Asks

```python
from sdk.tool import tool

result = tool.call('generate_video', {
    "prompt": "黄昏海边，镜头缓慢推进，电影感光影",
    "size": "1920x1080",
    "duration_seconds": 10
})
```

---

<!--zh
## 核心工作流
-->
## Core Workflow

<!--zh
### 路径 A：首次生成
- 使用 `generate_video`
- 三种模式：
  1. 纯描述驱动生成
  2. 参考输入引导生成
  3. 首尾帧约束生成
- 默认先用最小可用参数集
- 只有用户明确提出时，才补尺寸/分辨率或时长这类重点参数
-->
### Path A: Initial Generation
- Use `generate_video`
- Three modes:
  1. text-described generation
  2. reference-guided generation
  3. start/end-frame constrained generation
- Default to the smallest useful parameter set first
- Only add priority parameters such as size/resolution or duration when the user explicitly asks for them

<!--zh
### 路径 B：续查
- 创建工具本身会先阻塞轮询，并在等待期间持续给用户发进度消息
- 只有创建工具已轮询到超时、且用户明确要求查询进度时，才使用 `query_video_generation`
- `operation_id` 是续查的主输入
- 已知时再复用 `request_id`、`video_name`、`output_path`
- `queued` / `running` / `processing` 只说明仍在生成，不代表失败
- 任务未完成时，禁止重复发起新的生成任务
-->
### Path B: Follow-Up
- The creation tool itself blocks and polls first, while continuously sending progress updates to the user
- Only use `query_video_generation` after the creation tool has already timed out and the user explicitly asks to check progress
- `operation_id` is the primary follow-up input
- Reuse `request_id`, `video_name`, and `output_path` only when already known
- `queued` / `running` / `processing` mean in progress, not failed
- Never start a second generation job while the current one is still pending

---

<!--zh
## 关键规则
-->
## Critical Rules

<!--zh
- prompt 里要写清主体、动作、镜头、光线、风格
- 用户给了参考图，不要脱离参考图自由发挥
- 视频创建工具会先阻塞轮询，并在工具返回前持续给用户发进度消息
- 默认不要因为任务还在处理中就主动调用查询能力
- 只有在创建工具已轮询到超时后，且用户明确要求“查进度 / 刷新 / 好了没 / 再查一下”时，才做续查
- 续查优先于重建任务
- 只有用户明确说“重新生成/重做一个”时，才重新发起生成
- 调用前先参考会话中之前已注入的运行时视频模型能力配置消息
- 重点先填这几类信息：生成目标、尺寸/分辨率需求、时长需求、参考输入
- 非重点参数如果用户没明确要求，就尽量不填，不要把所有可选参数一次性传满
- 默认先把“生成什么视频”说清楚，再考虑要不要补额外参数
- 参数不确定时，宁可少传，不要乱传
-->
- The prompt should clearly describe subject, motion, camera, lighting, and style
- If the user provides reference images, do not drift away from them
- The video creation tool blocks and polls first, while continuously sending progress updates before returning
- Do not proactively call the query capability just because a task is still in progress
- Only follow up when the creation tool has already timed out and the user explicitly asks to check progress
- Follow-up is preferred over recreating tasks
- Only regenerate when the user explicitly asks to regenerate or make a new version
- Before calling video tools, refer to the runtime video-model capability message that was already injected earlier in the conversation
- Prioritize only these categories of information first: the generation goal, size/resolution intent, duration intent, and reference inputs
- If the user did not explicitly ask for extra controls, keep non-priority parameters empty instead of filling every optional field
- First make the requested video objective clear, then decide whether extra parameters are necessary
- When uncertain about a parameter, prefer omitting it rather than guessing
