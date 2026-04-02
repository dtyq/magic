<!--zh
# 参数选择与失败处理

## 参数建议
- 第一步：先看会话里已注入的运行时视频模型能力配置
- 第二步：先填重点参数
  - 生成目标本身
  - 画布落点：`project_path`、`name`、`width`、`height`
  - 用户明确要求的尺寸/分辨率信息
  - 用户明确要求的时长信息
  - 参考输入信息（参考图、首尾帧）
- 第三步：非重点参数默认不填
- `width` / `height` 是画布排版尺寸，不一定等于底层真实生成分辨率
- 默认值机制会处理其余非重点参数；用户没明确要求时，不要主动补齐一堆附加参数

## 失败处理
- `queued` / `running` / `processing` 不是失败
- 真正失败时，向用户说明错误原因
- 不要自动降级为图片生成
- 不要为了“再试一次”偷偷创建一个新视频任务，除非用户明确要求重新生成

## 结果读取
- `pending_operations`：后续续查的权威来源
- `created_elements`：这次创建的画布元素
- `elements`：更新后的元素详情
-->

# Parameters and Error Handling

## Parameter Guidance
- Step 1: inspect the runtime video-model capability config already injected into the conversation
- Step 2: fill priority inputs first
  - the generation goal itself
  - canvas placement: `project_path`, `name`, `width`, `height`
  - user-requested size/resolution intent
  - user-requested duration intent
  - reference inputs such as reference images or start/end frames
- Step 3: leave non-priority parameters empty by default
- `width` / `height` are canvas layout dimensions and may differ from real generation resolution
- Let the default handling take care of the rest when the user did not explicitly ask for more controls

## Error Handling
- `queued` / `running` / `processing` are not failures
- When it truly fails, explain the error directly
- Do not auto-downgrade to image generation
- Do not silently create a new video job “to try again” unless the user explicitly asks for regeneration

## Reading Results
- `pending_operations`: source of truth for future follow-up
- `created_elements`: elements created in this run
- `elements`: updated element details
