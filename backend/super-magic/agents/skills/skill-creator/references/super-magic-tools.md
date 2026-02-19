# Super Magic 项目可用工具参考

<!--zh
本文档列出 super-magic 项目中 AI 可以在 skill 中使用的工具，包含工具用途、参数 schema 和 Python 代码调用示例。

所有工具调用使用以下格式：
-->
This document lists the tools available to AI in super-magic skills, with descriptions, parameter schemas, and Python call examples.

All tool calls use this format:

```python
from sdk.tool import tool

result = tool.call('tool_name', {
    "param": "value"
})

if result.ok:
    data = result.data  # dict or None
else:
    error = result.content  # error message string
```

---

## 网络搜索与抓取类 / Web Search & Fetch

### web_search

<!--zh
在互联网上搜索信息。在 Interview 阶段可用于调研最佳实践、查找 API 文档、搜索类似 skill 的描述范式。
没有浏览器不影响此工具使用。
-->
Search the internet. Use during Interview to research best practices, API docs, and similar skill patterns.
Works without a browser.

**Schema:**

```json
{
  "topic_id": "string (required) — 同一搜索主题使用相同的 topic_id，用于结果去重",
  "requirements_xml": "string (required) — XML 格式的搜索需求，示例见下方"
}
```

```python
from sdk.tool import tool

result = tool.call('web_search', {
    "topic_id": "skill-research",
    "requirements_xml": """<requirements>
    <requirement>
        <name>Travel Planning Best Practices</name>
        <query>travel itinerary generation AI best practices 2024</query>
        <limit>10</limit>
    </requirement>
</requirements>"""
})

if result.ok:
    print(result.content)
```

### read_webpages_as_markdown

<!--zh 将指定 URL 的网页内容读取为 Markdown 格式，适合读取文档和技术博客。 -->
Fetch a webpage and convert it to Markdown. Useful for reading documentation and technical articles.

**Schema:**

```json
{
  "urls": "string[] (required) — 要读取的网页 URL 列表",
  "requirements": "string (optional) — 提炼要求，为空返回原始内容，非空则按要求提炼"
}
```

```python
from sdk.tool import tool

result = tool.call('read_webpages_as_markdown', {
    "urls": ["https://example.com/docs/api"],
    "requirements": "提取 API 接口说明和参数列表"
})
```

### download_from_url

<!--zh 从 URL 下载文件到本地路径。支持自动重定向，文件不存在时自动创建目录。 -->
Download a file from a URL to a local path. Supports redirects and auto-creates directories.

**Schema:**

```json
{
  "url": "string (required) — 文件 URL，支持 HTTP/HTTPS",
  "file_path": "string (required) — 本地保存路径（含文件名），目录不存在时自动创建"
}
```

```python
from sdk.tool import tool

result = tool.call('download_from_url', {
    "url": "https://example.com/data.csv",
    "file_path": ".workspace/data/data.csv"
})
```

### download_from_urls

<!--zh 批量从多个 URL 下载文件。已存在的目标文件会被自动覆盖。 -->
Batch download files from multiple URLs. Existing target files are automatically overwritten.

**Schema:**

```json
{
  "downloads_xml": "string (required) — XML 格式的批量下载配置，示例见下方"
}
```

```python
from sdk.tool import tool

result = tool.call('download_from_urls', {
    "downloads_xml": """<downloads>
    <download>
        <url>https://example.com/a.csv</url>
        <file_path>.workspace/data/a.csv</file_path>
    </download>
    <download>
        <url>https://example.com/b.csv</url>
        <file_path>.workspace/data/b.csv</file_path>
    </download>
</downloads>"""
})
```

---

## 视觉理解类 / Vision

### visual_understanding

<!--zh 分析图片内容，返回描述。适合处理用户截图、设计稿、流程图等。 -->
Analyze image content. Useful for user screenshots, design mockups, flow diagrams.

**Schema:**

```json
{
  "images": "string[] (required) — 图片 URL 或本地文件路径列表，支持多图",
  "query": "string (required) — 对图片的分析问题或要求"
}
```

```python
from sdk.tool import tool

result = tool.call('visual_understanding', {
    "images": [".workspace/screenshot.png"],
    "query": "请描述这张截图中展示的工作流程"
})
```

### visual_understanding_webpage

<!--zh
截图指定网页并通过视觉理解分析其内容。支持本地 HTML 文件和远程 URL。
会自动获取页面 HTML 代码（最多 16K token）作为辅助参考。
适合检查生成的 HTML 报告是否正确渲染。
-->
Screenshot a webpage and analyze its content visually. Supports local HTML files and remote URLs.
Auto-fetches page HTML (up to 16K tokens) alongside the screenshot for more accurate analysis.
Useful for verifying generated HTML reports render correctly.

**Schema:**

```json
{
  "target": "string (required) — 本地 HTML 文件路径（相对工作目录）或远程 URL",
  "query": "string (required) — 对网页内容的分析问题或要求"
}
```

```python
from sdk.tool import tool

# 检查本地 HTML 文件 / Check local HTML file
result = tool.call('visual_understanding_webpage', {
    "target": ".workspace/output/report.html",
    "query": "检查这份报告是否正确渲染，图表是否显示正常"
})

# 分析远程网页 / Analyze remote webpage
result = tool.call('visual_understanding_webpage', {
    "target": "https://example.com",
    "query": "分析这个网页的主要内容和布局结构"
})
```

---

## 代码执行类 / Code Execution

### shell_exec

<!--zh
执行 shell 命令。常见用途：运行 Python 脚本、文件操作、执行评测聚合脚本。

workspace skill 的 scripts 执行时，cwd 设为 `.workspace/skills/<skill-name>`。
skill-creator 自身脚本执行时，cwd 设为 `agents/skills/skill-creator`。
-->
Execute shell commands. Common uses: run Python scripts, file operations, eval scripts.

**Path rules:**
- Default working directory is `.workspace/`. Inside commands, paths are relative to `.workspace/` — do NOT include `.workspace/` prefix, or you get `.workspace/.workspace/...`.
- The `cwd` parameter is relative to the project root, so it SHOULD include `.workspace/` (e.g., `cwd=".workspace/skills/my-skill"`).
- For workspace skill scripts, set `cwd` to `.workspace/skills/<skill-name>`.
- For skill-creator's own scripts, set `cwd` to `agents/skills/skill-creator`.

**Schema:**

```json
{
  "command": "string (required) — 要执行的 shell 命令",
  "cwd": "string | null (optional) — 命令执行的工作目录，默认为 workspace 根目录",
  "timeout": "integer (optional, default 60) — 超时时间（秒）"
}
```

```python
from sdk.tool import tool

# 执行评测聚合 / Run eval aggregation
result = tool.call('shell_exec', {
    "command": "python -m scripts.aggregate_benchmark .workspace/skills/my-skill/evals/iteration-1 --skill-name my-skill",
    "cwd": "agents/skills/skill-creator",
    "timeout": 120
})

# 执行 workspace skill 自身的脚本 / Run workspace skill's own script
result = tool.call('shell_exec', {
    "command": "python scripts/process.py",
    "cwd": ".workspace/skills/my-skill"
})
```

### run_python_snippet

<!--zh 直接运行一段 Python 代码，不需要先写文件。适合轻量数据处理和调用项目内部 API。 -->
Run Python code directly without writing a file first. Useful for lightweight data processing and calling internal project APIs.

**Schema:**

```json
{
  "python_code": "string (required) — 要执行的 Python 代码",
  "script_path": "string (required) — 临时脚本文件路径（含文件名），避免与现有文件重名，建议用 temp_xxx.py",
  "cwd": "string | null (optional) — 脚本执行的工作目录，默认为 workspace 根目录",
  "timeout": "integer (optional, default 60) — 超时时间（秒）"
}
```

```python
from sdk.tool import tool

result = tool.call('run_python_snippet', {
    "python_code": """
import json

data = {"name": "my-skill", "version": "1.0"}
print(json.dumps(data, indent=2))
""",
    "script_path": "temp_check_skill.py"
})
```

---

## 图片生成与搜索类 / Image Generation & Search

### generate_image

<!--zh
文生图和图片编辑工具。支持两种模式：
- generate 模式：从文字描述生成全新图片
- edit 模式：基于已有图片进行编辑（需提供 image_paths）
-->
Text-to-image generation and image editing. Two modes:
- **generate**: Create new images from text prompts
- **edit**: Modify existing images (requires `image_paths`)

**Schema:**

```json
{
  "prompt": "string (required) — 图片描述或编辑指令",
  "mode": "string (required) — 'generate'（生成）或 'edit'（编辑）",
  "image_paths": "string[] (optional) — edit 模式必填，要编辑的图片路径列表",
  "image_count": "integer (optional, default 1, max 4) — generate 模式下生成数量",
  "size": "string (optional, default '2048x2048') — 图片尺寸，如 '1:1'、'16:9'、'2048x2048'",
  "image_name": "string (optional) — 输出文件名（不含扩展名）",
  "output_path": "string (optional) — 保存目录，为空时自动确定",
  "override": "boolean (optional, default false) — 是否覆盖已有文件",
  "model": "string (optional) — 指定模型，为空时自动选择"
}
```

```python
from sdk.tool import tool

# 生成图片 / Generate image
result = tool.call('generate_image', {
    "prompt": "A minimalist flat-design icon for a travel planning app, blue and white color scheme",
    "mode": "generate",
    "size": "1:1",
    "image_name": "travel_icon"
})

# 编辑图片 / Edit image
result = tool.call('generate_image', {
    "prompt": "将背景改为纯白色",
    "mode": "edit",
    "image_paths": [".workspace/images/original.png"]
})
```

### image_search

<!--zh 按关键词搜索高质量图片，返回图片 URL 列表。实际返回数量可能少于请求数量。 -->
Search for high-quality images by keyword. Returned count may be less than requested.

**Schema:**

```json
{
  "topic_id": "string (required) — 同一搜索主题使用相同的 topic_id，用于图片去重",
  "requirements_xml": "string (required) — XML 格式的图片搜索需求，示例见下方"
}
```

```python
from sdk.tool import tool

result = tool.call('image_search', {
    "topic_id": "travel-report-images",
    "requirements_xml": """<requirements>
    <requirement>
        <name>Tokyo City Skyline</name>
        <query>Tokyo city skyline night 2024</query>
        <visual_understanding_prompt>确认是否为东京城市夜景，图片清晰度是否足够用于报告封面</visual_understanding_prompt>
        <requirement_explanation>用于旅游报告封面，需要高清东京城市夜景</requirement_explanation>
        <expected_aspect_ratio>16:9</expected_aspect_ratio>
        <count>5</count>
    </requirement>
</requirements>"""
})
```
