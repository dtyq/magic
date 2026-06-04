"""
批量URL文件下载工具

该工具支持通过XML配置批量下载多个文件，内部复用 DownloadFromUrl 工具的下载逻辑。
"""

from app.i18n import i18n
import asyncio
import json
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional
from pathlib import Path

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.tools.core import BaseToolParams, BaseTool, tool
from app.tools.download_from_url import DownloadFromUrl, DownloadFromUrlParams

logger = get_logger(__name__)


class DownloadFromUrlsParams(BaseToolParams):
    downloads_xml: str = Field(
        ...,
        description="""<!--zh
批量下载任务XML配置，示例：
<downloads>
    <download>
        <url>https://example.com/company-logo.png</url>
        <file_path>项目资料/品牌素材/公司logo.png</file_path>
    </download>
    <download>
        <url>https://api.data.gov/statistics/2025/q1.json</url>
        <file_path>数据分析/政府统计/2025年第一季度数据.json</file_path>
    </download>
    <download>
        <url>https://arxiv.org/pdf/2401.12345.pdf</url>
        <file_path>研究论文/机器学习/transformer优化技术.pdf</file_path>
    </download>
</downloads>

字段说明：
- url: 要下载的文件URL地址
- file_path: 保存路径，建议使用有意义的文件夹结构和文件名
  * 根据用户偏好语言命名（中文/英文/日文等）
  * 避免将文件直接放在根目录
  * 使用清晰的分类文件夹
  * 文件名应描述内容而非使用原始URL文件名
-->
Batch download tasks XML configuration, example:
<downloads>
    <download>
        <url>https://example.com/company-logo.png</url>
        <file_path>project-materials/brand-assets/company-logo.png</file_path>
    </download>
    <download>
        <url>https://api.data.gov/statistics/2025/q1.json</url>
        <file_path>data-analysis/government-stats/2025-q1-data.json</file_path>
    </download>
    <download>
        <url>https://arxiv.org/pdf/2401.12345.pdf</url>
        <file_path>research-papers/machine-learning/transformer-optimization.pdf</file_path>
    </download>
</downloads>

Fields:
- url: File URL to download
- file_path: Save path, recommend using meaningful folder structure and filenames
  * Name according to user preferred language (Chinese/English/Japanese etc.)
  * Avoid placing files directly in root directory
  * Use clear categorization folders
  * Filenames should describe content rather than using original URL filename"""
    )


class BatchDownloadResult:
    """批量下载结果"""
    def __init__(self):
        self.results = []  # 存储每个下载任务的结果
        self.total = 0
        self.success = 0
        self.failed = 0
        self.total_size_bytes = 0
        self.cache_hits = 0
        self.cache_misses = 0


def _parse_download_requirements_xml(xml_string: str) -> List[Dict[str, Any]]:
    """解析下载需求XML字符串

    Args:
        xml_string: XML格式的需求字符串

    Returns:
        List of download task dictionaries

    Raises:
        ValueError: XML格式错误或缺少必要字段
    """
    try:
        # 解析XML
        root = ET.fromstring(xml_string.strip())

        if root.tag != 'downloads':
            raise ValueError("XML根节点必须是 <downloads>")

        downloads = []

        for download_element in root.findall('download'):
            # 提取必要字段
            url_element = download_element.find('url')
            file_path_element = download_element.find('file_path')

            # 检查必要字段
            if url_element is None or not url_element.text or not url_element.text.strip():
                raise ValueError("每个 <download> 必须包含非空的 <url> 字段")

            if file_path_element is None or not file_path_element.text or not file_path_element.text.strip():
                raise ValueError("每个 <download> 必须包含非空的 <file_path> 字段")

            # 构造下载任务对象
            download_task = {
                'url': url_element.text.strip(),
                'file_path': file_path_element.text.strip(),
            }

            downloads.append(download_task)

        if not downloads:
            raise ValueError("至少需要一个 <download> 元素")

        return downloads

    except ET.ParseError as e:
        raise ValueError(f"XML解析错误: {e}")


@tool()
class DownloadFromUrls(BaseTool[DownloadFromUrlsParams]):
    """<!--zh
    URL文件下载工具，支持批量下载
    注意：如果目标文件已存在，将自动覆盖
    -->
    URL file download tool with batch download support
    Note: Will automatically override existing target files
    """

    def get_prompt_hint(self) -> str:
        return """<!--zh: 请优先使用本工具下载文件而非优先使用wget或curl，能一次性调用批量下载的就不要重复多次调用本工具，以此实现高效下载-->
Prioritize using this tool for file downloads over wget or curl. Use batch download in single call rather than multiple calls for efficiency"""

    async def execute(self, tool_context: ToolContext, params: DownloadFromUrlsParams) -> ToolResult:
        """
        执行批量文件下载操作

        Args:
            tool_context: 工具上下文
            params: 参数对象，包含批量下载XML配置

        Returns:
            ToolResult: 包含批量下载结果
        """
        try:
            # 解析XML配置
            try:
                download_tasks = _parse_download_requirements_xml(params.downloads_xml)
            except ValueError as e:
                return ToolResult.error(f"XML解析失败: {e}")

            if not download_tasks:
                return ToolResult.error("下载任务列表为空")

            logger.info(f"开始批量下载: 任务数量={len(download_tasks)}")

            # 创建 DownloadFromUrl 实例用于下载
            downloader = DownloadFromUrl()

            # 执行批量下载
            batch_result = await self._execute_batch_downloads(downloader, download_tasks, tool_context)

            # 构建输出结果
            content_dict = self._build_result_summary(batch_result)

            # 构建详细的技术信息
            extra_info = {
                "detailed_results": batch_result.results,
                "total_size_bytes": batch_result.total_size_bytes,
                "cache_hits": batch_result.cache_hits,
                "cache_misses": batch_result.cache_misses
            }

            return ToolResult(
                content=json.dumps(content_dict, ensure_ascii=False, indent=2),
                extra_info=extra_info
            )

        except Exception as e:
            logger.exception(f"批量下载操作失败: {e}")
            return ToolResult.error("Batch download operation failed")

    async def _execute_batch_downloads(self, downloader: DownloadFromUrl, download_tasks: List[Dict[str, Any]], tool_context: ToolContext) -> BatchDownloadResult:
        """
        执行批量下载任务

        Args:
            downloader: DownloadFromUrl 实例
            download_tasks: 下载任务列表
            tool_context: 工具上下文，用于事件分发

        Returns:
            BatchDownloadResult: 批量下载结果
        """
        batch_result = BatchDownloadResult()
        batch_result.total = len(download_tasks)

        # 创建并发任务列表
        tasks = []
        for task in download_tasks:
            # 为每个任务创建参数对象
            single_params = DownloadFromUrlParams(
                url=task['url'],
                file_path=task['file_path']
            )
            # 调用 execute_purely 方法
            tasks.append(self._download_single_with_result(downloader, single_params, task, tool_context))

        # 并发执行所有下载任务
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # 处理结果
        for result in results:
            if isinstance(result, dict):
                # 正常结果
                if result.get("status") == "success":
                    batch_result.success += 1
                    batch_result.total_size_bytes += result.get('file_size_bytes', 0)

                    # 统计缓存命中情况
                    if result.get('from_cache'):
                        batch_result.cache_hits += 1
                    else:
                        batch_result.cache_misses += 1
                else:
                    batch_result.failed += 1

                batch_result.results.append(result)
            else:
                # 异常情况
                batch_result.failed += 1
                error_result = {
                    "status": "failed",
                    "error": str(result) if result else "未知错误"
                }
                batch_result.results.append(error_result)

        return batch_result

    async def _download_single_with_result(self, downloader: DownloadFromUrl, params: DownloadFromUrlParams, task: Dict[str, Any], tool_context: ToolContext) -> Dict[str, Any]:
        """
        下载单个文件并格式化结果

        Args:
            downloader: DownloadFromUrl 实例
            params: 下载参数
            task: 原始任务信息
            tool_context: 工具上下文，用于事件分发

        Returns:
            Dict: 格式化的下载结果
        """
        try:
            # 调用 DownloadFromUrl 的 execute_purely 方法
            result = await downloader.execute_purely(params, tool_context=tool_context)

            if result.ok:
                # 成功
                extra_info = result.extra_info or {}
                return {
                    "url": task['url'],
                    "file_path": extra_info.get('file_path', task['file_path']),
                    "status": "success",
                    "file_size_bytes": extra_info.get('file_size', 0),
                    "content_type": extra_info.get('content_type', 'unknown'),
                    "file_exists": extra_info.get('file_exists', False),
                    "from_cache": extra_info.get('from_cache', False),
                    "final_url": extra_info.get('url', task['url'])
                }
            else:
                # 失败
                return {
                    "url": task['url'],
                    "file_path": task['file_path'],
                    "status": "failed",
                    "error": result.content
                }

        except Exception as e:
            logger.error(f"下载文件失败 {task['url']}: {e}")
            return {
                "url": task['url'],
                "file_path": task['file_path'],
                "status": "failed",
                "error": str(e)
            }

    def _build_result_summary(self, batch_result: BatchDownloadResult) -> Dict[str, Any]:
        """
        构建结果摘要

        Args:
            batch_result: 批量下载结果

        Returns:
            Dict: 格式化的结果摘要
        """
        content_dict = {
            "message": f"批量下载完成：{batch_result.success}个成功，{batch_result.failed}个失败",
            "summary": {
                "total": batch_result.total,
                "success": batch_result.success,
                "failed": batch_result.failed,
                "total_size": self._format_size(batch_result.total_size_bytes),
                "cache_hits": batch_result.cache_hits,
                "cache_misses": batch_result.cache_misses
            },
            "results": []
        }

        # 添加每个任务的简洁结果
        for result_item in batch_result.results:
            simple_result = {
                "file_path": result_item.get("file_path", "未知"),
                "status": "成功" if result_item.get("status") == "success" else "失败"
            }

            if result_item.get("status") == "success":
                simple_result["size"] = self._format_size(result_item.get("file_size_bytes", 0))
                if result_item.get("from_cache"):
                    simple_result["from_cache"] = True
            else:
                simple_result["error"] = result_item.get("error", "未知错误")

            content_dict["results"].append(simple_result)

        return content_dict

    def _format_size(self, size_bytes: int) -> str:
        """格式化文件大小显示"""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size_bytes < 1024.0 or unit == 'TB':
                return f"{size_bytes:.2f} {unit}" if unit != 'B' else f"{size_bytes} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes} B"

    def _build_markdown_detail(self, batch_result: 'BatchDownloadResult') -> str:
        """将批量下载结果渲染为 Markdown（英文、紧凑风格）"""
        lines: List[str] = []
        lines.append("# Batch Download Result")
        lines.append("")
        lines.append(
                f"Total: {batch_result.total} · "
                f"Success: {batch_result.success} · "
                f"Failed: {batch_result.failed} · "
                f"Size: {self._format_size(batch_result.total_size_bytes)} · "
                f"Cache: {batch_result.cache_hits} hit / {batch_result.cache_misses} miss"
        )
        lines.append("")

        if not batch_result.results:
            lines.append("_No download tasks._")
            return "\n".join(lines)

        # Success list
        success_items = [r for r in batch_result.results if r.get("status") == "success"]
        if success_items:
            lines.append("## Success")
            for item in success_items:
                file_path = str(item.get("file_path", "-"))
                size = self._format_size(item.get("file_size_bytes", 0))
                cache_tag = " (cached)" if item.get("from_cache") else ""
                lines.append(f"- `{file_path}` — {size}{cache_tag}")
            lines.append("")

        # Failed list
        failed_items = [r for r in batch_result.results if r.get("status") != "success"]
        if failed_items:
            lines.append("## Failed")
            for item in failed_items:
                file_path = str(item.get("file_path", "-"))
                error = self._truncate(str(item.get("error", "unknown error")), 200)
                lines.append(f"- `{file_path}` — {error}")
            lines.append("")

        return "\n".join(lines)

    @staticmethod
    def _truncate(text: str, max_len: int) -> str:
        """超长文本截断"""
        if len(text) <= max_len:
            return text
        return text[: max_len - 1] + "…"

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: Dict[str, Any] = None,
    ) -> Optional[ToolDetail]:
        """以 Markdown 形式展示批量下载详情"""
        if not result or not result.extra_info:
            return None

        detailed_results = result.extra_info.get("detailed_results") or []
        if not detailed_results:
            return None

        # 重建一个轻量 BatchDownloadResult 以复用渲染逻辑
        batch_result = BatchDownloadResult()
        batch_result.results = detailed_results
        batch_result.total = len(detailed_results)
        batch_result.success = sum(1 for r in detailed_results if r.get("status") == "success")
        batch_result.failed = batch_result.total - batch_result.success
        batch_result.total_size_bytes = result.extra_info.get("total_size_bytes", 0)
        batch_result.cache_hits = result.extra_info.get("cache_hits", 0)
        batch_result.cache_misses = result.extra_info.get("cache_misses", 0)

        markdown = self._build_markdown_detail(batch_result)

        file_name = (
                f"Batch download (success {batch_result.success} / failed {batch_result.failed})"
        )
        return ToolDetail(
                type=DisplayType.MD,
                data=FileContent(file_name=file_name, content=markdown),
        )

    async def get_after_tool_call_friendly_action_and_remark(self, tool_name: str, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None) -> Dict:
        """
        获取工具调用后的友好动作和备注
        """
        # 无论成功还是失败，都使用本工具自定义的 remark，避免被通用错误提示覆盖
        result.use_custom_remark = True

        if not result.ok:
            return {
                "action": i18n.translate("download_from_urls", category="tool.actions"),
                "remark": i18n.translate("download_from_url.error", category="tool.messages", error=result.content)
            }

        # 尝试从结果中获取成功/失败统计
        try:
            if result.extra_info:
                detailed_results = result.extra_info.get("detailed_results", [])
                success_count = sum(1 for r in detailed_results if r.get("status") == "success")
                failed_count = len(detailed_results) - success_count

                if success_count > 0 and failed_count == 0:
                    remark = i18n.translate("download_from_urls.success_count", category="tool.messages", count=success_count)
                elif success_count > 0 and failed_count > 0:
                    remark = i18n.translate("download_from_urls.partial_success", category="tool.messages", success=success_count, failed=failed_count)
                elif failed_count > 0:
                    remark = i18n.translate("download_from_urls.failed_count", category="tool.messages", count=failed_count)
                else:
                    remark = i18n.translate("download_from_url.completed", category="tool.messages")
            else:
                remark = i18n.translate("download_from_url.completed", category="tool.messages")
        except Exception:
            remark = i18n.translate("download_from_url.completed", category="tool.messages")

        return {
            "action": i18n.translate("download_from_urls", category="tool.actions"),
            "remark": remark
        }
