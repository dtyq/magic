"""创建Dashboard卡片工具

支持批量创建卡片，自动处理layout冲突和验证
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
from app.tools.workspace_tool import WorkspaceTool
from app.tools.abstract_file_tool import AbstractFileTool
from app.core.entity.message.server_message import DisplayType, ToolDetail, TerminalContent

# 导入共享工具函数
from app.tools.data_analyst_dashboard_tools.dashboard_card_utils import (
    parse_data_js,
    serialize_cards,
    validate_card_structure,
    validate_getCardData_syntax,
    compact_layout,
    push_down_colliding_cards,
    compute_auto_layout,
    get_grid_cols_from_config,
    CardParseError,
    CardValidationError,
    VALID_CARD_TYPES,
    GRID_COLS,
)

# 导入验证器
from app.tools.data_analyst_dashboard_tools.validators import MagicProjectValidator
from app.tools.data_analyst_dashboard_tools.dashboard_sync_utils import (
    sync_geo_and_data_sources,
)

logger = get_logger(__name__)


class CardCreation(BaseToolParams):
    """<!--zh: 单个卡片的创建信息-->
    Single card creation information"""
    
    id: str = Field(
        ...,
        description="""<!--zh: 卡片唯一标识（必需），建议使用英文和下划线，如 "sales_trend"、"total_revenue"-->
Card unique identifier (required), recommend using English and underscores, e.g., "sales_trend", "total_revenue" """
    )
    
    type: str = Field(
        ...,
        description=f"""<!--zh: 卡片类型（必需），必须是以下之一：{', '.join(VALID_CARD_TYPES)}-->
Card type (required), must be one of: {', '.join(VALID_CARD_TYPES)}"""
    )
    
    source: str = Field(
        ...,
        description="""<!--zh: 数据源路径（必需），例如："./cleaned_data/销售数据.csv"-->
Data source path (required), e.g. "./cleaned_data/sales_data.csv" """
    )
    
    title: Optional[str] = Field(
        default=None,
        description="""<!--zh: 卡片标题（可选），如 "销售趋势分析"。卡片建议设置title(指标卡片除外)-->
Card title (optional), e.g., "Sales Trend Analysis". Cards are recommended to set title (except metric cards) """
    )
    
    titleAlign: Optional[str] = Field(
        default=None,
        description="""<!--zh: 标题对齐方式（可选），可选值：left、center、right-->
Title alignment (optional), values: left, center, right"""
    )
    
    layout: Optional[Dict[str, int]] = Field(
        default=None,
        description=f"""<!--zh: 布局配置（可选）。当 auto_layout=True 时可省略，由工具自动计算铺满无空隙的布局；当 auto_layout=False 时必需。包含 x、y、w、h 四个整数字段。示例：{{"x": 0, "y": 0, "w": 8, "h": 6}}-->
Layout configuration (optional). Omit when auto_layout=True for auto-computed gap-free layout; required when auto_layout=False. Example: {{"x": 0, "y": 0, "w": 8, "h": 6}}"""
    )
    
    getCardData: str = Field(
        ...,
        description="""<!--zh: 数据加载函数代码（必需），async函数，参数为csv对象，返回CardData。示例：async (csv) => { const result = await csv.load('销售数据'); return { label: '总销售额', value: 1000000 }; }-->
Data loading function code (required), async function with csv parameter, returns CardData. Example: async (csv) => { const result = await csv.load('sales_data'); return { label: 'Total Sales', value: 1000000 }; }"""
    )
    
    @field_validator('type')
    @classmethod
    def validate_type(cls, v: str) -> str:
        """验证卡片类型"""
        if v not in VALID_CARD_TYPES:
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


class CreateDashboardCardsParams(BaseToolParams):
    """创建Dashboard卡片参数"""
    
    project_path: str = Field(
        ...,
        description="""<!--zh: 看板项目名，相对于工作区根目录，如 "销售分析看板" 或 "SalesDashboard"-->
Dashboard project name, relative to workspace root, e.g. "SalesDashboard" """
    )
    
    cards: List[CardCreation] = Field(
        ...,
        description="""<!--zh: 要创建的卡片列表（1-10个）-->
List of cards to create (1-10 cards)""",
        min_length=1,
        max_length=10
    )
    
    auto_layout: bool = Field(
        default=False,
        description="""<!--zh: 是否自动计算布局（默认 False）。为 True 时忽略卡片中的 layout，按类型顺序自动生成铺满无空隙的布局，避免 validate 反复失败-->
Whether to auto-compute layout (default False). When True, ignores card layout and generates gap-free layout by type order to avoid repeated validate failures"""
    )
    
    @field_validator('project_path')
    @classmethod
    def validate_project_path(cls, v: str) -> str:
        """验证项目路径"""
        if not v or not isinstance(v, str) or not v.strip():
            raise ValueError("project_path cannot be empty")
        return v.strip()


@tool()
class CreateDashboardCards(AbstractFileTool[CreateDashboardCardsParams], WorkspaceTool[CreateDashboardCardsParams]):
    """<!--zh
    创建Dashboard卡片工具
    
    【调用时机】完成 cards_todo.md 规划和 data_cleaning.py 执行后，按规划批量创建卡片
    
    【主要用途】批量创建新的dashboard卡片，自动处理layout冲突
    
    【project_path】使用看板项目名，相对于工作区根目录，如 "销售分析看板" 或 "SalesDashboard"
    
    【典型场景】
    ✓ 创建指标卡片：展示关键业务指标
    ✓ 创建图表卡片：展示数据趋势和分布
    ✓ 创建表格卡片：展示详细数据列表
    ✓ 创建Markdown卡片：添加说明文档
    
    【核心特性】
    - 支持批量创建（1-10个卡片）
    - 自动检测并解决layout冲突
    - 自动压缩布局，保持紧凑
    - 严格验证数据完整性
    - 部分成功：验证失败的卡片跳过，成功创建的照常写入
    
    【验证规则】
    - ID唯一性：不与现有卡片冲突
    - Type有效性：必须是metric、table、markdown、echarts之一
    - Layout合法性：x+w≤24，所有值为正整数
    - Source格式：必须以./cleaned_data/开头
    - JavaScript语法：自动检查getCardData函数语法
    
    【Layout自动调整】
    - 新添加的卡片建议都往后面插入（layout.y 取现有卡片最大 y+h 之后的行，避免影响已有卡片布局）
    - 新卡片插入时，自动将重叠的下方卡片向下推移
    - 使用react-grid-layout的compact算法压缩布局
    - 保持布局紧凑无空隙
    -->
    Create Dashboard Cards Tool
    
    【Invocation】After completing cards_todo.md planning and data_cleaning.py execution
    
    【Main Purpose】Batch create new dashboard cards with automatic layout conflict resolution
    
    【project_path】Use dashboard project name relative to workspace root, e.g. "SalesDashboard"
    
    【Typical Scenarios】
    ✓ Create metric cards: Display key business metrics
    ✓ Create chart cards: Display data trends and distributions
    ✓ Create table cards: Display detailed data lists
    ✓ Create Markdown cards: Add documentation
    
    【Core Features】
    - Supports batch creation (1-10 cards)
    - Automatically detects and resolves layout conflicts
    - Automatically compacts layout for compactness
    - Strict data integrity validation
    - Partial success: validation-failed cards are skipped, successful ones are written
    
    【Validation Rules】
    - ID uniqueness: No conflict with existing cards
    - Type validity: Must be metric, table, markdown, or echarts
    - Layout legality: x+w≤24, all values are positive integers
    - Source format: Must start with ./cleaned_data/
    - JavaScript syntax: Automatically checks getCardData function syntax
    
    【Layout Auto-adjustment】
    - Insert new cards at the back (set layout.y to row after max y+h of existing cards, avoid affecting existing cards layout)
    - When inserting new cards, automatically pushes down overlapping cards
    - Uses react-grid-layout's compact algorithm to compress layout
    - Keeps layout compact without gaps
    """
    
    async def execute(self, tool_context: ToolContext, params: CreateDashboardCardsParams) -> ToolResult:
        """执行创建卡片操作
        
        Args:
            tool_context: 工具上下文
            params: 创建参数
            
        Returns:
            ToolResult: 操作结果
        """
        try:
            # 1. 获取项目路径
            project_path = self.resolve_path(params.project_path)
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
            
            # 3.1 当 auto_layout=False 时，所有卡片必须提供 layout
            if not params.auto_layout:
                for card_creation in params.cards:
                    if card_creation.layout is None:
                        return ToolResult(
                            error=i18n.translate(
                                "create_dashboard_cards.layout_required",
                                category="tool.messages",
                                card_id=card_creation.id,
                            )
                        )
            
            try:
                # 4. 验证新卡片（部分成功：验证失败仅跳过该卡片，不回滚整批）
                existing_ids = [card['id'] for card in existing_cards]
                new_cards_data = []
                failed_cards = []  # [(card_id, reason), ...]
                grid_cols = get_grid_cols_from_config(project_path)
                
                for i, card_creation in enumerate(params.cards):
                    # 确定 layout：auto_layout 时用占位符（后续会覆盖），否则必须提供
                    layout = card_creation.layout
                    if params.auto_layout:
                        layout = layout or {"x": 0, "y": 0, "w": 1, "h": 1}
                    
                    # 转换为字典
                    card_dict = {
                        'id': card_creation.id,
                        'type': card_creation.type,
                        'source': card_creation.source,
                        'layout': layout,
                        'getCardData': card_creation.getCardData
                    }
                    
                    if card_creation.title:
                        card_dict['title'] = card_creation.title
                    if card_creation.titleAlign:
                        card_dict['titleAlign'] = card_creation.titleAlign
                    
                    # 验证 layout 合法性（需传入 grid_cols 以支持动态配置）
                    if layout["x"] + layout["w"] > grid_cols:
                        failed_cards.append((
                            card_dict['id'],
                            f"Layout exceeds grid: x+w={layout['x']+layout['w']} > GRID_COLS({grid_cols})"
                        ))
                        continue
                    
                    # 验证卡片结构
                    try:
                        validate_card_structure(card_dict, existing_ids)
                    except CardValidationError as e:
                        failed_cards.append((card_dict['id'], str(e)))
                        continue
                    
                    # 验证getCardData语法
                    try:
                        validate_getCardData_syntax(card_dict['getCardData'], card_dict['id'])
                    except CardValidationError as e:
                        failed_cards.append((card_dict['id'], str(e)))
                        continue
                    
                    new_cards_data.append(card_dict)
                    existing_ids.append(card_dict['id'])
                
                # 若全部失败，返回错误
                if not new_cards_data:
                    failed_list = "; ".join(f"{cid} ({reason})" for cid, reason in failed_cards)
                    return ToolResult(
                        error=i18n.translate("create_dashboard_cards.skipped", category="tool.messages", failed_list=failed_list)
                    )
                
                # 5. 处理 layout
                all_cards = existing_cards.copy()
                affected_cards_summary = []
                
                if params.auto_layout:
                    # 自动计算布局：按类型顺序铺满无空隙
                    compute_auto_layout(existing_cards, new_cards_data, grid_cols)
                    for new_card in new_cards_data:
                        all_cards.append(new_card)
                else:
                    # 手动 layout：沿用原有碰撞推移 + 压缩逻辑
                    for new_card in new_cards_data:
                        all_cards, affected_ids = push_down_colliding_cards(all_cards, new_card)
                        if affected_ids:
                            affected_cards_summary.append({
                                'new_card_id': new_card['id'],
                                'affected_ids': affected_ids
                            })
                        all_cards.append(new_card)
                    all_cards = compact_layout(all_cards, grid_cols)
                
                # 7. 序列化并写入文件
                new_content = serialize_cards(all_cards)
                
                with open(data_js_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                
                # 分发文件修改事件
                await self._dispatch_file_event(tool_context, str(data_js_path), EventType.FILE_UPDATED)

                # 8. 创建后自动同步地图与数据源配置，并在至少有一个卡片新增成功时设置为 ready
                created_ids = [card['id'] for card in new_cards_data]
                extra_info: Dict[str, Any] = {
                    'created_cards': created_ids,
                    'total_cards': len(all_cards),
                    'affected_cards': affected_cards_summary,
                }

                # 8.1 同步地图与数据源配置（复用公共工具）
                await sync_geo_and_data_sources(
                    tool=self,
                    tool_context=tool_context,
                    project_path=project_path,
                    phase="创建卡片阶段",
                    extra_info=extra_info,
                )

                # 8.2 若至少有一个卡片新增成功，则将 dashboard 标记为 ready
                try:
                    if created_ids:
                        index_html_path = project_path / "index.html"
                        if index_html_path.exists():
                            magic_project_validator = MagicProjectValidator()
                            await magic_project_validator.set_dashboard_ready(index_html_path)
                            extra_info["dashboard_ready_set"] = True
                        else:
                            extra_info["dashboard_ready_warning"] = "index.html 不存在，已跳过 ready 标记"
                except Exception as e:
                    logger.warning(
                        "在创建卡片后设置 dashboard ready 状态失败，已跳过: %s",
                        e,
                        exc_info=True,
                    )

                # 9. 构建成功结果
                result_message = i18n.translate("create_dashboard_cards.success", category="tool.messages", count=len(created_ids))
                
                if failed_cards:
                    failed_list = "; ".join(f"{cid} ({reason})" for cid, reason in failed_cards)
                    result_message += "\n\n" + i18n.translate("create_dashboard_cards.skipped", category="tool.messages", failed_list=failed_list)
                    extra_info["failed_cards"] = [{"id": cid, "reason": r} for cid, r in failed_cards]
                
                if affected_cards_summary:
                    layout_messages = []
                    for item in affected_cards_summary:
                        layout_messages.append(
                            i18n.translate("create_dashboard_cards.layout_adjustment", category="tool.messages",
                                new_card_id=item['new_card_id'],
                                affected_count=len(item['affected_ids']))
                        )
                    result_message += "\n\n" + "\n".join(layout_messages)
                
                return ToolResult(
                    content=result_message,
                    extra_info=extra_info,
                    ok=True,  # 部分成功也算成功，仅全部失败才返回 error
                )
                
            except Exception as e:
                # 发生错误，回滚
                logger.error(f"Error during card creation: {e}", exc_info=True)
                with open(data_js_path, 'w', encoding='utf-8') as f:
                    f.write(backup_content)
                await self._dispatch_file_event(tool_context, str(data_js_path), EventType.FILE_UPDATED)
                return ToolResult(
                    error=i18n.translate("dashboard_cards.operation_rollback", category="tool.messages", error=str(e))
                )
                
        except Exception as e:
            logger.error(f"Failed to create dashboard cards: {e}", exc_info=True)
            return ToolResult(
                error=i18n.translate("create_dashboard_cards.error", category="tool.messages", error=str(e))
            )

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if not arguments:
            cards_count = 0
        else:
            cards_count = len(arguments.get('cards', []))
        
        return i18n.translate("create_dashboard_cards.success", category="tool.messages", count=cards_count)
