<!--zh
# 参数与失败处理

## 参数建议
- 第一步：先看会话里已注入的运行时视频模型能力配置
- 第二步：先填重点参数
  - 生成目标本身
  - 用户明确要求的尺寸/分辨率信息
  - 用户明确要求的时长信息
  - 参考输入信息（参考图、首尾帧）
- 第三步：非重点参数默认不填
- 默认先把 prompt 写清楚，再决定是否补重点参数
- 默认值机制会处理其余非重点参数；用户没明确要求时，不要主动补齐非重点参数

## 错误处理
- 如果工具真正失败，直接说明错误
- 不要自动改成图片生成
- 不要默默重新提交任务

## 输出与下载
- 默认输出目录是工作区下的 `videos`
- 可用 `video_name` 控制文件名
-->

# Parameters and Error Handling

## Parameter Guidance
- Step 1: inspect the runtime video-model capability config already injected into the conversation
- Step 2: fill priority inputs first
  - the generation goal itself
  - user-requested size/resolution intent
  - user-requested duration intent
  - reference inputs such as reference images or start/end frames
- Step 3: leave non-priority parameters empty by default
- First make the prompt clear, then decide whether extra priority parameters are necessary
- Let the default handling take care of the rest when the user did not explicitly ask for more controls

## Error Handling
- If the tool truly fails, explain the error directly
- Do not auto-switch to image generation
- Do not silently resubmit a new task

## Output and Download
- Default output directory is workspace `videos`
- Use `video_name` to control the saved file name
