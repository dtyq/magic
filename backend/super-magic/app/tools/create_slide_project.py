from app.i18n import i18n
import asyncio
import os
import json
import shutil
from pathlib import Path
from typing import Any, Dict, List

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from agentlang.utils.file import safe_delete
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_guard_tool import WorkspaceGuardTool
from app.tools.download_from_markdown import DownloadFromMarkdown, DownloadFromMarkdownParams
from app.utils.async_file_utils import async_copy2

logger = get_logger(__name__)


class CreateSlideProjectParams(BaseToolParams):
    project_path: str = Field(
        ...,
        description="""<!--zh: 要创建的幻灯片项目的相对路径，优先使用用户偏好语言，项目名称要反映幻灯片主题，避免使用文件系统不支持的字符，示例：'特朗普遇刺事件分析'、'ChatGPT発展レポート'、'tesla-earnings-2024'-->
Relative path for slide project to create. Prioritize user preferred language, project name should reflect slide theme, avoid filesystem-unsupported characters. Examples: 'tesla-earnings-2024', '特朗普遇刺事件分析', 'ChatGPT発展レポート'"""
    )
    slide_count: int = Field(
        default=0,
        description="""<!--zh: 幻灯片页数。默认0表示创建空项目或由slides_array长度决定。若用户明确要求，则设定为指定值-->
Slide page count. Default 0 means creating empty project or determined by slides_array length. Set to specified value if user explicitly requires"""
    )
    slides_array: List[str] = Field(
        default_factory=list,
        description="""<!--zh: slides数组，包含所有幻灯片页面的路径。可以为空数组（空项目，后续通过edit_file添加）。文件名应使用幻灯片标题或摘要，建议简洁明了，避免使用文件系统不支持的字符，优先使用用户偏好语言。例如：[\"特朗普遇刺事件.html\", \"市场反应分析.html\"] 或 [\"tesla-q4-earnings.html\", \"openai-gpt5-launch.html\"]-->
Slides array containing paths of all slide pages. Can be empty array (empty project, add later via edit_file). Filenames should use slide titles or summaries, recommend concise and clear, avoid filesystem-unsupported characters, prioritize user preferred language. Examples: ["tesla-q4-earnings.html", "openai-gpt5-launch.html"] or ["特朗普遇刺事件.html", "市场反应分析.html"]"""
    )
    slide_images_content: str = Field(
        default="",
        description="""<!--zh: 内容将被用于创建slide-images.md文件并自动下载配图。为空则不创建该文件。格式要求请参考系统提示词详细说明-->
Content will be used to create slide-images.md file and auto-download images. Empty means not creating this file. Format requirements refer to system prompt detailed instructions"""
    )
    todo_list: str = Field(
        default="",
        description="""<!--zh: 内容将被用于创建slide-todo.md文件，用于记录幻灯片内容规划和任务分解。为空则不创建该文件-->
Content will be used to create slide-todo.md file for recording slide content planning and task breakdown. Empty means not creating this file"""
    )

    @field_validator('slides_array')
    @classmethod
    def validate_slides_array_count(cls, v, info):
        """验证slides数组基本格式（允许空数组）"""
        if not isinstance(v, list):
            raise ValueError("slides_array必须是一个数组")

        # 空数组允许（用于创建空项目）
        if len(v) == 0:
            return v

        # 非空数组的验证
        for item in v:
            if not isinstance(item, str):
                raise ValueError("slides_array中的每个元素都必须是字符串")
            if not item.strip():
                raise ValueError("slides_array中不能包含空字符串")

        return v


@tool()
class CreateSlideProject(AbstractFileTool[CreateSlideProjectParams], WorkspaceGuardTool[CreateSlideProjectParams]):
    """<!--zh
    创建幻灯片项目工具

    这个工具用于在工作区自动创建幻灯片项目的完整骨架结构：
    - 自动创建项目文件夹
    - 生成 index.html 演示控制器和 magic.project.js 配置文件
    - 在项目根目录创建 images 子文件夹用于存放图片资源
    - 复制 slide-bridge.js 页面通信脚本到项目根目录
    - 创建 slide-images.md 文件并下载配图
    - 创建 slide-todo.md 文件用于任务管理

    项目创建后，可以使用其他工具在项目根目录中生成具体的幻灯片 HTML 文件。
    每个幻灯片页面都是独立的 HTML 文件，支持多语言文件名和完整的自定义设计。

    项目结构：
    ```
    ChatGPT发展报告/
    ├── index.html         # 演示控制器（页面导航、键盘控制、缩放适配）
    ├── magic.project.js   # 项目配置文件（存储slides数组等配置信息）
    ├── slide-images.md    # 配图素材库
    ├── slide-todo.md      # 任务规划文件
    ├── slide-bridge.js    # 页面通信脚本
    ├── images/            # 图片资源文件夹
    ├── ChatGPT发展历程.html # 幻灯片页面文件
    ├── GPT-4突破性进展.html # 幻灯片页面文件
    ├── AI行业影响分析.html  # 幻灯片页面文件
    └── ...               # 其他幻灯片页面文件
    ```
    -->
    Create slide project tool

    This tool auto-creates complete skeleton structure for slide project in workspace:
    - Auto-create project folder
    - Generate index.html presentation controller and magic.project.js config file
    - Create images subfolder in project root for image resources
    - Copy slide-bridge.js page communication script to project root
    - Create slide-images.md file and download images
    - Create slide-todo.md file for task management

    After project creation, can use other tools to generate specific slide HTML files in project root.
    Each slide page is independent HTML file, supports multilingual filenames and full custom design.

    Project structure:
    ```
    ChatGPT-Development-Report/
    ├── index.html         # Presentation controller (page navigation, keyboard control, zoom adaptation)
    ├── magic.project.js   # Project config file (stores slides array and other config info)
    ├── slide-images.md    # Image material library
    ├── slide-todo.md      # Task planning file
    ├── slide-bridge.js    # Page communication script
    ├── images/            # Image resource folder
    ├── chatgpt-evolution.html      # Slide page file
    ├── gpt4-breakthrough.html      # Slide page file
    ├── ai-industry-impact.html     # Slide page file
    └── ...                         # Other slide page files
    ```
    """

    def get_prompt_hint(self) -> str:
        """
        获取工具提示信息，提供详细的参数格式要求

        Returns:
            str: 包含 slide_images_content 和 todo_list 格式要求的详细说明
        """
        return """\
<!--zh
<slide_images_content_format>
# slide_images_content 参数格式要求

slide_images_content 参数应包含完整的 slide-images.md 文件内容，格式如下：

```markdown
# 幻灯片配图素材库

## 项目信息
- 搜索主题: ChatGPT发展历程与技术突破
- 收集时间: 2025-01-22 10:30:00
- 图片总数: 15张

## 配图分类

### 封面/英雄图片

![{filename.png}]({图片URL})
- 序号: 1
- 尺寸: {width}x{height}像素 ({比例}，{横向/纵向/正方形})
- 视觉分析: {AI分析结果，不包含尺寸信息部分，用最少的文字做最详尽的描述，不少于50字}
- 适用场景: {建议的使用场景}
- 搜索关键词: {使用的搜索关键词}

![{filename.png}]({图片URL})
- 序号: 2
- 尺寸: {width}x{height}像素 ({比例}，{横向/纵向/正方形})
- 视觉分析: {AI分析结果，不包含尺寸信息部分，用最少的文字做最详尽的描述，不少于50字}
- 适用场景: {建议的使用场景}
- 搜索关键词: {使用的搜索关键词}

### 背景图片

![{filename.png}]({图片URL})
- 序号: 3
[每个图片按照相同格式，使用标准Markdown图片语法和连续编号...]

### 产品/内容展示图片

![{filename.jpg}]({图片URL})
- 序号: N
[按照相同格式继续，确保序号连续递增...]

### 图标/装饰图片

![{filename.jpg}]({图片URL})
- 序号: N+1
[按照相同格式继续，确保序号连续递增...]
```

重要说明：
1. 使用标准的 Markdown 图片格式：`![filename](url)`
2. filename 会作为图片的 alt text，同时也是下载时使用的文件名
3. filename 必须包含文件的扩展名，如.jpg、.png、.webp等
4. filename 优先使用用户偏好语言，简明易懂，如："特朗普遇刺事件.jpg"、"ChatGPT爆火现象.png"、"tesla-q4-earnings.jpg"
</slide_images_content_format>

<todo_list_format>
# todo_list 参数格式要求

todo_list 参数应包含完整的 slide-todo.md 文件内容，用于记录幻灯片内容规划和任务分解。

建议格式：
```markdown
# 幻灯片制作任务规划

## 项目信息
- 项目名称: ChatGPT发展报告
- 主题: ChatGPT的发展历程与影响分析
- 页数: 10
- 主体关键词: ChatGPT, OpenAI, GPT-4, 人工智能

## 内容大纲
### 封面（OpenAI里程碑.html）
介绍OpenAI的重要发展节点和突破性成就

### 目录（AI革命时间线.html）
展示人工智能发展的关键时间点和里程碑事件

### GPT系列演进（GPT-4技术突破.html）
详解GPT-4相比前代的技术创新和性能提升

### 商业化进程（ChatGPT商业奇迹.html）
分析ChatGPT如何在短时间内达到亿级用户规模
...
```
</todo_list_format>

<magic_project_js_format>
# magic.project.js 格式说明（slide 类型）

magic.project.js 是 JSONP 格式的项目配置文件，定义幻灯片项目的结构和页面列表。

## 文件结构

```javascript
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "项目名称",
  "slides": [
    "封面.html",
    "目录.html",
    "内容页.html"
  ]
};
window.magicProjectConfigure(window.magicProjectConfig);
```

## 字段说明

- **version**: 配置文件版本号，固定为 "1.0.0"
- **type**: 项目类型，固定为 "slide"（幻灯片类型）
- **name**: 项目名称，通常为文件夹名
- **slides**: 幻灯片页面路径数组，相对于项目根目录，定义页面顺序

## slides 数组特性

- 数组元素为字符串，每个字符串是一个 HTML 文件的相对路径
- 数组顺序即为幻灯片播放顺序
- 可以为空数组 `[]`（空项目），后续通过 edit_file 添加页面路径
- 前端根据此数组加载和导航幻灯片页面

## 修改示例

可以使用 edit_file 工具修改 slides 数组内容：
- 添加页面：在数组末尾追加新的文件路径
- 删除页面：移除数组中的指定路径
- 调整顺序：重新排列数组元素顺序

注意：修改后确保 JSONP 语法正确（合法的 JavaScript 代码）
</magic_project_js_format>
-->
<slide_images_content_format>
# slide_images_content Parameter Format Requirements

The slide_images_content parameter should contain complete slide-images.md file content, formatted as follows:

```markdown
# Slide Image Material Library

## Project Information
- Search Topic: ChatGPT Evolution and Technological Breakthroughs
- Collection Time: 2025-01-22 10:30:00
- Total Images: 15

## Image Categories

### Cover/Hero Images

![{filename.png}]({image URL})
- Index: 1
- Size: {width}x{height}px ({ratio}, {horizontal/vertical/square})
- Visual Analysis: {AI analysis result, excluding size info, describe in detail with minimum words, at least 50 characters}
- Use Case: {recommended usage scenario}
- Search Keywords: {keywords used}

![{filename.png}]({image URL})
- Index: 2
- Size: {width}x{height}px ({ratio}, {horizontal/vertical/square})
- Visual Analysis: {AI analysis result, excluding size info, describe in detail with minimum words, at least 50 characters}
- Use Case: {recommended usage scenario}
- Search Keywords: {keywords used}

### Background Images

![{filename.png}]({image URL})
- Index: 3
[Each image follows same format, use standard Markdown image syntax with sequential numbering...]

### Product/Content Display Images

![{filename.jpg}]({image URL})
- Index: N
[Continue with same format, ensure index increments sequentially...]

### Icon/Decorative Images

![{filename.jpg}]({image URL})
- Index: N+1
[Continue with same format, ensure index increments sequentially...]
```

Important Notes:
1. Use standard Markdown image format: `![filename](url)`
2. filename serves as image alt text and also as filename when downloading
3. filename must include file extension, e.g., .jpg, .png, .webp, etc.
4. filename should prioritize user's preferred language, be concise and clear, e.g., "trump-assassination-attempt.jpg", "chatgpt-viral-phenomenon.png", "tesla-q4-earnings.jpg"
</slide_images_content_format>

<todo_list_format>
# todo_list Parameter Format Requirements

The todo_list parameter should contain complete slide-todo.md file content for recording slide content planning and task breakdown.

Recommended format:
```markdown
# Slide Production Task Planning

## Project Information
- Project Name: ChatGPT Development Report
- Theme: ChatGPT Evolution and Impact Analysis
- Pages: 10
- Key Keywords: ChatGPT, OpenAI, GPT-4, Artificial Intelligence

## Content Outline
### Cover (OpenAI Milestones.html)
Introduce OpenAI's important development nodes and breakthrough achievements

### Table of Contents (AI Revolution Timeline.html)
Display key time points and milestone events in artificial intelligence development

### GPT Series Evolution (GPT-4 Technological Breakthrough.html)
Detail GPT-4's technical innovations and performance improvements compared to previous generations

### Commercialization Process (ChatGPT Business Miracle.html)
Analyze how ChatGPT reached billion-level user scale in short time
...
```
</todo_list_format>

<magic_project_js_format>
# magic.project.js Format Description (slide type)

magic.project.js is a JSONP format project configuration file that defines slide project structure and page list.

## File Structure

```javascript
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "slide",
  "name": "Project Name",
  "slides": [
    "cover.html",
    "contents.html",
    "content-page.html"
  ]
};
window.magicProjectConfigure(window.magicProjectConfig);
```

## Field Descriptions

- **version**: Configuration file version number, fixed as "1.0.0"
- **type**: Project type, fixed as "slide" (slide type)
- **name**: Project name, usually folder name
- **slides**: Slide page path array, relative to project root, defines page order

## slides Array Characteristics

- Array elements are strings, each string is a relative path to an HTML file
- Array order is the slide playback order
- Can be empty array `[]` (empty project), add page paths later via edit_file
- Frontend loads and navigates slide pages based on this array

## Modification Examples

Use edit_file tool to modify slides array content:
- Add page: Append new file path to end of array
- Remove page: Remove specified path from array
- Adjust order: Rearrange array element order

Note: Ensure valid JSONP syntax after modification (valid JavaScript code)
</magic_project_js_format>
"""

    async def execute(self, tool_context: ToolContext, params: CreateSlideProjectParams) -> ToolResult:
        """
        执行幻灯片项目创建操作

        Args:
            tool_context: 工具上下文
            params: 参数对象，包含项目路径和配置信息

        Returns:
            ToolResult: 包含创建结果的详细信息
        """
        created_files = []  # 记录已创建的文件，用于回滚
        project_path = None
        download_report = None  # 图片下载报告

        try:
            # 使用父类方法获取安全的项目路径
            project_path, error = self.get_safe_path(params.project_path)
            if error:
                return ToolResult(error=error)

            # 检查项目文件夹是否已存在
            folder_already_exists = await asyncio.to_thread(project_path.exists)

            # 创建项目文件夹（如果不存在）
            if not folder_already_exists:
                try:
                    await asyncio.to_thread(os.makedirs, project_path, exist_ok=False)
                    created_files.append(project_path)  # 只有新建的文件夹才加入回滚列表
                    logger.info(f"创建新项目文件夹: {project_path}")
                except Exception as e:
                    logger.error(f"创建项目文件夹失败: {e}")
                    return ToolResult(error="Failed to create project folder")
            else:
                logger.info(f"使用现有项目文件夹: {project_path}")

            # 定义所有文件路径
            slide_todo_path = project_path / "slide-todo.md"
            slide_images_path = project_path / "slide-images.md"
            target_index_path = project_path / "index.html"
            project_js_path = project_path / "magic.project.js"
            target_bridge_path = project_path / "slide-bridge.js"
            images_path = project_path / "images"

            # 创建 slide-todo.md 文件（仅当内容非空时）
            if params.todo_list and params.todo_list.strip():
                try:
                    async with self._file_versioning_context(tool_context, slide_todo_path, update_timestamp=False):
                        await asyncio.to_thread(slide_todo_path.write_text, params.todo_list, encoding='utf-8')
                    created_files.append(slide_todo_path)
                    logger.info(f"创建 slide-todo.md 文件: {slide_todo_path}")
                except Exception as e:
                    logger.error(f"创建 slide-todo.md 文件失败: {e}")
                    return ToolResult(error="Failed to create slide-todo.md file")

            # 创建 slide-images.md 文件（仅当内容非空时）
            if params.slide_images_content and params.slide_images_content.strip():
                try:
                    async with self._file_versioning_context(tool_context, slide_images_path, update_timestamp=False):
                        await asyncio.to_thread(slide_images_path.write_text, params.slide_images_content, encoding='utf-8')
                    created_files.append(slide_images_path)
                    logger.info(f"创建 slide-images.md 文件: {slide_images_path}")
                except Exception as e:
                    logger.error(f"创建 slide-images.md 文件失败: {e}")
                    return ToolResult(error="Failed to create slide-images.md file")

            # 复制 index.html 模板文件（无需修改）
            source_index_path = Path(__file__).parent / "magic_slide" / "index.html"

            if not await asyncio.to_thread(source_index_path.exists):
                raise FileNotFoundError(f"找不到模板文件: {source_index_path}")

            # 使用版本控制上下文复制模板文件
            try:
                async with self._file_versioning_context(tool_context, target_index_path, update_timestamp=False):
                    await async_copy2(source_index_path, target_index_path)
                created_files.append(target_index_path)
                logger.info(f"复制入口文件: {target_index_path}")
            except Exception as e:
                logger.error(f"复制 index.html 文件失败: {e}")
                return ToolResult(error="Failed to copy index.html file")

            # 生成 magic.project.js 配置文件
            config_data = {
                "version": "1.0.0",
                "type": "slide",
                "name": project_path.name,
                "slides": params.slides_array
            }

            config_json = json.dumps(config_data, indent=2, ensure_ascii=False)
            project_js_content = f"""\
window.magicProjectConfig = {config_json};
window.magicProjectConfigure(window.magicProjectConfig);
"""

            # 使用版本控制上下文生成 magic.project.js 配置文件
            try:
                async with self._file_versioning_context(tool_context, project_js_path, update_timestamp=False):
                    await asyncio.to_thread(project_js_path.write_text, project_js_content, encoding='utf-8')
                created_files.append(project_js_path)
                logger.info(f"创建项目配置文件: {project_js_path}")
            except Exception as e:
                logger.error(f"创建 magic.project.js 文件失败: {e}")
                return ToolResult(error="Failed to create magic.project.js file")

            # 创建 images 文件夹（检查是否已存在）
            images_already_exists = await asyncio.to_thread(images_path.exists)
            if not images_already_exists:
                try:
                    async with self._file_versioning_context(tool_context, images_path, update_timestamp=False):
                        await asyncio.to_thread(os.makedirs, images_path, exist_ok=False)
                    created_files.append(images_path)  # 只有新建的文件夹才加入回滚列表
                    logger.info(f"创建图片资源文件夹: {images_path}")
                except Exception as e:
                    logger.error(f"创建图片资源文件夹失败: {e}")
                    return ToolResult(error="Failed to create images folder")
            else:
                logger.info(f"图片资源文件夹已存在: {images_path}")

            # 下载图片到 images 文件夹（仅当 slide_images_content 非空时）
            if params.slide_images_content and params.slide_images_content.strip():
                logger.info("开始下载配图素材...")
                download_tool = DownloadFromMarkdown()
                download_params = DownloadFromMarkdownParams(
                    markdown_file=str(slide_images_path),
                    target_folder=str(images_path),
                    file_extensions="jpg,jpeg,png,gif,webp,svg"  # Only download image files
                )

                download_result = await download_tool.execute_purely(download_params, tool_context)
                if download_result.ok:
                    download_report = download_result.content
                    logger.info("图片下载完成")
                else:
                    # 图片下载失败不应该中断项目创建，只记录警告
                    logger.warning(f"图片下载失败: {download_result.content}")
                    download_report = f"⚠️ 图片下载失败: {download_result.content}"

            # 复制 slide-bridge.js 文件到项目根目录
            source_bridge_path = Path(__file__).parent / "magic_slide" / "slide-bridge.js"

            if not await asyncio.to_thread(source_bridge_path.exists):
                raise FileNotFoundError(f"找不到bridge文件: {source_bridge_path}")

            try:
                async with self._file_versioning_context(tool_context, target_bridge_path, update_timestamp=False):
                    await async_copy2(source_bridge_path, target_bridge_path)
                created_files.append(target_bridge_path)
                logger.info(f"复制bridge文件: {target_bridge_path}")
            except Exception as e:
                logger.error(f"复制 slide-bridge.js 文件失败: {e}")
                return ToolResult(error="Failed to copy slide-bridge.js file")

            # 生成结果信息
            result_content = self._generate_result_content(project_path, target_index_path, images_path, params, download_report)

            return ToolResult(content=result_content)

        except Exception as e:
            logger.exception(f"创建幻灯片项目失败: {e!s}")

            # 回滚：删除已创建的文件和文件夹
            await self._rollback_created_files(created_files)

            return ToolResult(error="Failed to create slide project")

    async def _rollback_created_files(self, created_files: list):
        """
        回滚已创建的文件和文件夹

        Args:
            created_files: 已创建的文件和文件夹路径列表
        """
        # 逆序删除，先删除文件，后删除文件夹
        for path in reversed(created_files):
            try:
                if isinstance(path, Path):
                    await safe_delete(path)
                    logger.info(f"回滚删除路径: {path}")
            except Exception as rollback_error:
                logger.error(f"回滚删除失败 {path}: {rollback_error}")
                # 继续尝试删除其他文件，不中断回滚过程

    def _generate_result_content(self, project_path: Path, index_path: Path, images_path: Path, params: CreateSlideProjectParams, download_report: str = None) -> str:
        """
        生成结构化的结果内容

        Args:
            project_path: 项目文件夹路径
            index_path: 入口文件路径
            images_path: 图片文件夹路径
            params: 项目参数
            download_report: 图片下载报告

        Returns:
            str: 格式化的结果内容
        """
        result = f"""🎯 幻灯片项目创建成功！

📁 项目结构：
{params.project_path}/
├── magic.project.js  # 项目配置文件 - 包含{len(params.slides_array)}个页面配置
├── index.html         # 演示控制器 - 纯模板，动态加载配置
├── slide-images.md    # 配图素材库 - 已创建并下载配图
├── slide-todo.md      # 任务规划文件 - 已创建内容大纲
├── slide-bridge.js    # 页面通信桥接脚本
├── images/            # 图片资源文件夹（已下载配图）
└── [页面文件].html    # 幻灯片页面文件（如：特朗普遇刺事件.html、ChatGPT爆火现象.html等）"""

        # 添加下载报告
        if download_report:
            result += f"\n\n{download_report}"

        result += """

🎯 下一步行动：
项目骨架已准备就绪，配图素材和任务规划已创建完成。
现在可以开始根据slide-todo.md中的大纲进行页面制作！
但是你不需要重复读取slide-todo.md和slide-images.md文件，因为它们是你刚刚创建的，你已经记住了其中的内容。
仅当你遗忘了其中的内容时，才需要重新读取。"""

        return result

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments or "project_path" not in arguments:
            return i18n.translate("create_slide_project.exception", category="tool.messages")

        project_path = arguments["project_path"]
        project_name = Path(project_path).name

        # 处理 slide_count：0 表示空项目，使用友好描述
        slide_count_value = arguments.get("slide_count", 0)
        if slide_count_value == 0:
            # 检查 slides_array 长度来确定实际页数
            slides_array = arguments.get("slides_array", [])
            if isinstance(slides_array, list) and len(slides_array) > 0:
                slide_count = len(slides_array)
            else:
                slide_count = i18n.translate("create_slide_project.empty_project", category="tool.messages")
        else:
            slide_count = slide_count_value

        return i18n.translate("create_slide_project.success", category="tool.messages", project_name=project_name,
                              slide_count=slide_count)

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """
        获取工具调用后的友好动作和备注
        """
        if not result.ok:
            return {
                "action": i18n.translate("create_slide_project", category="tool.actions"),
                "remark": i18n.translate("create_slide_project.exception", category="tool.messages")
            }

        return {
            "action": i18n.translate("create_slide_project", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments)
        }
