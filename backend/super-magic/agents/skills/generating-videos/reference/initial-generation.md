<!--zh
# 通用视频首次生成

使用 `generate_video` 发起视频生成。

## 三种模式
1. 纯描述驱动生成
2. 参考输入引导生成
3. 首尾帧约束生成

## 重点参数
- 生成目标本身
- 用户明确要求的尺寸/分辨率信息
- 用户明确要求的时长信息
- 参考输入信息（参考图、首尾帧）

## 非重点参数
- 用户没明确要求时，默认不填
- 不要为了“更稳”一次性把所有可选参数传满

## 示例
```python
from sdk.tool import tool

result = tool.call('generate_video', {
    "prompt": "银色跑车在夜晚城市街道快速掠过，低机位跟拍，霓虹反光"
})
```

## 用户明确要求时再补重点参数
```python
from sdk.tool import tool

result = tool.call('generate_video', {
    "prompt": "银色跑车在夜晚城市街道快速掠过，低机位跟拍，霓虹反光",
    "size": "1920x1080",
    "duration_seconds": 8
})
```
-->

# Initial General Video Generation

Use `generate_video` to start a video generation job.

## Three Modes
1. text-described generation
2. reference-guided generation
3. start/end-frame constrained generation

## Priority Parameters
- the generation goal itself
- user-requested size/resolution intent
- user-requested duration intent
- reference inputs such as reference images or start/end frames

## Non-Priority Parameters
- leave them empty by default when the user did not explicitly ask for them
- do not fill every optional field “just in case”

## Example
```python
from sdk.tool import tool

result = tool.call('generate_video', {
    "prompt": "A silver sports car races through a night city street, low-angle tracking shot, neon reflections"
})
```

## Add Priority Parameters Only When Needed
```python
from sdk.tool import tool

result = tool.call('generate_video', {
    "prompt": "A silver sports car races through a night city street, low-angle tracking shot, neon reflections",
    "size": "1920x1080",
    "duration_seconds": 8
})
```
