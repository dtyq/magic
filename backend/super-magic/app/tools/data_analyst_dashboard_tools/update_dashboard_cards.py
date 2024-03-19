"""更新Dashboard卡片工具

支持批量更新卡片，支持单字段编辑，自动处理layout变更
"""

from pathlib import Path
from typing import Any, Dict, List, Optional
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
    validate_card_structure,
    validate_getCardData_syntax,
    compact_layout,
    CardParseError,
    CardValidationError,
    VALID_CARD_TYPES,
    GRID_COLS
)

# 导入验证器
from app.tools.data_analyst_dashboard_tools.dashboard_sync_utils import (
    sync_geo_and_data_sources,
)

logger = get_logger(__name__)


class CardUpdate(BaseToolParams):
    """<!--zh: 单个卡片的更新信息（所有字段都是可选的，只更新提供的字段）-->
    Single card update information (all fields are optional, only provided fields will be updated)"""
    
    id: str = Field(
        ...,
        description="""<!--zh: 要更新的卡片ID（必需）-->
Card ID to update (required)"""
    )
    
    type: Optional[str] = Field(
        default=None,
        description=f"""<!--zh: 新的卡片类型（可选），必须是以下之一：{', '.join(VALID_CARD_TYPES)}-->
New card type (optional), must be one of: {', '.join(VALID_CARD_TYPES)}"""
    )
    
    source: Optional[str] = Field(
        default=None,
        description="""<!--zh: 数据源路径（必需），例如："./cleaned_data/销售数据.csv"-->
Data source path (required), e.g. "./cleaned_data/sales_data.csv" """
    )
    
    title: Optional[str] = Field(
        default=None,
        description="""<!--zh: 新的卡片标题（可选）。卡片建议设置title(指标卡片除外)-->
New card title (optional). Cards are recommended to set title (except metric cards)"""
    )
    
    titleAlign: Optional[str] = Field(
        default=None,
        description="""<!--zh: 新的标题对齐方式（可选），可选值：left、center、right-->
New title alignment (optional), values: left, center, right"""
    )
    
    layout: Optional[Dict[str, int]] = Field(
        default=None,
        description=f"""<!--zh: 新的布局配置（可选），支持部分字段更新。可以只提供需要修改的字段，如 {{"y": 10}} 只修改y坐标-->
New layout configuration (optional), supports partial field updates. Can provide only fields to modify, e.g., {{"y": 10}} only modifies y coordinate"""
    )
    
    getCardData: Optional[str] = Field(
        default=None,
        description="""<!--zh: 新的数据加载函数代码（可选）-->
New data loading function code (optional)"""
    )
    
    @field_validator('type')
    @classmethod
    def validate_type(cls, v: Optional[str]) -> Optional[str]:
        """验证卡片类型"""
        if v is not None and v not in VALID_CARD_TYPES:
            raise ValueError(f"Invalid card type: {v}. Must be one of {VALID_CARD_TYPES}")
        return v
    
    @field_validator('titleAlign')
    @classmethod
    def validate_title_align(cls, v: Optional[str]) -> Optional[str]:
        """验证标题对齐"""
        if v is not None:
            valid_aligns = ['left', 'center', 'right']
            if v not in valid_aligns:
                raise ValueError(f"Invalid titleAlign: {v}. Must be one of {valid_aligns}")
        return v


class UpdateDashboardCardsParams(BaseToolParams):
    """更新Dashboard卡片参数"""
    
    project_path: str = Field(
        ...,
        description="""<!--zh: 看板项目名，相对于工作区根目录，如 "销售分析看板" 或 "SalesDashboard"-->
Dashboard project name, relative to workspace root, e.g. "SalesDashboard" """
    )
    
    updates: List[CardUpdate] = Field(
        ...,
        description="""<!--zh: 要更新的卡片列表（1-10个），每个卡片至少要提供一个要更新的字段-->
List of card updates (1-10 cards), each card must provide at least one field to update""",
        min_length=1,
        max_length=10
    )
    
    @field_validator('project_path')
    @classmethod
    def validate_project_path(cls, v: str) -> str:
        """验证项目路径"""
        if not v or not isinstance(v, str) or not v.strip():
            raise ValueError("project_path cannot be empty")
        return v.strip()
    
    @field_validator('updates')
    @classmethod
    def validate_updates(cls, v: List[CardUpdate]) -> List[CardUpdate]:
        """验证每个更新至少包含一个字段"""
        for i, update in enumerate(v):
            has_update = any([
                update.type is not None,
                update.source is not None,
                update.title is not None,
                update.titleAlign is not None,
                update.layout is not None,
                update.getCardData is not None,
            ])
            if not has_update:
                raise ValueError(
                    f"Update at index {i} (card_id: {update.id}) "
                    f"must provide at least one field to update"
                )
        return v


@tool()
class UpdateDashboardCards(AbstractFileTool[UpdateDashboardCardsParams], WorkspaceGuardTool[UpdateDashboardCardsParams]):
    """<!--zh
    更新Dashboard卡片工具
    
    【主要用途】批量更新现有dashboard卡片，支持单字段编辑
    
    【典型场景】
    ✓ 修改卡片标题：更新显示文本
    ✓ 调整卡片位置：修改layout坐标
    ✓ 更换数据源：修改source路径
    ✓ 更新数据逻辑：修改getCardData函数
    ✓ 批量调整：同时修改多个卡片的相同属性
    
    【核心特性】
    - 支持批量更新（1-10个卡片）
    - 支持单字段编辑（只更新提供的字段）
    - 支持layout部分字段更新（如只修改y坐标）
    - 自动处理layout变更引起的冲突
    - 自动压缩布局，保持紧凑
    - 严格验证数据完整性
    - 部分成功：验证失败或ID不存在的卡片跳过，成功更新的照常写入
    
    【验证规则】
    - 卡片ID必须存在
    - 更新后的字段必须符合验证规则
    - Layout更新不能导致卡片超出网格边界
    - JavaScript语法检查（如果更新getCardData）
    
    【Layout自动调整】
    - 编辑卡片layout时，自动检测与其他卡片的碰撞
    - 使用react-grid-layout的compact算法压缩布局
    - 保持布局紧凑无空隙
    
    【单字段更新】支持只提供需修改的字段，如 {"id": "xxx", "layout": {"y": 10}} 仅更新y坐标；每个update至少提供一个非id的更新字段
    -->
    Update Dashboard Cards Tool
    
    【Main Purpose】Batch update existing dashboard cards with single-field editing support
    
    【Typical Scenarios】
    ✓ Modify card title: Update display text
    ✓ Adjust card position: Modify layout coordinates
    ✓ Change data source: Modify source path
    ✓ Update data logic: Modify getCardData function
    ✓ Batch adjustment: Modify same properties of multiple cards simultaneously
    
    【Core Features】
    - Supports batch updates (1-10 cards)
    - Supports single-field editing (only updates provided fields)
    - Supports partial layout field updates (e.g., only modify y coordinate)
    - Automatically handles conflicts caused by layout changes
    - Automatically compacts layout for compactness
    - Strict data integrity validation
    - Partial success: validation-failed or not-found cards are skipped, successful ones are written
    
    【Validation Rules】
    - Card ID must exist
    - Updated fields must comply with validation rules
    - Layout updates cannot cause cards to exceed grid boundaries
    - JavaScript syntax check (if updating getCardData)
    
    【Layout Auto-adjustment】
    - When editing card layout, automatically detects collisions with other cards
    - Uses react-grid-layout's compact algorithm to compress layout
    - Keeps layout compact without gaps
    
    【Partial Update】Can provide only fields to modify, e.g. {"id": "xxx", "layout": {"y": 10}}; each update must provide at least one non-id field
    """
    
    async def execute(self, tool_context: ToolContext, params: UpdateDashboardCardsParams) -> ToolResult:
        """执行更新卡片操作
        
        Args:
            tool_context: 工具上下文
            params: 更新参数
            
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
                # 4. 应用更新（部分成功：ID不存在或验证失败仅跳过该卡片，不回滚整批）
                existing_ids = {card['id']: i for i, card in enumerate(existing_cards)}
                updated_cards = [c.copy() for c in existing_cards]
                updated_card_ids = []
                failed_updates = []  # [(card_id, reason), ...]
                
                for update in params.updates:
                    if update.id not in existing_ids:
                        failed_updates.append((
                            update.id,
                            i18n.translate("update_dashboard_cards.id_not_found", category="tool.messages", card_id=update.id)
                        ))
                        continue
                    
                    card_index = existing_ids[update.id]
                    card = updated_cards[card_index].copy()
                    
                    # 合并更新字段
                    if update.type is not None:
                        card['type'] = update.type
                    if update.source is not None:
                        card['source'] = update.source
                    if update.title is not None:
                        card['title'] = update.title
                    if update.titleAlign is not None:
                        card['titleAlign'] = update.titleAlign
                    if update.getCardData is not None:
                        card['getCardData'] = update.getCardData
                    
                    # 处理layout更新（支持部分字段更新）
                    if update.layout is not None:
                        if 'layout' not in card:
                            card['layout'] = {}
                        for key in ['x', 'y', 'w', 'h']:
                            if key in update.layout:
                                card['layout'][key] = update.layout[key]
                    
                    # 验证更新后的卡片
                    try:
                        other_ids = [cid for cid in existing_ids.keys() if cid != update.id]
                        validate_card_structure(card, other_ids)
                    except CardValidationError as e:
                        failed_updates.append((update.id, str(e)))
                        continue
                    
                    if update.getCardData is not None:
                        try:
                            validate_getCardData_syntax(card['getCardData'], card['id'])
                        except CardValidationError as e:
                            failed_updates.append((update.id, str(e)))
                            continue
                    
                    updated_cards[card_index] = card
                    updated_card_ids.append(update.id)
                
                # 若全部失败，返回错误
                if not updated_card_ids:
                    failed_list = "; ".join(f"{cid} ({reason})" for cid, reason in failed_updates)
                    return ToolResult(
                        error=i18n.translate("update_dashboard_cards.skipped", category="tool.messages", failed_list=failed_list)
                    )
                
                # 6. 压缩布局（处理layout变更引起的冲突）
                updated_cards = compact_layout(updated_cards, GRID_COLS)
                
                # 7. 序列化并写入文件
                new_content = serialize_cards(updated_cards)
                
                with open(data_js_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                
                # 分发文件修改事件
                await self._dispatch_file_event(tool_context, str(data_js_path), EventType.FILE_UPDATED)

                # 8. 更新后自动同步地图与数据源配置
                result_message = i18n.translate("update_dashboard_cards.success", category="tool.messages", count=len(updated_card_ids))

                extra_info: Dict[str, Any] = {
                    'updated_cards': updated_card_ids,
                    'total_cards': len(updated_cards),
                }

                if failed_updates:
                    failed_list = "; ".join(f"{cid} ({reason})" for cid, reason in failed_updates)
                    result_message += "\n\n" + i18n.translate("update_dashboard_cards.skipped", category="tool.messages", failed_list=failed_list)
                    extra_info["failed_updates"] = [{"id": cid, "reason": r} for cid, r in failed_updates]

                # 8.1 同步地图与数据源配置（复用公共工具）
                await sync_geo_and_data_sources(
                    tool=self,
                    tool_context=tool_context,
                    project_path=project_path,
                    phase="更新卡片阶段",
                    extra_info=extra_info,
                )

                return ToolResult(
                    content=result_message,
                    extra_info=extra_info,
                    ok=True,  # 部分成功也算成功，仅全部失败才返回 error
                )
                
            except Exception as e:
                # 发生错误，回滚
                logger.error(f"Error during card update: {e}", exc_info=True)
                with open(data_js_path, 'w', encoding='utf-8') as f:
                    f.write(backup_content)
                await self._dispatch_file_event(tool_context, str(data_js_path), EventType.FILE_UPDATED)
                return ToolResult(
                    error=i18n.translate("dashboard_cards.operation_rollback", category="tool.messages", error=str(e))
                )
                
        except Exception as e:
            logger.error(f"Failed to update dashboard cards: {e}", exc_info=True)
            return ToolResult(
                error=i18n.translate("update_dashboard_cards.error", category="tool.messages", error=str(e))
            )

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments:
            updates_count = 0
        else:
            updates_count = len(arguments.get('updates', []))
        
        return i18n.translate("update_dashboard_cards.success", category="tool.messages", count=updates_count)
