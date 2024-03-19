import asyncio
import os
import re
from typing import Any, Dict, Optional, Union
from pathlib import Path
import urllib.parse
from datetime import datetime
import aiofiles

import httpx
from pydantic import Field, field_validator, model_validator

from agentlang.config.config import config
from agentlang.context.tool_context import ToolContext
from agentlang.utils.metadata import MetadataUtil
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from agentlang.tools.tool_result import ToolResult
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.workspace_guard_tool import WorkspaceGuardTool
from app.utils.pdf_converter_utils import convert_pdf_locally
from app.tools.download_from_url import DownloadFromUrl, DownloadFromUrlParams
from agentlang.logger import get_logger
from app.tools.core import BaseTool, BaseToolParams, tool
from app.tools.summarize import Summarize
from app.paths import PathManager
from agentlang.utils.file import generate_safe_filename

logger = get_logger(__name__)

# 保存 Markdown 结果的目录
DEFAULT_RECORDS_DIR_NAME = ".webview-reports"

async def get_or_create_records_dir(dir_name: str = DEFAULT_RECORDS_DIR_NAME) -> Path:
    """获取或创建记录目录"""
    records_dir = PathManager.get_workspace_dir() / dir_name
    await asyncio.to_thread(records_dir.mkdir, parents=True, exist_ok=True)
    return records_dir

def is_safe_path(base_path: Path, target_path_str: str) -> bool:
    """检查目标路径是否在基础路径下且安全"""
    try:
        # 使用 resolve() 来处理 '..' 等情况
        target_path = (base_path / target_path_str).resolve(strict=False) # strict=False 允许解析不存在的路径
        # 确保解析后的路径仍然在基础路径下
        return target_path.is_relative_to(base_path.resolve(strict=True))
    except Exception:
        return False

class ConvertPdfParams(BaseToolParams):
    input_path: str = Field(
        ...,
        description="""<!--zh: 输入的 PDF 来源，可以是本地文件路径（相对于工作空间）或 HTTP/HTTPS URL。-->
Input PDF source, can be local file path (relative to workspace) or HTTP/HTTPS URL."""
    )
    output_path: str = Field(
        "",
        description="""<!--zh: 输出的 Markdown 文件保存路径（可选，相对于工作空间）。如果未提供：对于 URL 来源，将自动生成路径保存在 `.webview-reports` 目录下；(未来计划)对于本地文件来源，将保存在源文件相同目录下，同名但扩展名为 .md。-->
Output Markdown file save path (optional, relative to workspace). If not provided: For URL sources, will auto-generate path and save in `.webview-reports` directory; (future plan) For local file sources, will save in same directory as source file with same name but .md extension."""
    )
    mode: str = Field(
        "smart", # 默认为智能模式
        description="""<!--zh: 转换模式：'smart' (使用外部智能API处理URL，质量可能更高但较慢) 或 'normal' (使用本地库处理本地文件和URL，速度更快)。如果输入是本地文件，将强制使用 'normal' 模式。-->
Conversion mode: 'smart' (use external intelligent API for URLs, may have higher quality but slower) or 'normal' (use local library for local files and URLs, faster). If input is local file, will force 'normal' mode."""
    )
    override: bool = Field(
        True,
        description="""<!--zh: 当输出文件已存在时，是否覆盖。仅在指定了 `output_path` 时生效。-->
Whether to override when output file already exists. Only effective when `output_path` is specified."""
    )

@tool()
class ConvertPdf(AbstractFileTool[ConvertPdfParams], WorkspaceGuardTool[ConvertPdfParams]):
    """<!--zh
    PDF 转换工具，将指定的 PDF 文件（本地路径或 URL）转换为 Markdown 格式。

    可以指定输出 Markdown 文件的保存路径（相对于工作空间），如果不指定，将自动处理。

    适用于：
    - 将在线 PDF 文档转换为 Markdown 格式以便阅读或进一步处理。
    - 提取 PDF 中的文本和基本结构。

    支持模式:
    - **smart (默认)**: 使用外部智能 API 处理 URL。可能提供更高质量的转换结果，但仅支持 URL 且可能较慢。
    - **normal**: 使用内置库进行转换。支持本地文件和 URL，速度较快，但对于复杂或扫描版 PDF 效果可能不如 smart 模式。

    要求：
    - 输入 PDF 的路径 (`input_path`)，可以是工作区相对路径或 URL。
    - （可选）转换模式 (`mode`)，默认为 'smart'。如果 `input_path` 是本地文件，将强制使用 'normal' 模式。
    - （可选）提供一个安全的工作空间相对路径 (`output_path`) 用于保存 Markdown 文件。如果不提供，将自动生成路径。
    - （可选）是否覆盖已存在的文件 (`override`)，默认为 true。仅在提供了 `output_path` 时有效。

    调用示例：
    ```
    {
        "input_path": "documents/report.pdf", // 本地文件
        "output_path": ".webview-reports/converted_report.md"
    }
    ```
    -->
    PDF conversion tool that converts specified PDF file (local path or URL) to Markdown format.

    Can specify output Markdown file save path (relative to workspace), will auto-handle if not specified.

    Applicable to:
    - Convert online PDF documents to Markdown format for reading or further processing.
    - Extract text and basic structure from PDF.

    Supported modes:
    - **smart (default)**: Use external intelligent API to process URL. May provide higher quality conversion results, but only supports URL and may be slower.
    - **normal**: Use built-in library for conversion. Supports local files and URLs, faster, but may not work as well as smart mode for complex or scanned PDFs.

    Requirements:
    - Input PDF path (`input_path`), can be workspace relative path or URL.
    - (Optional) Conversion mode (`mode`), defaults to 'smart'. If `input_path` is local file, will force 'normal' mode.
    - (Optional) Provide safe workspace relative path (`output_path`) to save Markdown file. If not provided, will auto-generate path.
    - (Optional) Whether to override existing file (`override`), defaults to true. Only effective when `output_path` is provided.

    Usage example:
    ```
    {
        "input_path": "documents/report.pdf", // Local file
        "output_path": ".webview-reports/converted_report.md"
    }
    ```
    ```
    {
        "input_path": "https://example.com/report.pdf",
        "output_path": ".webview-reports/converted_report.md"
    }
    ```
    或者不指定输出路径：
    ```
    {
        "input_path": "https://another.example.com/document.pdf",
        "mode": "normal" // 使用本地库转换 URL
    }
    ```
    ```
    {
        "input_path": "local_files/mydoc.pdf" // 本地文件，自动使用 normal 模式
    }
    ```
    """

    async def execute(
        self,
        tool_context: ToolContext,
        params: ConvertPdfParams
    ) -> ToolResult:
        """执行 PDF 转换。"""
        return await self.execute_purely(params, tool_context)

    async def execute_purely(
        self,
        params: ConvertPdfParams,
        tool_context: Optional[ToolContext] = None
    ) -> ToolResult:
        """执行 PDF 转换的核心逻辑，无需上下文。"""
        workspace_root = PathManager.get_workspace_dir()
        input_location = params.input_path
        target_output_path_str = params.output_path
        user_mode = params.mode.lower()
        override_output = params.override

        # --- 1. 确定输入类型和有效模式 ---
        is_url = bool(re.match(r'^https?://', input_location))
        effective_mode = user_mode
        pdf_source_path: Optional[Path] = None # 将用于 normal 模式处理的源文件路径
        temp_download_path: Optional[Path] = None # normal 模式下 URL 下载的临时路径

        try:
            if not is_url:
                logger.info(f"输入 '{input_location}' 被识别为本地路径，强制使用 'normal' 模式。")
                effective_mode = "normal"
                # 验证本地路径安全
                safe_path, error = self.get_safe_path(input_location)
                if error:
                    return ToolResult(error=error)
                if not await aiofiles.os.path.exists(safe_path) or await aiofiles.os.path.isdir(safe_path):
                    return ToolResult(error=f"本地文件不存在或不是文件：'{input_location}'")
                pdf_source_path = safe_path
            elif effective_mode == "normal":
                # URL 输入，但指定了 normal 模式，需要先下载
                logger.info(f"URL 输入 '{input_location}'，使用 'normal' 模式，将先下载文件。")
                # 此处需要调用 DownloadFromUrl
                pass # 下载逻辑将在后面实现
            elif effective_mode != "smart":
                 return ToolResult(error=f"无效的模式 '{params.mode}'。请选择 'smart' 或 'normal'。")

            logger.info(f"执行 PDF 转换: 输入='{input_location}', 模式='{effective_mode}', 输出到='{target_output_path_str or '自动处理'}'")

            markdown_content: Optional[str] = None
            final_output_path: Optional[Path] = None # 最终保存 Markdown 的绝对路径

            # --- 2. 执行转换 (根据模式分发) ---
            if effective_mode == "smart":
                # 智能模式：调用外部 API (仅支持 URL)
                if not is_url:
                    # 理论上不会到这里，因为本地文件会强制 normal
                    return ToolResult(error="内部错误：Smart 模式不应用于本地文件。")

                # 获取 API 配置
                api_key = config.get("pdf_understanding.api_key")
                api_url = config.get("pdf_understanding.api_url")
                if not api_key or not api_url:
                    return ToolResult(error="智能 PDF 转换服务未配置，请联系管理员。")

                headers = { "api-key": api_key, "Content-Type": "application/json" }

                # 添加 Magic-Authorization 与 User-Authorization 请求头
                MetadataUtil.add_magic_and_user_authorization_headers(headers)

                payload = { "message": input_location, "conversation_id": "" }
                try:
                    async with httpx.AsyncClient(timeout=config.get("llm.api_timeout", 600)) as client:
                        response = await client.post(api_url, headers=headers, json=payload)
                        response.raise_for_status()
                    response_data = response.json()
                except httpx.HTTPStatusError as e:
                    logger.exception(f"智能 PDF 转换 API 请求失败: 状态码={e.response.status_code}, 响应={e.response.text}")
                    return ToolResult(error="智能 PDF 转换失败，与处理服务通信时出错。")
                except httpx.RequestError as e:
                    logger.exception(f"智能 PDF 转换 API 请求无法发送: {e}")
                    return ToolResult(error="智能 PDF 转换失败，无法连接到处理服务。")

                # 解析 API 响应
                # --- API Response Parsing START ---
                if response_data.get("code") == 1000:
                    try:
                        content = response_data["data"]["messages"][0]["message"]["content"]
                        markdown_content = content if content else "<!-- PDF 已处理（智能模式），但未提取到有效内容 -->"
                        logger.info("Smart 模式 API 调用成功并提取内容。")
                    except (KeyError, IndexError, TypeError) as e:
                        logger.error(f"解析智能 PDF 转换 API 响应结构失败: {e}, 响应: {response_data}")
                        return ToolResult(error="未能成功解析智能 PDF 处理服务的响应。")
                else:
                    error_message = response_data.get("message", "未知的 API 错误")
                    logger.error(f"智能 PDF 转换 API 错误: code={response_data.get('code')}, message={error_message}, 响应: {response_data}")
                    return ToolResult(error="智能 PDF 转换失败，处理服务返回错误。")
                # --- API Response Parsing END ---

            elif effective_mode == "normal":
                # 普通模式：使用本地库 (支持本地文件和已下载的 URL)

                if is_url:
                    # --- 下载 URL ---
                    download_tool = DownloadFromUrl()
                    # 创建临时下载目录
                    temp_dir = workspace_root / ".cache" / "pdf_downloads"
                    await asyncio.to_thread(temp_dir.mkdir, parents=True, exist_ok=True)
                    # 生成临时文件名
                    base_name = self._extract_source_name(input_location)
                    safe_base_name = generate_safe_filename(base_name) or "downloaded_pdf"
                    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                    temp_pdf_filename = f"{safe_base_name}_{timestamp}.pdf"
                    temp_download_path = temp_dir / temp_pdf_filename

                    logger.info(f"Normal 模式下载 URL '{input_location}' 到临时文件 '{temp_download_path}'")
                    download_params = DownloadFromUrlParams(
                        url=input_location,
                        # 提供相对于工作区的路径给下载工具
                        file_path=str(temp_download_path.relative_to(workspace_root)),
                        override=True # 覆盖同名临时文件
                    )
                    download_result = await download_tool.execute_purely(download_params)
                    if not download_result.ok:
                        logger.error(f"Normal 模式下载 PDF 失败: {download_result.content}")
                        return ToolResult(error=f"下载 PDF 文件失败: {download_result.content}")
                    pdf_source_path = temp_download_path # 更新源路径为下载的文件
                    logger.info(f"PDF 已成功下载到: {pdf_source_path}")
                    # --- 下载结束 ---

                # --- 调用本地转换 ---
                if not pdf_source_path or not await aiofiles.os.path.exists(pdf_source_path):
                    return ToolResult(error=f"内部错误：无法找到用于本地转换的源 PDF 文件。")

                logger.info(f"Normal 模式调用本地转换获取文本: {pdf_source_path}")
                # 直接获取 Markdown 文本内容
                markdown_content = await convert_pdf_locally(pdf_source_path)

                if markdown_content is None:
                    logger.error(f"Normal 模式本地转换失败: {pdf_source_path}")
                    return ToolResult(error=f"使用本地库转换 PDF 文件 '{pdf_source_path.name}' 失败。")

                logger.info(f"Normal 模式本地转换成功，已获取 Markdown 文本。")
                # 在 normal 模式下，md_cache_path 是潜在的输出文件之一
                # 如果用户未指定 output_path，我们就用它

            # --- 3. 检查转换结果 ---
            # 经过 smart 或 normal 模式处理后，检查 markdown_content 是否有值
            if markdown_content is None: # Sanity check, should have been caught above
                logger.error(f"未能成功获取 Markdown 内容 (模式: {effective_mode})，输入: {input_location}")
                #返回更具体的错误信息
                return ToolResult(error=f"PDF 转换失败（模式: {effective_mode}），未能获取有效内容。")

            # --- 4. 检测并分析提取的图片 ---
            enhanced_markdown_content = await self._enhance_with_image_analysis(markdown_content)

            # --- 5. 生成摘要 ---
            pdf_source_name = self._extract_source_name(input_location)
            summary = "无法生成摘要。"
            try:
                summarizer = Summarize()
                generated_summary = await summarizer.summarize_content(
                    content=enhanced_markdown_content,
                    title=pdf_source_name,
                    target_length=500
                )
                if generated_summary:
                    summary = generated_summary
                else:
                     logger.warning(f"为 PDF '{pdf_source_name}' 生成摘要失败（返回空），将使用默认提示。")
            except Exception as summary_e:
                logger.error(f"为 PDF '{pdf_source_name}' 生成摘要时发生异常: {summary_e}", exc_info=True)

            # --- 6. 确定保存路径并保存文件 ---
            workspace_root = PathManager.get_workspace_dir()
            saved_file_relative_path: Optional[str] = None

            try:
                if target_output_path_str:
                    # 用户指定了路径
                    safe_output_path, error = self.get_safe_path(target_output_path_str)
                    if error:
                         logger.error(f"指定的输出路径不安全或在工作空间之外: {target_output_path_str}")
                         return ToolResult(error=f"指定的输出路径 '{target_output_path_str}' 不安全或无效: {error}")

                    # 检查文件是否存在以及是否允许覆盖
                    if await aiofiles.os.path.exists(safe_output_path) and not override_output:
                         logger.warning(f"输出文件已存在且不允许覆盖: {safe_output_path}")
                         return ToolResult(error=f"输出文件 '{target_output_path_str}' 已存在。如需覆盖请设置 override=True。")

                    # 确保父目录存在
                    await asyncio.to_thread(safe_output_path.parent.mkdir, parents=True, exist_ok=True)
                    final_output_path = safe_output_path

                else:
                    # 用户未指定输出路径，统一生成在 .webview-reports
                    # if effective_mode == "normal":
                    #     # Normal 模式下，如果没有指定输出，结果就是 cache 文件
                    #     if not md_cache_path: # Sanity check
                    #          return ToolResult(error="内部错误：无法确定 normal 模式的默认输出路径。")
                    #     final_output_path = md_cache_path
                    #     logger.info(f"Normal 模式未指定输出路径，将使用缓存文件: {final_output_path}")
                    #
                    # elif effective_mode == "smart":
                    #     # Smart 模式 (必然是 URL 来源)，保存在 .webview-reports
                    #     if not is_url: # Sanity check
                    #         return ToolResult(error="内部错误：Smart 模式应只处理 URL。")
                    #
                        # 新逻辑：所有默认输出都放入 .webview-reports
                        logger.info("未指定输出路径，将在 .webview-reports 中自动生成文件名。")
                        records_dir = await get_or_create_records_dir()
                        safe_filename_base = generate_safe_filename(pdf_source_name) or "pdf_content"
                        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                        filename = f"{safe_filename_base}_{timestamp}.md"
                        saved_file_absolute_path = records_dir / filename
                        final_output_path = records_dir / filename

                # 确定相对路径
                saved_file_relative_path = str(final_output_path.relative_to(workspace_root))

                # 检查文件是否已存在（用于确定事件类型）
                # 使用 versioning context 写入文件（无需更新时间戳，因为是工具生成的文件）
                if tool_context:
                    async with self._file_versioning_context(tool_context, final_output_path, update_timestamp=False):
                        async with aiofiles.open(final_output_path, "w", encoding="utf-8") as f:
                            await f.write(enhanced_markdown_content)
                    logger.info(f"转换结果已写入到最终目标文件: {saved_file_relative_path}")
                else:
                    # tool_context 为空时，直接写入文件
                    async with aiofiles.open(final_output_path, "w", encoding="utf-8") as f:
                        await f.write(enhanced_markdown_content)
                    logger.warning(f"无法触发文件事件，tool_context 为空: {final_output_path}")
                    logger.info(f"转换结果已写入到最终目标文件: {saved_file_relative_path}")

            except OSError as write_e:
                output_path_display = final_output_path or target_output_path_str or "未知路径"
                logger.error(f"保存 Markdown 文件失败: {output_path_display}, 错误: {write_e}", exc_info=True)
                return ToolResult(
                    error=f"成功转换 PDF，但保存 Markdown 文件到 '{saved_file_absolute_path}' 时出错: {write_e}。转换后的内容在 extra_info 中。",
                    extra_info={
                        "pdf_source_name": pdf_source_name,
                        "saved_file_path": None,
                        "full_content": enhanced_markdown_content,
                    }
                )
            except Exception as e:
                logger.error(f"确定或创建保存路径时发生意外错误: {e}", exc_info=True)
                return ToolResult(error="处理文件保存路径时发生内部错误。")

            # --- 7. 构建返回结果 ---
            ai_content = f"**PDF 内容摘要**:\n{summary}"
            if saved_file_relative_path:
                ai_content += f"\n\n**提示**: 完整的 PDF 内容已处理（模式: {effective_mode}）并保存至 `{saved_file_relative_path}`。如需详细信息，请使用 `read_file` 工具读取此文件。"
            else:
                ai_content += "\n\n**警告**: 完整内容已转换但未能成功保存到文件，无法通过 `read_file` 访问。"

            result = ToolResult(
                content=ai_content,
                extra_info={
                    "pdf_source_name": pdf_source_name,
                    "saved_file_path": saved_file_relative_path,
                    "full_content": enhanced_markdown_content,
                }
            )
            return result

        except Exception as e:
            logger.exception(f"PDF 转换操作意外失败: {e!s}")
            return ToolResult(error="执行 PDF 转换时发生未预料的内部错误。")
        finally:
             # --- 清理下载的临时文件 ---
             if temp_download_path and await aiofiles.os.path.exists(temp_download_path):
                 try:
                     await aiofiles.os.remove(temp_download_path)
                     logger.info(f"已清理临时下载文件: {temp_download_path}")
                 except OSError as remove_e:
                     logger.warning(f"清理临时下载文件失败 {temp_download_path}: {remove_e}")

             # --- 清理提取的图片临时文件 ---
             await self._cleanup_extracted_images()

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None) -> Optional[ToolDetail]:
        """生成工具详情，用于前端展示"""
        try:
            full_content = result.extra_info.get("full_content")
            saved_file_path = result.extra_info.get("saved_file_path")
            pdf_source_name = result.extra_info.get("pdf_source_name", "未知来源")

            if not full_content:
                logger.error("无法生成工具详情：extra_info 中 full_content 缺失或为空。")
                return None # 核心内容缺失

            # 确定显示的文件名
            if saved_file_path:
                display_filename = Path(saved_file_path).name # 从相对路径获取文件名
            else:
                 # 如果保存失败，生成一个临时的名字
                 safe_filename_base = generate_safe_filename(pdf_source_name) or "converted_pdf"
                 display_filename = f"转换结果_{safe_filename_base}.md"
                 logger.warning(f"Tool detail: saved_file_path 为空，使用备用文件名: {display_filename}")


            return ToolDetail(
                type=DisplayType.MD,
                data=FileContent(
                    file_name=display_filename,
                    content=full_content
                )
            )
        except Exception as e:
            logger.error(f"生成工具详情时发生意外错误: {e}", exc_info=True)
            return None

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """获取工具调用后的友好动作和备注"""
        pdf_source_name = "PDF文档"
        if result.extra_info and "pdf_source_name" in result.extra_info:
            pdf_source_name = result.extra_info["pdf_source_name"]
        elif arguments and "input_path" in arguments: # 使用 input_path
             pdf_source_name = self._extract_source_name(arguments["input_path"])

        remark = f"已转换 PDF: {pdf_source_name}"
        if result.ok and result.extra_info and result.extra_info.get("saved_file_path"):
            remark += f"，保存至 `{result.extra_info['saved_file_path']}`"
        else:
            remark += " (但处理或保存中遇到问题)"

        return {
            "action": "PDF转换",
            "remark": remark
        }

    def _extract_source_name(self, source_location_url: str) -> str:
        """从 PDF 来源 URL 提取用于显示的文件名"""
        try:
            parsed_url = urllib.parse.urlparse(source_location_url)
            path_part = parsed_url.path
            file_name = path_part.split('/')[-1]
            decoded_name = urllib.parse.unquote(file_name)
            base_name = decoded_name.split('?')[0]
            return base_name if base_name and base_name != '/' else "网络PDF文档"
        except Exception as e:
            logger.warning(f"从 URL '{source_location_url}' 提取文件名失败: {e}", exc_info=False)
            return "网络PDF文档"

    async def _enhance_with_image_analysis(self, markdown_content: str) -> str:
        """检测并分析 PDF 中提取的图片，使用视觉理解工具增强内容

        Args:
            markdown_content: 原始 Markdown 内容

        Returns:
            str: 增强后的 Markdown 内容
        """
        try:
            # 检测是否有提取的图片路径
            image_paths = self._extract_image_paths_from_markdown(markdown_content)

            if not image_paths:
                logger.debug("未检测到提取的图片，返回原始内容")
                return markdown_content

            logger.info(f"检测到 {len(image_paths)} 个提取的图片，开始分析")

            # 导入视觉理解工具
            from app.tools.visual_understanding import VisualUnderstanding, VisualUnderstandingParams

            # 创建视觉理解工具实例
            visual_tool = VisualUnderstanding()

            # 分批处理图片，避免单次请求图片过多导致失败
            MAX_IMAGES_PER_BATCH = 5  # 每批最多处理5张图片
            MAX_BATCH_SIZE_MB = 8  # 每批最大8MB
            all_analysis_results = []

            # 预处理图片：检查大小并压缩
            processed_image_paths = await self._preprocess_images_for_analysis(image_paths)

            # 智能分批：考虑图片大小和数量
            batches = self._create_smart_batches(processed_image_paths, MAX_IMAGES_PER_BATCH, MAX_BATCH_SIZE_MB)

            for batch_num, batch_paths in enumerate(batches, 1):
                total_batches = len(batches)

                logger.info(f"分析第 {batch_num}/{total_batches} 批图片，包含 {len(batch_paths)} 张图片")

                # 为每批图片构建合适的查询
                if len(processed_image_paths) == 1:
                    query = "请分析这张图片的内容，识别其中的文字、图表、表格等信息。如果图片只是装饰性的（如边框、背景等），请说明。对于包含有意义信息的图片，请详细描述内容并提取其中的文字信息。"
                elif total_batches == 1:
                    query = f"请分析这 {len(batch_paths)} 张图片的内容，识别其中的文字、图表、表格等信息。如果图片只是装饰性的（如边框、背景等），请说明。对于包含有意义信息的图片，请详细描述内容并提取其中的文字信息。请按图片顺序进行分析。"
                else:
                    query = f"这是第 {batch_num} 批图片（共 {total_batches} 批），包含 {len(batch_paths)} 张图片。请分析这些图片的内容，识别其中的文字、图表、表格等信息。如果图片只是装饰性的，请说明。请按图片顺序进行分析，并在开头标注这是第 {batch_num} 批的分析结果。"

                # 分析当前批次的图片
                analysis_params = VisualUnderstandingParams(
                    images=batch_paths,
                    query=query
                )

                try:
                    # 执行视觉理解
                    analysis_result = await visual_tool.execute_purely(
                        analysis_params,
                        include_download_info_in_content=False,
                        include_dimensions_info_in_content=False
                    )

                    if analysis_result.ok and analysis_result.content:
                        if total_batches > 1:
                            # 多批次情况下，为每批结果添加标题
                            batch_content = f"### 第 {batch_num} 批图片分析\n\n{analysis_result.content}"
                        else:
                            batch_content = analysis_result.content

                        all_analysis_results.append(batch_content)
                        logger.info(f"第 {batch_num} 批图片分析完成")
                    else:
                        logger.warning(f"第 {batch_num} 批图片分析失败: {analysis_result.error}")
                        all_analysis_results.append(f"### 第 {batch_num} 批图片分析\n\n⚠️ 分析失败: {analysis_result.error or '未知错误'}")

                except Exception as e:
                    logger.error(f"第 {batch_num} 批图片分析异常: {e}", exc_info=True)
                    all_analysis_results.append(f"### 第 {batch_num} 批图片分析\n\n❌ 分析异常: {str(e)}")

            # 合并所有分析结果
            if all_analysis_results:
                combined_analysis = "\n\n".join(all_analysis_results)
                enhanced_content = self._integrate_image_analysis(markdown_content, combined_analysis, processed_image_paths)
                logger.info(f"所有图片分析完成，共处理 {len(processed_image_paths)} 张图片")
                return enhanced_content
            else:
                logger.warning("所有批次的图片分析都失败了")
                return markdown_content

        except Exception as e:
            logger.error(f"图片分析过程中发生异常: {e}", exc_info=True)
            return markdown_content

    async def _preprocess_images_for_analysis(self, image_paths: list[str]) -> list[str]:
        """预处理图片：检查大小并压缩过大的图片

        Args:
            image_paths: 原始图片路径列表

        Returns:
            list[str]: 处理后的图片路径列表
        """
        processed_paths = []

        for i, image_path in enumerate(image_paths):
            try:
                # 检查图片 base64 编码后的大小
                base64_size = self._get_image_base64_size(image_path)
                size_mb = base64_size / (1024 * 1024)

                logger.debug(f"图片 {i+1} 原始 base64 大小: {size_mb:.2f}MB")

                # 如果图片太大，进行压缩
                if size_mb > 2.0:  # 单张图片超过2MB就压缩
                    logger.info(f"图片 {i+1} 过大 ({size_mb:.2f}MB)，开始压缩")
                    compressed_path = await self._compress_image(image_path)
                    if compressed_path:
                        compressed_size = self._get_image_base64_size(compressed_path)
                        compressed_size_mb = compressed_size / (1024 * 1024)
                        logger.info(f"图片 {i+1} 压缩完成: {size_mb:.2f}MB → {compressed_size_mb:.2f}MB")
                        processed_paths.append(compressed_path)
                    else:
                        logger.warning(f"图片 {i+1} 压缩失败，使用原图")
                        processed_paths.append(image_path)
                else:
                    processed_paths.append(image_path)

            except Exception as e:
                logger.warning(f"预处理图片 {i+1} 时出错: {e}，使用原图")
                processed_paths.append(image_path)

        return processed_paths

    def _get_image_base64_size(self, image_path: str) -> int:
        """获取图片 base64 编码后的大小（字节）

        Args:
            image_path: 图片文件路径

        Returns:
            int: base64 编码后的大小（字节）
        """
        try:
            import base64
            with open(image_path, "rb") as image_file:
                image_data = image_file.read()
                base64_data = base64.b64encode(image_data)
                # 加上 data:image/xxx;base64, 前缀的大小
                mime_prefix_size = 50  # 估算 MIME 类型前缀大小
                return len(base64_data) + mime_prefix_size
        except Exception as e:
            logger.warning(f"获取图片 base64 大小失败: {e}")
            return 0

    async def _compress_image(self, image_path: str) -> str:
        """压缩图片为 JPEG 格式

        Args:
            image_path: 原始图片路径

        Returns:
            str: 压缩后的图片路径，失败时返回空字符串
        """
        try:
            from PIL import Image
            import tempfile
            import os

            # 打开图片
            with Image.open(image_path) as img:
                # 转换为 RGB 模式（JPEG 不支持透明度）
                if img.mode in ('RGBA', 'LA', 'P'):
                    # 创建白色背景
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')

                # 计算压缩后的尺寸
                original_size = img.size
                max_dimension = 1920  # 最大尺寸

                if max(original_size) > max_dimension:
                    # 按比例缩放
                    ratio = max_dimension / max(original_size)
                    new_size = (int(original_size[0] * ratio), int(original_size[1] * ratio))
                    img = img.resize(new_size, Image.Resampling.LANCZOS)
                    logger.debug(f"图片尺寸缩放: {original_size} → {new_size}")

                # 生成压缩后的文件路径
                original_name = os.path.splitext(os.path.basename(image_path))[0]
                compressed_path = os.path.join(
                    os.path.dirname(image_path),
                    f"{original_name}_compressed.jpg"
                )

                # 尝试不同的质量等级
                for quality in [80, 60, 40, 20]:
                    img.save(compressed_path, 'JPEG', quality=quality, optimize=True)

                    # 检查压缩后的大小
                    compressed_base64_size = self._get_image_base64_size(compressed_path)
                    compressed_size_mb = compressed_base64_size / (1024 * 1024)

                    if compressed_size_mb <= 2.0:  # 目标大小
                        logger.debug(f"压缩成功，质量={quality}，大小={compressed_size_mb:.2f}MB")
                        return compressed_path

                # 如果所有质量等级都无法满足要求，返回最低质量的版本
                logger.warning("即使最低质量也无法满足大小要求，使用质量=20的版本")
                return compressed_path

        except Exception as e:
            logger.error(f"压缩图片失败: {e}", exc_info=True)
            return ""

    def _create_smart_batches(self, image_paths: list[str], max_images_per_batch: int, max_batch_size_mb: int) -> list[list[str]]:
        """智能分批：根据图片大小和数量创建批次

        Args:
            image_paths: 图片路径列表
            max_images_per_batch: 每批最大图片数量
            max_batch_size_mb: 每批最大大小（MB）

        Returns:
            list[list[str]]: 分批后的图片路径列表
        """
        batches = []
        current_batch = []
        current_batch_size = 0
        max_batch_size_bytes = max_batch_size_mb * 1024 * 1024

        for image_path in image_paths:
            try:
                # 获取当前图片的 base64 大小
                image_size = self._get_image_base64_size(image_path)

                # 检查是否需要开始新批次
                should_start_new_batch = (
                    len(current_batch) >= max_images_per_batch or  # 数量超限
                    (current_batch_size + image_size) > max_batch_size_bytes or  # 大小超限
                    (current_batch and image_size > max_batch_size_bytes * 0.8)  # 单张图片过大
                )

                if should_start_new_batch and current_batch:
                    batches.append(current_batch)
                    current_batch = []
                    current_batch_size = 0

                current_batch.append(image_path)
                current_batch_size += image_size

            except Exception as e:
                logger.warning(f"处理图片 {image_path} 时出错: {e}，仍添加到批次中")
                current_batch.append(image_path)

        # 添加最后一个批次
        if current_batch:
            batches.append(current_batch)

        # 记录分批结果
        for i, batch in enumerate(batches, 1):
            batch_size = sum(self._get_image_base64_size(path) for path in batch) / (1024 * 1024)
            logger.debug(f"批次 {i}: {len(batch)} 张图片，总大小 {batch_size:.2f}MB")

        return batches

    async def _cleanup_extracted_images(self):
        """清理提取的图片临时文件"""
        try:
            import os
            import shutil
            import tempfile
            from pathlib import Path

            # 获取当前进程的临时目录
            process_id = os.getpid()
            temp_dir = Path(tempfile.gettempdir()) / f"pdf_extracted_images_{process_id}"

            if temp_dir.exists():
                # 删除整个临时目录
                shutil.rmtree(temp_dir)
                logger.info(f"已清理图片临时目录: {temp_dir}")
        except Exception as e:
            logger.warning(f"清理图片临时文件失败: {e}")

    def _extract_image_paths_from_markdown(self, markdown_content: str) -> list[str]:
        """从 Markdown 内容中提取图片路径

        Args:
            markdown_content: Markdown 内容

        Returns:
            list[str]: 提取的图片路径列表
        """
        import re
        image_paths = []

        # 匹配 "- 图片 X: /path/to/image.png" 格式
        pattern = r'- 图片 \d+: (.+\.(?:png|jpg|jpeg|gif|bmp|tiff|webp))'
        matches = re.findall(pattern, markdown_content, re.IGNORECASE)

        for match in matches:
            image_path = match.strip()
            if os.path.exists(image_path):
                image_paths.append(image_path)

        return image_paths

    def _integrate_image_analysis(self, original_content: str, analysis_content: str, image_paths: list[str]) -> str:
        """将图片分析结果整合到原始内容中

        Args:
            original_content: 原始 Markdown 内容
            analysis_content: 视觉理解分析结果
            image_paths: 分析的图片路径列表

        Returns:
            str: 整合后的 Markdown 内容
        """
        # 在原始内容末尾添加图片分析部分
        enhanced_content = original_content + "\n\n---\n\n"
        enhanced_content += "## 📸 图片内容分析\n\n"
        enhanced_content += f"*以下是对 PDF 中 {len(image_paths)} 个图片的智能分析结果：*\n\n"
        enhanced_content += analysis_content
        enhanced_content += "\n\n*注意：图片分析结果由 AI 生成，仅供参考。*"

        return enhanced_content
