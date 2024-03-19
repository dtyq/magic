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
from app.tools.workspace_guard_tool import WorkspaceGuardTool
from app.tools.abstract_file_tool import AbstractFileTool
from app.core.entity.message.server_message import DisplayType, ToolDetail, TerminalContent

# 导入共享工具函数
from app.tools.data_analyst_dashboard_tools.dashboard_card_utils import (
    parse_data_js,
    serialize_cards,
    compact_layout,
    CardParseError,
    GRID_COLS
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
class DeleteDashboardCards(AbstractFileTool[DeleteDashboardCardsParams], WorkspaceGuardTool[DeleteDashboardCardsParams]):
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
    - 原子性操作：全部成功或全部失败
    - 防止删除不存在的卡片
    
    【验证规则】
    - 所有卡片ID必须存在
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
    - Atomic operation: all succeed or all fail
    - Prevents deletion of non-existent cards
    
    【Validation Rules】
    - All card IDs must exist
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
            project_path, error = self.get_safe_path(params.project_path)
            if error:
                return ToolResult(error=error)
            
            if not project_path.exists():
                return ToolResult(
                    error=i18n.translate("dashboard_cards.project_not_exist", category="tool.messages", project_path=params.project_path)
                )
            
            data_js_path = project_path / "data.js"
            if not data_js_path.exists():
                return ToolResult(
                    error=i18n.translate("dashboard_cards.data_js_not_exist", category="tool.messages", project_path=params.project_path)
                )
            
            # 2. 解析现有卡片
            try:
                existing_cards, original_content = parse_data_js(data_js_path)
            except CardParseError as e:
                return ToolResult(
                    error=i18n.translate("dashboard_cards.parse_error", category="tool.messages", error=str(e))
                )
            
            # 3. 备份原始内容（用于回滚）
            backup_content = original_content
            
            try:
                # 4. 验证所有要删除的卡片ID存在
                existing_ids = {card['id'] for card in existing_cards}
                not_found_ids = []
                
                for card_id in params.card_ids:
                    if card_id not in existing_ids:
                        not_found_ids.append(card_id)
                
                if not_found_ids:
                    return ToolResult(
                        error=i18n.translate("dashboard_cards.id_not_found", category="tool.messages", card_id=', '.join(not_found_ids))
                    )
                
                # 5. 检查删除后是否至少保留一个卡片
                remaining_count = len(existing_cards) - len(params.card_ids)
                if remaining_count == 0:
                    return ToolResult(
                        error=i18n.translate("delete_dashboard_cards.cannot_delete_all", category="tool.messages")
                    )
                
                # 6. 删除指定卡片
                remaining_cards = [
                    card for card in existing_cards
                    if card['id'] not in params.card_ids
                ]
                
                # 7. 压缩布局（填充删除后的空隙）
                remaining_cards = compact_layout(remaining_cards, GRID_COLS)
                
                # 8. 序列化并写入文件
                new_content = serialize_cards(remaining_cards)
                
                with open(data_js_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                
                # 分发文件修改事件
                await self._dispatch_file_event(tool_context, str(data_js_path), EventType.FILE_UPDATED)
                
                # 9. 严格验证
                try:
                    await self._strict_validate(project_path)
                except Exception as e:
                    # 验证失败，回滚
                    with open(data_js_path, 'w', encoding='utf-8') as f:
                        f.write(backup_content)
                    await self._dispatch_file_event(tool_context, str(data_js_path), EventType.FILE_UPDATED)
                    return ToolResult(
                        error=i18n.translate("dashboard_cards.validation_rollback", category="tool.messages", error=str(e))
                    )
                
                # 10. 构建成功结果
                result_message = i18n.translate("delete_dashboard_cards.success", category="tool.messages",
                    count=len(params.card_ids),
                    remaining=remaining_count)
                
                return ToolResult(
                    content=result_message,
                    extra_info={
                        'deleted_cards': params.card_ids,
                        'remaining_cards': remaining_count,
                        'total_cards_before': len(existing_cards)
                    }
                )
                
            except Exception as e:
                # 发生错误，回滚
                logger.error(f"Error during card deletion: {e}", exc_info=True)
                with open(data_js_path, 'w', encoding='utf-8') as f:
                    f.write(backup_content)
                await self._dispatch_file_event(tool_context, str(data_js_path), EventType.FILE_UPDATED)
                return ToolResult(
                    error=i18n.translate("dashboard_cards.operation_rollback", category="tool.messages", error=str(e))
                )
                
        except Exception as e:
            logger.error(f"Failed to delete dashboard cards: {e}", exc_info=True)
            return ToolResult(
                error=i18n.translate("delete_dashboard_cards.error", category="tool.messages", error=str(e))
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
        if not arguments:
            card_ids_count = 0
        else:
            card_ids_count = len(arguments.get('card_ids', []))
        
        return i18n.translate("delete_dashboard_cards.success", category="tool.messages",
            count=card_ids_count,
            remaining=0)
