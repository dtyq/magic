<!--zh
# 可用工具参考

本文档列出 super-magic 项目中所有可在 TOOLS.md 中配置的工具。
管理员工工具配置时，参考此列表选择合适的工具组合。

工具名称必须与此列表中的名称完全匹配，否则编译时会报错。
-->
# Available Tools Reference

This document lists all tools available for TOOLS.md configuration in the super-magic project.
When managing employee tool configuration, refer to this list to select appropriate tool combinations.

Tool names must exactly match the names in this list; otherwise, compilation will fail.

---

<!--zh
## 按职能推荐的工具组合

根据员工的核心职能，以下是推荐的工具组合方案：

### 通用基础工具（建议所有员工都配置）
-->
## Recommended Tool Combinations by Function

Based on the employee's core function, here are recommended tool combinations:

### Universal Base Tools (recommended for all employees)

```yaml
tools:
  - list_dir
  - file_search
  - read_files
  - grep_search
  - write_file
  - edit_file
  - compact_chat_history
```

<!--zh
### 研究分析型员工
-->
### Research & Analysis Employee

```yaml
tools:
  - web_search
  - read_webpages_as_markdown
  - visual_understanding
  - run_python_snippet
  - download_from_url
  - download_from_urls
```

<!--zh
### 内容创作型员工
-->
### Content Creation Employee

```yaml
tools:
  - web_search
  - read_webpages_as_markdown
  - generate_image
  - image_search
  - visual_understanding
  - run_python_snippet
```

<!--zh
### 开发编程型员工
-->
### Development & Programming Employee

```yaml
tools:
  - shell_exec
  - run_python_snippet
  - web_search
  - read_webpages_as_markdown
  - edit_file_range
  - multi_edit_file
  - multi_edit_file_range
  - delete_files
```

<!--zh
### 数据分析型员工
-->
### Data Analysis Employee

```yaml
tools:
  - run_python_snippet
  - shell_exec
  - web_search
  - visual_understanding
  - convert_to_markdown
  - download_from_url
```

---

<!--zh
## 完整工具列表

### 文件操作类
-->
## Complete Tool List

### File Operations

| Tool | Description |
|------|-------------|
| `list_dir` | List directory contents |
| `file_search` | Search for files by name pattern |
| `read_files` | Read one or more files |
| `read_file` | Read a single file |
| `grep_search` | Search file contents by regex |
| `write_file` | Write content to a file |
| `append_to_file` | Append content to an existing file |
| `edit_file` | Edit a file by replacing matched content |
| `edit_file_range` | Edit a file within a line range |
| `multi_edit_file` | Apply multiple edits to a file |
| `multi_edit_file_range` | Apply multiple edits within line ranges |
| `delete_files` | Delete one or more files |

<!--zh
### 网络搜索与抓取类
-->
### Web Search & Fetch

| Tool | Description |
|------|-------------|
| `web_search` | Search the internet for information |
| `read_webpages_as_markdown` | Fetch webpages and convert to Markdown |
| `download_from_url` | Download a file from a URL |
| `download_from_urls` | Batch download files from multiple URLs |
| `download_from_markdown` | Download files referenced in Markdown content |

<!--zh
### 视觉与图片类
-->
### Vision & Image

| Tool | Description |
|------|-------------|
| `visual_understanding` | Analyze image content and answer questions |
| `visual_understanding_webpage` | Screenshot and analyze a webpage visually |
| `generate_image` | Generate images from text or edit existing images |
| `image_search` | Search for images by keyword |

<!--zh
### 代码执行类
-->
### Code Execution

| Tool | Description |
|------|-------------|
| `shell_exec` | Execute shell commands |
| `run_python_snippet` | Run Python code directly |

<!--zh
### 内容处理类
-->
### Content Processing

| Tool | Description |
|------|-------------|
| `convert_to_markdown` | Convert documents (Excel, DOCX, PDF, CSV) to Markdown |
| `convert_pdf` | Convert files to/from PDF format |

<!--zh
### 记忆管理类
-->
### Memory Management

| Tool | Description |
|------|-------------|
| `create_memory` | Create a new memory entry |
| `update_memory` | Update an existing memory entry |
| `delete_memory` | Delete a memory entry |

<!--zh
### 任务管理类
-->
### Task Management

| Tool | Description |
|------|-------------|
| `todo_create` | Create a TODO item |
| `todo_read` | Read TODO items |
| `todo_update` | Update a TODO item |

<!--zh
### Agent 协作类
-->
### Agent Collaboration

| Tool | Description |
|------|-------------|
| `call_agent` | Delegate a task to another specialized agent |
| `call_subagent` | Call a sub-agent for a specific task |
| `get_sub_agent_results` | Retrieve results from a sub-agent |

<!--zh
### 演示与幻灯片类
-->
### Presentation & Slides

| Tool | Description |
|------|-------------|
| `create_slide` | Create a slide in a presentation |
| `create_slide_project` | Create a new slide presentation project |
| `analysis_slide_webpage` | Analyze a slide/presentation webpage |

<!--zh
### 音视频类
-->
### Audio & Video

| Tool | Description |
|------|-------------|
| `audio_understanding` | Analyze and transcribe audio content |
| `split_audio` | Split an audio file into segments |
| `setup_audio_project` | Set up an audio processing project |
| `analyze_audio_project` | Analyze an audio project |
| `setup_video_project` | Set up a video processing project |
| `analyze_video_project` | Analyze a video project |
| `convert_video_to_audio` | Extract audio from video |
| `download_youtube_video_media` | Download YouTube video/audio |
| `get_youtube_video_info` | Get YouTube video metadata |

<!--zh
### 浏览器操作类
-->
### Browser Operations

| Tool | Description |
|------|-------------|
| `use_browser` | Perform browser automation actions |

<!--zh
### 其他工具
-->
### Other Tools

| Tool | Description |
|------|-------------|
| `compact_chat_history` | Compress chat history to save context |
| `reflection` | Trigger self-reflection for better reasoning |
| `thinking` | Extended thinking for complex problems |
| `summarize` | Summarize long content |
| `deep_write` | Deep writing with multi-pass refinement |
| `skill_list` | List all available skills |
| `skills_read` | Read a skill's SKILL.md content |
| `skill_read_references` | Read a skill's reference documents |
| `run_skills_snippet` | Run a code snippet in the context of a skill |

<!--zh
### IM 渠道类
-->
### IM Channel

| Tool | Description |
|------|-------------|
| `connect_lark_bot` | Connect to a Feishu/Lark bot |
| `connect_dingtalk_bot` | Connect to a DingTalk bot |
| `connect_wecom_bot` | Connect to a WeCom bot |
| `get_im_channel_status` | Get IM channel connection status |

<!--zh
### 设计画布类
-->
### Design Canvas

| Tool | Description |
|------|-------------|
| `create_design_project` | Create a design project |
| `create_canvas_element` | Create a canvas element |
| `update_canvas_element` | Update a canvas element |
| `delete_canvas_element` | Delete a canvas element |
| `query_canvas_overview` | Query canvas overview |
| `query_canvas_element` | Query a specific canvas element |
| `batch_create_canvas_elements` | Batch create canvas elements |
| `batch_update_canvas_elements` | Batch update canvas elements |
| `generate_images_to_canvas` | Generate images directly to canvas |
| `search_images_to_canvas` | Search and add images to canvas |
| `reorder_canvas_elements` | Reorder canvas elements |

<!--zh
### 数据看板类
-->
### Data Dashboard

| Tool | Description |
|------|-------------|
| `create_dashboard_project` | Create a dashboard project |
| `create_dashboard_cards` | Create dashboard cards |
| `update_dashboard_cards` | Update dashboard cards |
| `delete_dashboard_cards` | Delete dashboard cards |
| `query_dashboard_cards` | Query dashboard cards |
| `backup_dashboard_template` | Backup dashboard template |
| `update_dashboard_template` | Update dashboard template |
| `download_dashboard_maps` | Download dashboard map data |
| `validate_dashboard` | Validate dashboard configuration |
