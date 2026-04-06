---
name: designing-canvas-videos
description: Canvas video generation skill for design projects. Use when users want dynamic output on canvas such as video, animation, shot, clip, short film, motion poster, or when they ask to continue checking an in-progress canvas video task. Handles both initial generation and follow-up progress checks in the same skill. CRITICAL - When user message contains [@design_canvas_project:...] and asks for video generation or video progress, you MUST load this skill first.

name-cn: 画布视频设计技能
description-cn: 画布视频设计技能，负责设计项目中的视频生成与任务续查。当用户要在画布中生成视频、动画、镜头、短片、动态海报，或继续查询画布视频任务进度时使用。它同时覆盖首次生成和后续续查。关键规则 - 当用户消息包含 [@design_canvas_project:...] 且涉及视频生成或视频进度时，必须先加载此技能。
---

<!--zh
# 画布视频设计技能
-->
# Canvas Video Design Skill

<!--zh: 提供设计项目中的视频生成、占位元素创建、任务续查与状态回填能力。-->
Provides video generation, placeholder creation, task follow-up, and status backfilling for design projects.

---

<!--zh
## 如何使用本文档
-->
## How to Use This Document

<!--zh
本文档给出快速路径。当遇到更细的场景时，阅读对应 reference：

- **首次生成视频** → [reference/initial-generation.md](reference/initial-generation.md)
- **续查进度 / 回填状态** → [reference/follow-up.md](reference/follow-up.md)
- **参数选择 / 失败处理** → [reference/parameters-and-errors.md](reference/parameters-and-errors.md)
-->
This document provides the quick path. Read the matching reference for detailed cases:

- **Initial generation** → [reference/initial-generation.md](reference/initial-generation.md)
- **Follow-up / status sync** → [reference/follow-up.md](reference/follow-up.md)
- **Parameter selection / error handling** → [reference/parameters-and-errors.md](reference/parameters-and-errors.md)

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
# Correct: execute through run_sdk_snippet
run_sdk_snippet(
    python_code="""
from sdk.tool import tool

result = tool.call('generate_videos_to_canvas', {
    "project_path": "my-design",
    "name": "promo_video",
    "prompts": ["产品在柔和灯光下缓慢旋转，电影感镜头"],
    "width": 1280,
    "height": 720
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
- 用户要在画布/设计项目里生成动态内容：视频、动画、镜头、短片、clip、shot、motion poster
- 用户已经发起过设计生视频，现在追问“好了没 / 继续 / 刷新 / 再查一下 / 进度 / status”
- 用户给了参考图或首尾帧，希望在画布上生成视频元素
-->
- User wants dynamic output on canvas/design project: video, animation, shot, clip, short film, motion poster
- User already started a canvas video task and asks “is it done / continue / refresh / check again / progress / status”
- User provides reference images or start/end frames and wants a video element on canvas

<!--zh
## 不要用于
-->
## Do Not Use This Skill For

<!--zh
- 静态结果（海报、封面、截图、插画）→ 使用图片工具链
- 非画布项目中的通用视频生成 → 使用 `generating-videos`
- 仅调整元素位置、尺寸、图层 → 使用画布元素编辑工具
-->
- Static output such as poster, cover, screenshot, or illustration → use image workflow
- General non-canvas video generation → use `generating-videos`
- Only adjusting element position, size, or layer → use canvas element editing tools

---

<!--zh
## 快速开始
-->
## Quick Start

<!--zh
### 1. 首次生成设计生视频
-->
### 1. Initial Canvas Video Generation

```python
from sdk.tool import tool

result = tool.call('generate_videos_to_canvas', {
    "project_path": "my-design",
    "name": "promo_video",
    "prompts": ["产品在纯白背景中缓慢推进，镜头稳定，商业广告质感"],
    "width": 1280,
    "height": 720
})
```

<!--zh
### 2. 继续查询视频任务
仅在创建工具已轮询到超时、且用户明确要求查询进度时使用。
-->
### 2. Follow Up an Existing Video Task

Only use this after the creation tool has already timed out and the user explicitly asks to check progress.

```python
from sdk.tool import tool

result = tool.call('query_video_generation', {
    "operation_id": "op_xxx"
})
```

<!--zh
### 3. 只有用户明确要求时，才补重点参数
-->
### 3. Add Priority Parameters Only When User Explicitly Asks

```python
from sdk.tool import tool

result = tool.call('generate_videos_to_canvas', {
    "project_path": "my-design",
    "name": "promo_video",
    "prompts": ["产品在纯白背景中缓慢推进，镜头稳定，商业广告质感"],
    "width": 1280,
    "height": 720,
    "size": "1920x1080"
})
```

---

<!--zh
## 核心工作流
-->
## Core Workflow

<!--zh
### 路径 A：首次生成
- 使用 `generate_videos_to_canvas`
- 必填：`project_path`、`name`、`prompts`、`width`、`height`
- 先关注生成目标本身、是否有参考输入，以及用户是否明确要求尺寸/分辨率或时长
- 用户没明确要求额外控制项时，优先使用最小参数集
- 如果返回 `queued` / `running` / `processing`，说明链路正确，任务已创建成功
-->
### Path A: Initial Generation
- Use `generate_videos_to_canvas`
- Required: `project_path`, `name`, `prompts`, `width`, `height`
- First focus on the goal itself: what to generate, whether there is a reference input, and whether the user explicitly requested size/resolution or duration
- If the user did not explicitly ask for extra controls, prefer the minimum parameter set
- If result is `queued` / `running` / `processing`, the task is on the correct path

<!--zh
### 路径 B：后续续查
- 创建工具本身会先阻塞轮询，并在等待期间持续给用户发进度消息
- 只有创建工具已轮询到超时、且用户明确要求查询进度时，才使用 `query_video_generation`
- 查询时优先复用上次结果中的 `operation_id` / `request_id`
- 在画布场景中，尽量同时传 `project_path` + `element_id`，让工具自动回填元素状态
- 禁止因为视频仍在处理中就重新创建一个新任务
-->
### Path B: Follow-Up
- The creation tool itself blocks and polls first, while continuously sending progress updates to the user
- Only use `query_video_generation` after the creation tool has already timed out and the user explicitly asks to check progress
- `operation_id` is the primary follow-up input
- Reuse `request_id`, `project_path`, and `element_id` when already known
- In canvas scenarios, prefer passing both `project_path` and `element_id` so the tool can backfill element state
- Never start a new generation job just because the current one is still processing

---

<!--zh
## 关键规则
-->
## Critical Rules

<!--zh
- 用户要的是动态结果时，不要退回 `generate_images_to_canvas`
- 只有用户明确改要静态海报、封面、截图时，才切回图片工作流
- 视频创建工具会先阻塞轮询，并在工具返回前持续给用户发进度消息
- 默认不要因为任务还在处理中就主动调用查询能力
- 只有在创建工具已轮询到超时后，且用户明确要求“查进度 / 刷新 / 好了没 / 再查一下”时，才做续查
- 续查时优先复用已有的 `operation_id`、`request_id`、`element_id`
- 如果工具返回 `pending_operations`，表示本次已轮询到超时；这些就是下一次续查的权威来源
- 调用前先参考会话里之前已经注入的运行时视频模型能力配置消息
- 重点先填这几类信息：生成目标、画布落点、尺寸/分辨率需求、时长需求、参考输入
- 非重点参数如果用户没明确要求，就尽量不填，不要把所有可选参数一次性传满
- 参数不确定时，宁可少传，不要乱传
- 对 `generate_videos_to_canvas` 来说，`width`/`height` 是画布元素尺寸；模型应优先关注画布落点和视频目标，不要陷入调参
-->
- When the user wants dynamic output, do not fall back to `generate_images_to_canvas`
- Only switch back to image workflow when the user explicitly asks for a still result
- The video creation tool blocks and polls first, while continuously sending progress updates before returning
- Do not proactively call the query capability just because a task is still in progress
- Only follow up when the creation tool has already timed out and the user explicitly asks to check progress
- On follow-up, prefer reusing existing `operation_id`, `request_id`, and `element_id`
- If the tool returns `pending_operations`, treat them as timed-out in-progress tasks and the source of truth for the next follow-up
- Before calling video tools, refer to the runtime video-model capability message that was already injected earlier in the conversation
- Prioritize only these categories of information first: the generation goal, canvas placement, size/resolution intent, duration intent, and reference inputs
- If the user did not explicitly ask for extra controls, keep non-priority parameters empty instead of filling every optional field
- When uncertain about a parameter, prefer omitting it rather than guessing
- For `generate_videos_to_canvas`, `width`/`height` are canvas element dimensions; focus first on canvas placement and the video goal instead of over-tuning parameters
