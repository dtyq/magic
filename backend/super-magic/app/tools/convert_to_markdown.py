from app.i18n import i18n
import asyncio
import time
from typing import Any, Dict, Optional, Union
from pathlib import Path
import aiofiles
import aiofiles.os

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from agentlang.tools.tool_result import ToolResult
from agentlang.event.event import EventType
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.workspace_tool import WorkspaceTool
from agentlang.logger import get_logger
from app.tools.core import BaseToolParams, tool
from app.paths import PathManager
from agentlang.utils.file import generate_safe_filename

from app.utils.file_constants import CONVERTIBLE_EXTENSIONS, TEXT_EXTENSIONS

logger = get_logger(__name__)

class ConvertToMarkdownParams(BaseToolParams):
    input_path: str = Field(
        ...,
        description="""<!--zh: 要转换的输入文件路径（相对于工作空间）。支持多种文件类型：PDF、Word、Excel、PowerPoint、图片、笔记本等。注意：仅支持本地文件，网络文件请先用 download_from_url 工具下载。-->
Input file path to convert (relative to workspace). Supports multiple file types: PDF, Word, Excel, PowerPoint, images, notebooks, etc. Note: Only supports local files, download network files with download_from_url tool first."""
    )
    output_path: str = Field(
        ...,
        description="""<!--zh: 输出Markdown文件路径（必填，相对于工作空间）。指定转换后的文件保存位置，例如：'converted/report.md'。-->
Output Markdown file path (required, relative to workspace). Specify save location for converted file, e.g., 'converted/report.md'."""
    )
    override: bool = Field(
        True,
        description="""<!--zh: 是否覆盖已存在的输出文件-->
Whether to override existing output file"""
    )
    force_refresh: bool = Field(
        False,
        description="""<!--zh: 强制重新转换，即使已存在转换结果-->
Force re-conversion even if conversion result already exists"""
    )
    extract_images: bool = Field(
        True,
        description="""<!--zh: 是否从文件中提取并处理图片（对支持的格式）-->
Whether to extract and process images from file (for supported formats)"""
    )

    @field_validator('input_path')
    @classmethod
    def validate_input_path(cls, v: str) -> str:
        """验证输入路径不为空"""
        if not v or not v.strip():
            raise ValueError("输入路径不能为空")
        return v.strip()


def _build_ai_content(source_name: str, saved_file_path: str,
                      summary: Optional[str] = None, is_existing: bool = False,
                      images_dir: Optional[str] = None) -> str:
    """构建AI内容输出"""

    # 明确告知文件转换已完成并保存
    if is_existing:
        status_msg = f"✅ **文件转换完成**：`{source_name}` 已有 Markdown 格式的结果，文件位于 `{saved_file_path}`。"
    else:
        status_msg = f"✅ **文件转换完成**：`{source_name}` 已成功转换为 Markdown 格式，文件已保存至 `{saved_file_path}`。"

    # 添加图片目录信息（如果存在）
    if images_dir:
        status_msg += f"\n📁 **图片提取**：文档中的图片已提取并保存至 `{images_dir}` 目录。"

    # 添加摘要信息（如果有的话）
    if summary:
        ai_content = f"{status_msg}\n\n**内容摘要**（仅供预览）:\n{summary}"
    else:
        ai_content = status_msg

    # 明确提示这是完成报告，不需要额外操作
    ai_content += f"\n\n**说明**: 以上为转换完成报告，无需进行额外的文件操作。如需查看完整内容，请直接打开已保存的文件。"

    return ai_content


@tool()
class ConvertToMarkdown(AbstractFileTool[ConvertToMarkdownParams], WorkspaceTool[ConvertToMarkdownParams]):
    """<!--zh
    文档格式转换工具，将文档转换为Markdown格式并保存到指定位置。

    **优先使用场景**（用户提到这些关键词时直接使用本工具）：
    - "转换"、"转为MD"、"转成Markdown"、"生成MD文件"
    - "帮我转换成md文件"、"转换为markdown格式"
    - 任何涉及文档格式转换的需求

    **使用场景**：
    - 用户明确要求转换文档格式
    - 用户需要将文档保存为Markdown格式用于编辑或分享
    - 用户需要批量处理和转换文档格式

    **重要说明**：
    - 用户要求转换时，请直接使用本工具，无需先用 `read_file` 了解文件结构
    - 如果用户只是想"读取"、"查看"、"分析"文档内容，才使用 `read_file` 工具
    - 本工具专门用于格式转换，需要指定明确的输出路径
    - 转换后的文件会保存到工作区中，用户可以进一步编辑使用

    支持的文件类型：
    - PDF文件 (.pdf)
    - Word文档 (.doc, .docx)
    - Excel文件 (.xls, .xlsx, .csv)
    - PowerPoint (.ppt, .pptx)
    - 图片文件 (.png, .jpg, .jpeg, .gif, .bmp, .tiff, .webp)
    - Jupyter笔记本 (.ipynb)

    要求：
    - 输入文件路径 (`input_path`) 必须是工作区内的本地文件
    - 输出路径 (`output_path`) 是必填参数，指定转换后文件的保存位置
    - 如需处理网络文件，请先使用 `download_from_url` 工具下载到本地

    调用示例：
    ```
    {
        "input_path": "documents/report.pdf",
        "output_path": "converted/report.md"
    }
    ```
    -->
    Document format conversion tool that converts documents to Markdown format and saves to specified location.

    **Priority use scenarios** (use directly when user mentions these keywords):
    - "convert", "to MD", "to Markdown", "generate MD file"
    - "help me convert to md file", "convert to markdown format"
    - Any document format conversion needs

    **Use scenarios**:
    - User explicitly requests document format conversion
    - User needs to save document as Markdown format for editing or sharing
    - User needs to batch process and convert document formats

    **Important notes**:
    - When user requests conversion, use this tool directly, no need to use `read_file` first
    - If user only wants to "read", "view", "analyze" document content, then use `read_file` tool
    - This tool is specifically for format conversion, requires explicit output path
    - Converted file will be saved to workspace for further editing

    Supported file types:
    - PDF files (.pdf)
    - Word documents (.doc, .docx)
    - Excel files (.xls, .xlsx, .csv)
    - PowerPoint (.ppt, .pptx)
    - Image files (.png, .jpg, .jpeg, .gif, .bmp, .tiff, .webp)
    - Jupyter notebooks (.ipynb)

    Requirements:
    - Input file path (`input_path`) must be local file within workspace
    - Output path (`output_path`) is required parameter, specifies save location for converted file
    - For network files, use `download_from_url` tool to download locally first

    Usage example:
    ```
    {
        "input_path": "documents/report.pdf",
        "output_path": "converted/report.md"
    }
    ```
    """

    def __init__(self, **kwargs):
        """初始化转换器和文件解析系统"""
        super().__init__()
        # 延迟初始化文件解析器以避免循环导入
        self.file_parser = None

        # 使用共享的文件类型常量
        self.convertible_extensions = CONVERTIBLE_EXTENSIONS
        self.text_extensions = TEXT_EXTENSIONS

    def _get_file_parser(self):
        """获取文件解析器实例，使用延迟导入避免循环依赖"""
        if self.file_parser is None:
            from app.utils.file_parse import get_file_parser
            self.file_parser = get_file_parser()
        return self.file_parser

    async def execute(
        self,
        tool_context: ToolContext,
        params: ConvertToMarkdownParams
    ) -> ToolResult:
        """执行文件转换"""
        return await self.execute_purely(params, tool_context)

    async def execute_purely(
        self,
        params: ConvertToMarkdownParams,
        tool_context: Optional[ToolContext] = None
    ) -> ToolResult:
        """核心转换逻辑"""
        workspace_root = PathManager.get_workspace_dir()
        input_path = params.input_path
        target_output_path_str = params.output_path
        override_output = params.override
        force_refresh = params.force_refresh
        extract_images = params.extract_images

        try:
            # 1. 验证输入文件
            safe_input_path = self.resolve_path(input_path)
            if not await aiofiles.os.path.exists(safe_input_path):
                return ToolResult.error(f"输入文件不存在: '{input_path}'")

            if await aiofiles.os.path.isdir(safe_input_path):
                return ToolResult.error(f"输入路径是目录，不是文件: '{input_path}'")

            # 2. 检查文件类型是否需要转换
            file_extension = Path(input_path).suffix.lower()

            if file_extension in self.text_extensions:
                return ToolResult.error(f"文件类型 '{file_extension}' 不支持转换。此工具专门用于转换复杂文档格式（PDF、Word、Excel等）。")

            if file_extension not in self.convertible_extensions:
                supported_types = ', '.join(sorted(self.convertible_extensions))
                return ToolResult.error(f"不支持的文件类型 '{file_extension}'。支持的转换类型: {supported_types}")

            logger.info(f"开始转换文件为Markdown: '{input_path}' (类型: {file_extension})")

            # 3. 确定临时输出路径用于解析
            # 首先验证和准备最终输出路径
            safe_output_path = self.resolve_path(target_output_path_str)
            # 确保父目录存在
            await asyncio.to_thread(safe_output_path.parent.mkdir, parents=True, exist_ok=True)

            # 处理已存在文件的情况
            if await aiofiles.os.path.exists(safe_output_path):
                if override_output or force_refresh:
                    # 删除已存在的输出文件
                    await aiofiles.os.remove(safe_output_path)
                    logger.info(f"已删除已存在的输出文件: {target_output_path_str}")

                    # 如果存在对应的图片目录，也一并删除
                    potential_images_dir = safe_output_path.with_suffix(safe_output_path.suffix + '-images')
                    if await aiofiles.os.path.exists(potential_images_dir) and await aiofiles.os.path.isdir(potential_images_dir):
                        import shutil
                        await asyncio.to_thread(shutil.rmtree, potential_images_dir)
                        logger.info(f"已删除已存在的图片目录: {potential_images_dir.relative_to(workspace_root)}")
                else:
                    return ToolResult.error(f"输出文件 '{target_output_path_str}' 已存在。请设置 override=true 来覆盖。")

            # 4. 调用文件解析器，直接输出到目标路径
            parse_kwargs = {
                'extract_images': extract_images,
                'force_refresh': force_refresh
            }

            # 使用 versioning context 处理文件转换（无需更新时间戳，因为是工具生成的文件）
            if tool_context:
                async with self._file_versioning_context(tool_context, safe_output_path, update_timestamp=False):
                    parse_result = await self._get_file_parser().parse(safe_input_path, safe_output_path, **parse_kwargs)
            else:
                parse_result = await self._get_file_parser().parse(safe_input_path, safe_output_path, **parse_kwargs)

            if not parse_result.success:
                error_msg = parse_result.error_message or "未知解析错误"
                return ToolResult.error(f"文件转换失败: {error_msg}")

            # 5. 从生成的文件读取内容用于摘要和返回
            if not await aiofiles.os.path.exists(safe_output_path):
                return ToolResult.error("文件转换完成但输出文件未生成")

            async with aiofiles.open(safe_output_path, "r", encoding="utf-8") as f:
                markdown_content = await f.read()

            if not markdown_content or not markdown_content.strip():
                return ToolResult.error("文件转换结果为空")

            # 5.1. 生成摘要（使用延迟导入避免循环导入）
            source_name = Path(input_path).name
            summary = None
            try:
                # 使用延迟导入避免循环依赖
                from app.tools.summarize import Summarize
                summarizer = Summarize()
                generated_summary = await summarizer.summarize_content(
                    content=markdown_content,
                    title=source_name,
                    target_length=500
                )
                if generated_summary:
                    summary = generated_summary
                else:
                    logger.warning(f"为文档 '{source_name}' 生成摘要失败（返回空）。")
            except ImportError as import_e:
                logger.debug(f"无法导入摘要工具，跳过摘要生成: {import_e}")
            except Exception as summary_e:
                logger.error(f"为文档 '{source_name}' 生成摘要时发生异常: {summary_e}", exc_info=True)

            # 6. 计算相对路径
            saved_file_relative_path = str(safe_output_path.relative_to(workspace_root))

            # 如果有图片目录，也触发目录事件
            if tool_context and parse_result.output_images_dir:
                images_dir_absolute = workspace_root / parse_result.output_images_dir
                if await aiofiles.os.path.exists(images_dir_absolute):
                    await self._dispatch_file_event(tool_context, str(images_dir_absolute), EventType.FILE_CREATED)
                    logger.info(f"文件事件已触发: FILE_CREATED (图片目录) - {parse_result.output_images_dir}")

            logger.info(f"文件转换完成: {saved_file_relative_path}")

            # 7. 构建返回结果
            extra_info = {
                "source_name": source_name,
                "saved_file_path": saved_file_relative_path,
                "full_content": markdown_content,
                "summary": summary,
                "conversion_strategy": parse_result.conversion_strategy
            }

            # 添加图片目录信息（如果存在）
            if parse_result.output_images_dir:
                extra_info["output_images_dir"] = parse_result.output_images_dir
                extra_info["images_extracted"] = "true"
            else:
                extra_info["images_extracted"] = "false"

            return ToolResult(
                content=_build_ai_content(
                    source_name,
                    saved_file_relative_path,
                    summary=summary,
                    images_dir=parse_result.output_images_dir if parse_result.output_images_dir else None
                ),
                extra_info=extra_info
            )

        except Exception as e:
            logger.exception(f"文件转换操作失败: {e}")
            return ToolResult.error(f"文件转换遇到意外错误: {str(e)}")

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """生成前端显示的工具详情"""
        try:
            saved_file_path = result.extra_info.get("saved_file_path")
            source_name = result.extra_info.get("source_name", "converted_file")
            summary = result.extra_info.get("summary")

            # 优先使用摘要内容，避免因内容过长导致的错误
            display_content = None

            if summary:
                # 使用摘要作为显示内容
                display_content = f"# 文档转换摘要\n\n{summary}\n\n---\n\n**说明**: 以上为文档内容摘要。如需查看完整内容，请打开转换后的文件：`{saved_file_path or '转换文件'}`"
                logger.debug("使用摘要内容生成工具详情")
            else:
                # 如果没有摘要，尝试生成简短的预览内容
                full_content = result.extra_info.get("full_content")
                is_cached = result.extra_info.get("is_cached", False)

                # 如果是已存在的结果且没有 full_content，尝试读取转换后的文件的前部分
                if not full_content and is_cached and saved_file_path:
                    try:
                        workspace_root = PathManager.get_workspace_dir()
                        result_file_path = workspace_root / saved_file_path
                        if await aiofiles.os.path.exists(result_file_path):
                            async with aiofiles.open(result_file_path, "r", encoding="utf-8") as f:
                                # 只读取前2000字符作为预览
                                full_content = await f.read(2000)
                            logger.debug(f"从已保存的文件读取部分内容用于工具详情: {saved_file_path}")
                    except Exception as e:
                        logger.warning(f"读取已保存的文件失败: {saved_file_path}, error={e}")

                if full_content:
                    # 截取前1500字符作为预览，避免内容过长
                    preview_content = full_content[:1500]
                    if len(full_content) > 1500:
                        preview_content += "\n\n... (内容已截断)"

                    display_content = f"# 文档转换预览\n\n{preview_content}\n\n---\n\n**说明**: 以上为文档内容预览。如需查看完整内容，请打开转换后的文件：`{saved_file_path or '转换文件'}`"
                    logger.debug("使用截断内容生成工具详情")
                else:
                    # 如果都没有，生成基本信息
                    display_content = f"# 文档转换完成\n\n文档已成功转换为 Markdown 格式。\n\n**转换文件**: `{saved_file_path or '转换文件'}`\n\n**说明**: 请打开转换后的文件查看完整内容。"
                    logger.warning("无法获取文件内容，使用基本信息生成工具详情")

            # 确定显示文件名
            if saved_file_path:
                display_filename = f"{Path(saved_file_path).stem}_summary.md"
            else:
                safe_filename_base = generate_safe_filename(source_name) or "converted_file"
                display_filename = f"{safe_filename_base}_summary.md"

            return ToolDetail(
                type=DisplayType.MD,
                data=FileContent(
                    file_name=display_filename,
                    content=display_content
                )
            )
        except Exception as e:
            logger.error(f"生成工具详情时出错: {e}", exc_info=True)
            return None

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """获取工具执行后的友好动作和备注"""
        strategy_code_mapping = {
            "performance": "read_file.conversion_strategy_performance",
            "quality": "read_file.conversion_strategy_quality",
            "balanced": "read_file.conversion_strategy_balanced"
        }

        source_name = "文件"
        if result.extra_info and "source_name" in result.extra_info:
            source_name = result.extra_info["source_name"]
        elif arguments and "input_path" in arguments:
            source_name = Path(arguments["input_path"]).name

        if result.ok and result.extra_info and result.extra_info.get("saved_file_path"):
            saved_path = result.extra_info['saved_file_path']
            conversion_strategy = result.extra_info.get("conversion_strategy", "balanced")

            if isinstance(conversion_strategy, str) and conversion_strategy != "balanced":
                strategy_code = strategy_code_mapping.get(conversion_strategy, "read_file.conversion_strategy_balanced")
                strategy_display = i18n.translate(strategy_code, category="tool.messages")
                conversion_info = i18n.translate("read_file.converted_with_strategy", category="tool.messages", strategy=strategy_display)
                remark = f"{conversion_info} {source_name} → `{saved_path}`"
            else:
                conversion_info = i18n.translate("read_file.converted", category="tool.messages")
                remark = f"{conversion_info} {source_name} → `{saved_path}`"
        else:
            remark = source_name + i18n.translate("convert_to_markdown.process_error", category="tool.messages")

        return {
            "action": i18n.translate("convert_to_markdown", category="tool.actions"),
            "remark": remark
        }
