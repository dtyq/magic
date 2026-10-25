"""工具详情工厂模块"""

from typing import Dict, List
from collections.abc import Iterable
from pathlib import Path
import json

from app.core.entity.message.server_message import (
    BrowserContent,
    DeepWriteContent,
    DisplayType,
    SearchContent,
    SearchGroupItem,
    SearchResultItem,
    TerminalContent,
    ToolDetail,
    FileContent,
    OperationResultChanges,
    OperationResultFileTarget,
    OperationResultItem,
    OperationResultKind,
    OperationResultListContent,
    OperationResultListReportContent,
    OperationResultStatus,
    OperationResultSummary,
    OperationResultStage,
    OperationResultTargetType,
)
from app.core.entity.tool.tool_result_types import SearchResult

OPERATION_RESULT_PREVIEW_LIMIT = 8
OPERATION_RESULT_PREVIEW_BYTES = 4096

class ToolDetailFactory:
    """工具详情工厂类，用于创建不同类型的ToolDetail对象"""

    @staticmethod
    def create_file_result_item(
        file_path: str,
        workspace_dir: Path,
        status: OperationResultStatus,
        message: str = "",
        changes: OperationResultChanges | None = None,
        description: str = "",
    ) -> OperationResultItem:
        path = Path(file_path)
        relative_path: Path | None = None
        try:
            relative_path = path.relative_to(workspace_dir) if path.is_absolute() else path
            if ".." in relative_path.parts or not relative_path.parts:
                relative_path = None
        except ValueError:
            pass
        return OperationResultItem(
            label=path.name or file_path,
            kind=OperationResultKind.FILE,
            status=status,
            message=message,
            changes=changes,
            description=description,
            target=OperationResultFileTarget(
                type=OperationResultTargetType.FILE,
                relative_file_path=relative_path.as_posix(),
            ) if relative_path is not None and status != OperationResultStatus.ERROR else None,
        )

    @staticmethod
    def create_operation_result_detail(
        items: Iterable[OperationResultItem],
        *,
        report: ToolDetail | None = None,
        stage: OperationResultStage | None = None,
    ) -> ToolDetail | None:
        # 预算只限制新增元数据；正文保持顶层并继续由原出口文件化。
        # 例：100 个真实结果只随消息保存最多 8 项，但汇总仍统计完整 100 项。
        preview: list[OperationResultItem] = []
        total = success = failed = skipped = 0
        for item in items:
            total += 1
            success += item.status == OperationResultStatus.SUCCESS
            failed += item.status == OperationResultStatus.ERROR
            skipped += item.status == OperationResultStatus.SKIPPED
            if len(preview) < OPERATION_RESULT_PREVIEW_LIMIT:
                candidate = [*preview, item]
                encoded = json.dumps([entry.model_dump(mode="json") for entry in candidate], ensure_ascii=False).encode("utf-8")
                if len(encoded) <= OPERATION_RESULT_PREVIEW_BYTES:
                    preview.append(item)
        if not preview:
            return report
        summary = OperationResultSummary(
            stage=stage,
            total_count=total,
            success_count=success,
            failed_count=failed,
            skipped_count=skipped,
            omitted_count=total - len(preview),
        ).model_dump(exclude_none=True)
        metadata = {**summary, "items": [item.model_dump(mode="json") for item in preview]}
        if report:
            metadata["report_type"] = report.type
        while preview and len(json.dumps(metadata, ensure_ascii=False).encode("utf-8")) > OPERATION_RESULT_PREVIEW_BYTES:
            preview.pop()
            metadata["items"].pop()
            summary["omitted_count"] = total - len(preview)
            metadata["omitted_count"] = summary["omitted_count"]
        if not preview:
            return report
        if report is not None and isinstance(report.data, FileContent):
            data = OperationResultListReportContent(
                **report.data.model_dump(exclude_none=True),
                **summary,
                items=preview,
                report_type=report.type,
            )
        else:
            data = OperationResultListContent(items=preview, **summary)
        return ToolDetail(type=DisplayType.OPERATION_RESULT_LIST, data=data)

    @staticmethod
    def create_search_detail_from_search_results(
        search_results: Dict[str, List[SearchResult]],
        *,
        query_by_keyword: dict[str, str] | None = None,
    ) -> ToolDetail:
        """从SearchResult对象创建搜索类型的工具详情

        Args:
            search_results: 搜索结果字典，键为查询词，值为SearchResult对象列表
            query_by_keyword: 分组键对应的实际查询词，仅用于详情展示

        Returns:
            ToolDetail: 搜索类型的工具详情
        """
        # 创建多组搜索结果
        search_groups = []

        for query, results in search_results.items():
            result_items = [
                SearchResultItem(
                    title=item.title,
                    url=item.url,
                    snippet=item.snippet or "",
                    icon_url=item.icon_url  # 添加图标URL
                ) for item in results
            ]

            # 将一个关键词及其对应的结果创建为一个SearchGroupItem
            group = SearchGroupItem(
                keyword=query,
                results=result_items,
                query=(query_by_keyword or {}).get(query),
            )

            search_groups.append(group)

        return ToolDetail(type=DisplayType.SEARCH, data=SearchContent(groups=search_groups))

    @staticmethod
    def create_terminal_detail(command: str, output: str, exit_code: int) -> ToolDetail:
        """创建终端类型的工具详情

        Args:
            command: 执行的终端命令
            output: 终端输出内容
            exit_code: 命令执行的退出码

        Returns:
            ToolDetail: 终端类型的工具详情
        """
        return ToolDetail(
            type=DisplayType.TERMINAL, data=TerminalContent(command=command, output=output, exit_code=exit_code)
        )

    @staticmethod
    def create_browser_detail(content: BrowserContent) -> ToolDetail:
        """创建统一 Browser 截图回放详情。"""
        return ToolDetail(
            type=DisplayType.BROWSER,
            data=content,
        )

    @staticmethod
    def create_deep_write_detail(title: str, reasoning_content: str, content: str) -> ToolDetail:
        """创建深度写作类型的工具详情

        Args:
            title: 深度写作标题
            reasoning_content: 深度写作过程内容
            content: 深度写作结论

        Returns:
            ToolDetail: 深度写作类型的工具详情
        """
        return ToolDetail(
            type=DisplayType.MD,  # 使用 Markdown 格式展示
            data=DeepWriteContent(
                title=title,
                reasoning_content=reasoning_content,
                content=content
            )
        )
