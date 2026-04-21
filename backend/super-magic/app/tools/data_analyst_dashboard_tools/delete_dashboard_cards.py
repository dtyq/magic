"""删除Dashboard卡片工具

支持批量删除卡片，自动压缩布局
"""

from pathlib import Path
from typing import Any, Dict, List
from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.tools.abstract_file_tool import AbstractFileTool
from app.core.entity.message.server_message import DisplayType, ToolDetail, TerminalContent
from app.utils.async_file_utils import async_write_text

# 导入共享工具函数
from app.tools.data_analyst_dashboard_tools.dashboard_card_utils import (
    parse_data_js,
    serialize_cards,
    compact_layout,
    get_grid_cols_from_config,
    CardParseError,
)

# 导入验证器
from app.tools.data_analyst_dashboard_tools.validators import (
    DataJsValidator,
    JavascriptSyntaxValidator,
    LayoutGridValidator,
    BrowserValidator,
)

logger = get_logger(__name__)


class DeleteDashboardCardsParams(BaseToolParams):
    """删除Dashboard卡片参数"""
    
    project_path: str = Field(
        ...,
        description="""<!--zh: 看板项目名，相对于工作区根目录，如 "销售分析看板" 或 "SalesDashboard"-->
Dashboard project name, relative to workspace root, e.g. "SalesDashboard" """
    )
    
    card_ids: List[str] = Field(
        ...,
        description="""<!--zh: 要删除的卡片ID列表（1-20个）-->
List of card IDs to delete (1-20 cards)""",
        min_length=1,
        max_length=20
    )
    
    @field_validator('project_path')
    @classmethod
    def validate_project_path(cls, v: str) -> str:
        """验证项目路径"""
        if not v or not isinstance(v, str) or not v.strip():
            raise ValueError("project_path cannot be empty")
        return v.strip()
    
    @field_validator('card_ids')
    @classmethod
    def validate_card_ids(cls, v: List[str]) -> List[str]:
        """验证卡片ID列表"""
        if not v:
            raise ValueError("card_ids cannot be empty")
        
        # 检查重复ID
        if len(v) != len(set(v)):
            raise ValueError("card_ids contains duplicate IDs")
        
        return v


@tool()
class DeleteDashboardCards(AbstractFileTool[DeleteDashboardCardsParams], WorkspaceTool[DeleteDashboardCardsParams]):
    """<!--zh
    删除Dashboard卡片工具
    
    【主要用途】批量删除dashboard卡片，自动压缩布局
    
    【典型场景】
    ✓ 删除过时卡片：移除不再需要的数据展示
    ✓ 清理测试卡片：删除开发过程中的临时卡片
    ✓ 重构看板：批量删除旧卡片，为新设计腾出空间
    ✓ 简化看板：删除冗余卡片，优化信息展示
    
    【核心特性】
    - 支持批量删除（1-20个卡片）
    - 自动压缩布局，填充删除后的空隙
    - 严格验证数据完整性
    - 支持部分成功，返回删除统计和失败原因
    - 仅在全部删除失败时返回错误
    
    【验证规则】
    - 不存在的卡片ID会记录为删除失败原因
    - 删除后至少保留一个卡片（可选规则）
    - 删除后布局必须符合规范
    
    【Layout自动调整】
    - 删除卡片后，自动将下方卡片向上移动
    - 使用react-grid-layout的compact算法压缩布局
    - 填充删除后的空隙，保持布局紧凑
    -->
    Delete Dashboard Cards Tool
    
    【Main Purpose】Batch delete dashboard cards with automatic layout compaction
    
    【Typical Scenarios】
    ✓ Delete outdated cards: Remove data displays no longer needed
    ✓ Clean up test cards: Delete temporary cards from development
    ✓ Refactor dashboard: Batch delete old cards to make room for new design
    ✓ Simplify dashboard: Delete redundant cards to optimize information display
    
    【Core Features】
    - Supports batch deletion (1-20 cards)
    - Automatically compacts layout to fill gaps after deletion
    - Strict data integrity validation
    - Supports partial success with deletion stats and failure reasons
    - Returns an error only when all requested deletions fail
    
    【Validation Rules】
    - Missing card IDs are reported as failed deletions
    - At least one card must remain after deletion (optional rule)
    - Layout must comply with specifications after deletion
    
    【Layout Auto-adjustment】
    - After deleting cards, automatically moves down cards upward
    - Uses react-grid-layout's compact algorithm to compress layout
    - Fills gaps after deletion to keep layout compact
    """
    
    async def execute(self, tool_context: ToolContext, params: DeleteDashboardCardsParams) -> ToolResult:
        """执行删除卡片操作
        
        Args:
            tool_context: 工具上下文
            params: 删除参数
            
        Returns:
            ToolResult: 操作结果
        """
        try:
            # 1. 获取项目路径
            project_path = self.resolve_path(params.project_path)
            if not project_path.exists():
                return ToolResult.error(
                    i18n.translate("dashboard_cards.project_not_exist", category="tool.messages", project_path=params.project_path)
                )
            
            data_js_path = project_path / "data.js"
            if not data_js_path.exists():
                return ToolResult.error(
                    i18n.translate("dashboard_cards.data_js_not_exist", category="tool.messages", project_path=params.project_path)
                )

            grid_cols = get_grid_cols_from_config(project_path)
            
            # 2. 解析现有卡片
            try:
                existing_cards, original_content = parse_data_js(data_js_path)
            except CardParseError as e:
                return ToolResult.error(
                    i18n.translate("dashboard_cards.parse_error", category="tool.messages", error=str(e))
                )
            
            try:
                # 4. 识别可删除和删除失败的卡片ID
                existing_ids = {card['id'] for card in existing_cards}
                deleted_card_ids = [card_id for card_id in params.card_ids if card_id in existing_ids]
                not_found_ids = [card_id for card_id in params.card_ids if card_id not in existing_ids]

                if not deleted_card_ids:
                    return ToolResult.error(
                        self._build_all_failed_content(not_found_ids=not_found_ids)
                    )

                # 5. 检查删除后是否至少保留一个卡片
                remaining_count = len(existing_cards) - len(deleted_card_ids)
                if remaining_count == 0:
                    return ToolResult.error(
                        self._build_all_failed_content(
                            not_found_ids=not_found_ids,
                            blocked_reason="Cannot delete all cards. At least one card must remain.",
                        )
                    )

                # 6. 删除指定卡片
                remaining_cards = [
                    card for card in existing_cards
                    if card['id'] not in deleted_card_ids
                ]

                # 7. 压缩布局（填充删除后的空隙）
                remaining_cards = compact_layout(remaining_cards, grid_cols)

                # 8. 序列化并写入文件
                new_content = serialize_cards(remaining_cards)

                await async_write_text(data_js_path, new_content)

                warnings = []

                # 9. 分发文件修改事件
                try:
                    await self._dispatch_file_event(tool_context, str(data_js_path), EventType.FILE_UPDATED)
                except Exception as e:
                    logger.warning("删除卡片后分发文件事件失败，已跳过: %s", e, exc_info=True)
                    warnings.append(f"File update event dispatch failed: {e}")

                # 10. 严格验证
                try:
                    await self._strict_validate(project_path)
                except Exception as e:
                    logger.warning("删除卡片后严格验证失败，但保留已写入结果: %s", e, exc_info=True)
                    warnings.append(f"Post-write validation failed: {e}")

                # 11. 构建成功结果
                failed_cards = [
                    {
                        "id": card_id,
                        "reason": "id_not_found",
                        "message": "Card ID not found.",
                    }
                    for card_id in not_found_ids
                ]
                result_message = self._build_success_content(
                    deleted_count=len(deleted_card_ids),
                    failed_cards=failed_cards,
                    warnings=warnings,
                )

                return ToolResult(
                    content=result_message,
                    data={
                        "deleted_cards": deleted_card_ids,
                        "failed_cards": failed_cards,
                        "warnings": warnings,
                        "summary": {
                            "requested_count": len(params.card_ids),
                            "deleted_count": len(deleted_card_ids),
                            "failed_count": len(failed_cards),
                            "warning_count": len(warnings),
                            "remaining_count": remaining_count,
                            "total_cards_before": len(existing_cards),
                        },
                    },
                    extra_info={
                        'deleted_cards': deleted_card_ids,
                        'failed_cards': failed_cards,
                        'warnings': warnings,
                        'requested_count': len(params.card_ids),
                        'deleted_count': len(deleted_card_ids),
                        'failed_count': len(failed_cards),
                        'remaining_cards': remaining_count,
                        'total_cards_before': len(existing_cards)
                    }
                )

            except Exception as e:
                logger.error(f"Error during card deletion: {e}", exc_info=True)
                return ToolResult.error(
                    i18n.translate("delete_dashboard_cards.error", category="tool.messages", error=str(e))
                )
                
        except Exception as e:
            logger.error(f"Failed to delete dashboard cards: {e}", exc_info=True)
            return ToolResult.error(
                i18n.translate("delete_dashboard_cards.error", category="tool.messages", error=str(e))
            )
    
    async def _strict_validate(self, project_dir: Path) -> None:
        """执行严格验证
        
        Args:
            project_dir: 项目目录
            
        Raises:
            Exception: 验证失败时抛出
        """
        # 1. DataJsValidator
        data_js_validator = DataJsValidator()
        await data_js_validator.validate(project_dir)
        
        # 2. JavascriptSyntaxValidator
        js_syntax_validator = JavascriptSyntaxValidator()
        await js_syntax_validator.validate(project_dir)
        
        # 3. LayoutGridValidator
        layout_grid_validator = LayoutGridValidator()
        await layout_grid_validator.validate(project_dir)
        
        # 4. BrowserValidator
        browser_validator = BrowserValidator()
        validation_result = await browser_validator.validate(project_dir)
        
        if not validation_result.get('success', True):
            error_details = validation_result.get('error_details', {})
            if error_details:
                error_messages = error_details.get('error_messages', [])
                total_error_count = error_details.get('total_error_count', 0)
                if total_error_count > 0:
                    error_summary = f"Browser validation failed with {total_error_count} error(s):\n"
                    error_summary += "\n".join(f"- {msg}" for msg in error_messages[:5])
                    raise ValueError(error_summary)
            else:
                raise ValueError(validation_result.get('error', 'Browser validation failed'))
    
    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        summary = result.data.get("summary", {}) if getattr(result, "data", None) else {}
        deleted_count = summary.get("deleted_count")
        failed_count = summary.get("failed_count", 0)

        if deleted_count is None:
            deleted_count = len(arguments.get('card_ids', [])) if arguments else 0

        if failed_count > 0:
            return i18n.translate(
                "delete_dashboard_cards.partial_success",
                category="tool.messages",
                deleted=deleted_count,
                failed=failed_count,
            )

        return i18n.translate(
            "delete_dashboard_cards.success",
            category="tool.messages",
            count=deleted_count,
        )

    def _build_success_content(self, deleted_count: int, failed_cards: List[Dict[str, str]], warnings: List[str]) -> str:
        """构建给调用agent读取的成功内容"""
        message = f"Deleted {deleted_count} requested card(s)."

        if failed_cards:
            failed_ids = ", ".join(card["id"] for card in failed_cards)
            message += (
                f" Failed to delete {len(failed_cards)} card(s) because the IDs were not found: "
                f"{failed_ids}."
            )

        if warnings:
            message += f" Warnings: {'; '.join(warnings)}."

        return message

    def _build_all_failed_content(self, not_found_ids: List[str], blocked_reason: str | None = None) -> str:
        """构建全部失败时给调用agent读取的错误内容"""
        reasons = []

        if not_found_ids:
            reasons.append(
                f"{len(not_found_ids)} requested card ID(s) were not found: {', '.join(not_found_ids)}."
            )

        if blocked_reason:
            reasons.append(blocked_reason)

        if not reasons:
            reasons.append("No cards could be deleted.")

        return "Failed to delete any requested cards. " + " ".join(reasons)
