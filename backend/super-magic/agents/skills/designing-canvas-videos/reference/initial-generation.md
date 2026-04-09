<!--zh
# 首次生成设计生视频

使用 `generate_canvas_videos` 完成"创建占位元素 + 发起视频任务"。

## 必填参数
- `project_path`：设计项目路径
- `tasks`：任务列表，每个 task 包含 `name`、`prompt`、`width`、`height`，单次最多 4 个

## 重点参数
- 生成目标本身
- 用户明确要求的尺寸/分辨率信息
- 用户明确要求的时长信息
- 参考输入信息（参考图、首尾帧）

## 非重点参数
- 用户没明确要求时，默认不填
- 不要为了"更稳"一次性把所有可选参数传满

## 推荐提示词内容
- 主体是什么
- 动作是什么
- 镜头语言是什么
- 光线、风格、节奏是什么

## 示例
```python
from sdk.tool import tool

result = tool.call('generate_canvas_videos', {
    "project_path": "my-design",
    "tasks": [{
        "name": "launch_video",
        "prompt": "手机在极简展台上缓慢旋转，镜头推进，柔和边缘光，商业广告风格",
        "width": 1280,
        "height": 720
    }]
})
print(result)
```

## 用户明确要求时再补重点参数
```python
from sdk.tool import tool

result = tool.call('generate_canvas_videos', {
    "project_path": "my-design",
    "tasks": [{
        "name": "launch_video",
        "prompt": "手机在极简展台上缓慢旋转，镜头推进，柔和边缘光，商业广告风格",
        "width": 1280,
        "height": 720,
        "size": "1920x1080"
    }]
})
print(result)
```
-->

# Initial Canvas Video Generation

Use `generate_canvas_videos` to handle both placeholder creation and job creation.

## Required Parameters
- `project_path`: design project path
- `tasks`: task list, each task needs `name`, `prompt`, `width`, `height`; max 4 per call

## Priority Parameters
- the generation goal itself
- user-requested size/resolution intent
- user-requested duration intent
- reference inputs such as reference images or start/end frames

## Non-Priority Parameters
- leave them empty by default when the user did not explicitly ask for them
- do not fill every optional field "just in case"

## Recommended Prompt Content
- subject
- action
- camera language
- lighting, style, pacing

## Example
```python
from sdk.tool import tool

result = tool.call('generate_canvas_videos', {
    "project_path": "my-design",
    "tasks": [{
        "name": "launch_video",
        "prompt": "A phone slowly rotates on a minimal stage, push-in camera, soft rim light, commercial ad look",
        "width": 1280,
        "height": 720
    }]
})
print(result)
```

## Add Priority Parameters Only When Needed
```python
from sdk.tool import tool

result = tool.call('generate_canvas_videos', {
    "project_path": "my-design",
    "tasks": [{
        "name": "launch_video",
        "prompt": "A phone slowly rotates on a minimal stage, push-in camera, soft rim light, commercial ad look",
        "width": 1280,
        "height": 720,
        "size": "1920x1080"
    }]
})
print(result)
```
