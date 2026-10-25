# Available Tools Reference

This document lists all tools available for TOOLS.md configuration in the super-magic project.
When managing employee tool configuration, refer to this list to select appropriate tool combinations.

Tool names must exactly match the names in this list; otherwise, compilation will fail.

`run_python_snippet`, `run_sdk_snippet`, and `compact_chat_history` are runtime-managed tools. Do not list them in `tools`; the runtime provides them automatically unless code execution is explicitly disabled for the Agent.

---

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
```

### Research & Analysis Employee

```yaml
tools:
  - web_search
  - read_webpages_as_markdown
  - visual_understanding
  - video_understanding
```

### Content Creation Employee

```yaml
tools:
  - web_search
  - read_webpages_as_markdown
  - generate_images
  - create_canvas
  - generate_canvas_images
  - image_search
  - visual_understanding
  - video_understanding
```

### Design & Visual Creation Employee

```yaml
tools:
  - web_search
  - visual_understanding
  - video_understanding
  - generate_canvas_images
  - search_canvas_images
  - create_canvas
```

### Development & Programming Employee

```yaml
tools:
  - shell_exec
  - web_search
  - read_webpages_as_markdown
  - edit_file_ranges
  - find_file_ranges
  - multi_edit_file
  - delete_files
```

### Data Analysis Employee

```yaml
tools:
  - shell_exec
  - web_search
  - visual_understanding
  - video_understanding
```

---

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
| `edit_file` | Edit a file by replacing matched content |
| `find_file_ranges` | Locate non-overlapping ranges in one file snapshot; accepts a ranges list and returns single-use IDs |
| `edit_file_ranges` | Apply an edits list of range IDs and replacements together in one file write |
| `multi_edit_file` | Apply multiple edits to a file |
| `delete_files` | Delete one or more files |

### Web Search & Fetch

| Tool | Description |
|------|-------------|
| `web_search` | Search the internet for information |
| `read_webpages_as_markdown` | Fetch webpages and convert to Markdown |
| `download_from_markdown` | Download files referenced in Markdown content |

External file downloads use the `download` system skill with `run_sdk_snippet`, including single-file downloads. Do not put `download_from_url` or the Code Mode-only `download_from_urls` tool in an Agent `tools:` list.

```yaml
skills:
  system_skills:
    - name: download
```

### Vision & Image

| Tool | Description |
|------|-------------|
| `visual_understanding` | Analyze image content and answer questions |
| `visual_understanding_webpage` | Screenshot and analyze a webpage visually |
| `video_understanding` | Analyze video content and answer questions |
| `generate_images` | Batch generate images from text prompts or reference images |
| `image_search` | Search for images by keyword |

### Code Execution

| Tool | Description |
|------|-------------|
| `shell_exec` | Execute shell commands |

`run_python_snippet` and `run_sdk_snippet` are automatically available when `code_execution` is enabled. They are not TOOLS.md entries.

### Task Management

| Tool | Description |
|------|-------------|
| `todo_create` | Create a TODO item |
| `todo_read` | Read TODO items |
| `todo_update` | Update a TODO item |

### Agent Collaboration

| Tool | Description |
|------|-------------|
| `call_agent` | Delegate a task to another specialized agent |
| `call_subagent` | Call a sub-agent for a specific task |
| `wait_for_subagents` | Wait for one or more background sub-agents to finish |

### Presentation & Slides (Code Mode Only)

Do not add these names to `TOOLS.md` or an agent's `tools:` whitelist. Enable
`creating-slides` for project/page creation and transition settings, or
`slide-template-maker` for template construction and webpage layout QA. Their
instructions call these tools through `run_sdk_snippet` with `sdk.tool.call(...)`.

| Tool | Description |
|------|-------------|
| `create_slide` | Create a slide in a presentation |
| `create_slide_project` | Create a new slide presentation project |
| `analysis_slide_webpage` | Analyze a slide/presentation webpage |
| `update_slide_transitions` | Update deck and per-slide transition settings |

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

### Browser Operations (Code Mode Only)

| Tool | Description |
|------|-------------|
| `browser_navigate` | Visit a URL in the current tab; the default entry for ordinary browsing |
| `browser_new_tab` | Create a separate tab only when the current page must be preserved |
| `browser_list_tabs` / `browser_select_tab` / `browser_close_tab` | List, select, or explicitly close tabs in a Browser instance |
| `browser_list_instances` / `browser_wait` | Inspect Browser instances and wait for current-tab conditions |
| `browser_read_page` / `browser_list_elements` / `browser_screenshot` | Read text, inspect page structure, and capture screenshots |
| `browser_click` / `browser_fill` / `browser_press` / `browser_hover` / `browser_scroll` | Interact with snapshot refs |
| `browser_select` / `browser_check` / `browser_upload_file` | Operate form controls and file inputs |
| `browser_visual_query` / `browser_find_visual` | Use visual analysis when structured observation is insufficient |
| `browser_evaluate` / `browser_read_console` / `browser_read_network` | Debug pages and inspect runtime activity |

### Other Tools

| Tool | Description |
|------|-------------|
| `reflection` | Trigger self-reflection for better reasoning |
| `thinking` | Extended thinking for complex problems |
| `summarize` | Summarize long content |
| `deep_write` | Deep writing with multi-pass refinement |
| `find_skills` | Search skills by keyword, or browse the available skill list |
| `read_skills` | Read a skill's SKILL.md content |

### IM Channel

| Tool | Description |
|------|-------------|
| `connect_lark_bot` | Connect to a Feishu/Lark bot |
| `connect_dingtalk_bot` | Connect to a DingTalk bot |
| `connect_wecom_bot` | Connect to a WeCom bot |
| `get_im_channel_status` | Get IM channel connection status |

### Canvas (Code Mode Only)

For content creation and design employees, configure `SKILLS.md` as follows and keep code execution enabled:

```yaml
skills:
  system_skills:
    - name: canvas-manager
```

Load `canvas-manager` before using Canvas. Call these tools through the automatically provided `run_sdk_snippet`; do not add their names or `run_sdk_snippet` to `TOOLS.md`. Follow the skill for generation parameters and waiting.

| Tool | Description |
|------|-------------|
| `initialize_canvas` | Create or reuse a Canvas project |
| `add_canvas_elements` | Import assets or create elements with generated content |
| `add_canvas_contents` | Add content candidates to existing elements |
| `wait_canvas_generation` | Wait for generation results |
| `query_canvas_overview` | Inspect current Canvas elements |
| `query_canvas_element_details` | Inspect exact element content and state |
| `search_canvas_image_candidates` | Search and import reference images |
| `search_canvas_image_prompts` | Search the shared prompt library |

Keep ordinary `generate_images` for internal image tasks that do not require Canvas.

### Data Dashboard

| Tool | Description |
|------|-------------|
| `create_dashboard_project` | Create a dashboard project |
| `create_dashboard_cards` | Create dashboard cards |
| `update_dashboard_cards` | Update dashboard cards |
| `delete_dashboard_cards` | Delete dashboard cards |
| `query_dashboard_cards` | Query dashboard cards |
| `download_dashboard_maps` | Download dashboard map data |
| `validate_dashboard` | Validate dashboard configuration |
