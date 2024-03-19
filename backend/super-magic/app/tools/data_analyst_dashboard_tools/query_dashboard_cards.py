"""查询Dashboard卡片工具

支持查询所有卡片或指定卡片的信息，可自定义返回字段
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_guard_tool import WorkspaceGuardTool
from app.tools.abstract_file_tool import AbstractFileTool

# 导入共享工具函数
from app.tools.data_analyst_dashboard_tools.dashboard_card_utils import (
    parse_data_js,
    CardParseError
)

logger = get_logger(__name__)


class QueryDashboardCardsParams(BaseToolParams):
    """查询Dashboard卡片参数"""
    
    project_path: str = Field(
        ...,
        description="""<!--zh: 看板项目名，相对于工作区根目录，如 "销售分析看板" 或 "SalesDashboard"-->
Dashboard project name, relative to workspace root, e.g. "SalesDashboard" """
    )
    
    card_ids: Optional[List[str]] = Field(
        default=None,
        description="""<!--zh: 要查询的卡片ID列表（1-20个）。不提供则返回所有卡片-->
List of card IDs to query (1-20 cards). If not provided, returns all cards""",
        min_length=1,
        max_length=20
    )
    
    fields: Optional[List[str]] = Field(
        default=None,
        description="""<!--zh: 要返回的字段列表，如 ["id", "type", "layout"]。不提供则返回所有字段。支持的字段：id, type, title, source, layout, titleAlign, getCardData-->
List of fields to return, e.g. ["id", "type", "layout"]. If not provided, returns all fields. Supported fields: id, type, title, source, layout, titleAlign, getCardData"""
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
    def validate_card_ids(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """验证卡片ID列表"""
        if v is None:
            return None
        
        if not v:
            raise ValueError("card_ids cannot be empty list")
        
        # 检查重复ID
        if len(v) != len(set(v)):
            raise ValueError("card_ids contains duplicate IDs")
        
        return v
    
    @field_validator('fields')
    @classmethod
    def validate_fields(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """验证字段列表"""
        if v is None:
            return None
        
        if not v:
            raise ValueError("fields cannot be empty list")
        
        # 支持的字段列表
        supported_fields = {'id', 'type', 'title', 'source', 'layout', 'titleAlign', 'getCardData'}
        
        # 检查是否有不支持的字段
        invalid_fields = set(v) - supported_fields
        if invalid_fields:
            raise ValueError(f"Unsupported fields: {', '.join(invalid_fields)}. Supported fields: {', '.join(sorted(supported_fields))}")
        
        return v


@tool()
class QueryDashboardCards(AbstractFileTool[QueryDashboardCardsParams], WorkspaceGuardTool[QueryDashboardCardsParams]):
    """<!--zh
    查询Dashboard卡片工具
    
    【主要用途】查询看板中的卡片信息，支持灵活的查询和字段过滤
    
    【典型场景】
    ✓ 快速浏览：不指定card_ids和fields，获取所有卡片的基本信息
    ✓ 查看卡片配置：指定card_ids，获取特定卡片的完整配置
    ✓ 字段过滤：通过fields参数只返回需要的字段（如只要id、type、layout）
    ✓ 复制卡片配置：获取配置用于创建相似卡片
    ✓ 调试卡片：检查getCardData函数代码
    
    【参数说明】
    - project_path: 必填，看板项目路径
    - card_ids: 可选，不提供则返回所有卡片，提供则返回指定卡片（1-20个）
    - fields: 可选，不提供则返回所有字段，提供则只返回指定字段
    
    【返回信息】
    - cards: 卡片信息数组，根据fields参数返回对应字段
    - not_found: 未找到的卡片ID列表（仅当指定card_ids时）
    - total: 卡片总数（仅当未指定card_ids时）
    
    【支持的字段】
    - id: 卡片ID
    - type: 卡片类型
    - title: 卡片标题
    - source: 数据源
    - layout: 布局信息（x, y, w, h）
    - titleAlign: 标题对齐方式
    - getCardData: getCardData函数代码
    
    【核心特性】
    - 灵活查询：支持查询所有或指定卡片
    - 字段过滤：按需返回字段，减少数据量
    - 批量操作：支持批量查询（1-20个卡片）
    - 只读操作：不修改数据
    
    【使用建议】
    - 快速浏览时不指定card_ids和fields
    - 需要详细信息时指定card_ids
    - 需要特定字段时使用fields过滤
    -->
    Query Dashboard Cards Tool
    
    【Main Purpose】Query card information in dashboard with flexible querying and field filtering
    
    【Typical Scenarios】
    ✓ Quick browse: Don't specify card_ids and fields to get basic info of all cards
    ✓ View card configuration: Specify card_ids to get complete config of specific cards
    ✓ Field filtering: Use fields parameter to return only needed fields (e.g. only id, type, layout)
    ✓ Copy card configuration: Get config for creating similar cards
    ✓ Debug cards: Check getCardData function code
    
    【Parameters】
    - project_path: Required, dashboard project path
    - card_ids: Optional, returns all cards if not provided, returns specified cards if provided (1-20 cards)
    - fields: Optional, returns all fields if not provided, returns only specified fields if provided
    
    【Return Information】
    - cards: Array of card information, returns corresponding fields based on fields parameter
    - not_found: List of card IDs not found (only when card_ids is specified)
    - total: Total number of cards (only when card_ids is not specified)
    
    【Supported Fields】
    - id: Card ID
    - type: Card type
    - title: Card title
    - source: Data source
    - layout: Layout information (x, y, w, h)
    - titleAlign: Title alignment
    - getCardData: getCardData function code
    
    【Core Features】
    - Flexible query: Supports querying all or specific cards
    - Field filtering: Return fields on demand to reduce data size
    - Batch operation: Supports batch query (1-20 cards)
    - Read-only operation: Does not modify data
    
    【Usage Recommendations】
    - Don't specify card_ids and fields for quick browsing
    - Specify card_ids when detailed information is needed
    - Use fields to filter when specific fields are needed
    """
    
    async def execute(self, tool_context: ToolContext, params: QueryDashboardCardsParams) -> ToolResult:
        """执行查询卡片操作
        
        Args:
            tool_context: 工具上下文
            params: 查询参数
            
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
            
            # 2. 解析卡片
            try:
                cards, _ = parse_data_js(data_js_path)
            except CardParseError as e:
                return ToolResult(
                    error=i18n.translate("dashboard_cards.parse_error", category="tool.messages", error=str(e))
                )
            
            # 3. 根据card_ids过滤卡片
            if params.card_ids is not None:
                # 查询指定ID的卡片
                cards_dict = {card['id']: card for card in cards}
                
                found_cards = []
                not_found_ids = []
                
                for card_id in params.card_ids:
                    if card_id in cards_dict:
                        found_cards.append(cards_dict[card_id])
                    else:
                        not_found_ids.append(card_id)
                
                cards = found_cards
            else:
                # 返回所有卡片
                not_found_ids = None
            
            # 4. 根据fields过滤字段
            filtered_cards = []
            for card in cards:
                if params.fields is not None:
                    # 只返回指定字段
                    card_info = {}
                    for field in params.fields:
                        if field in card:
                            card_info[field] = card[field]
                    filtered_cards.append(card_info)
                else:
                    # 返回所有字段
                    card_info = {
                        'id': card['id'],
                        'type': card['type'],
                        'source': card['source'],
                        'layout': card['layout']
                    }
                    
                    # 可选字段
                    if 'title' in card:
                        card_info['title'] = card['title']
                    if 'titleAlign' in card:
                        card_info['titleAlign'] = card['titleAlign']
                    if 'getCardData' in card:
                        card_info['getCardData'] = card['getCardData']
                    
                    filtered_cards.append(card_info)
            
            # 5. 构建结果
            result_data = {
                'cards': filtered_cards
            }
            
            # 根据是否指定card_ids，添加不同的额外信息
            if params.card_ids is not None:
                result_data['not_found'] = not_found_ids
            else:
                result_data['total'] = len(filtered_cards)
            
            return ToolResult(
                content=json.dumps(result_data, ensure_ascii=False, indent=2),
                extra_info=result_data
            )
            
        except Exception as e:
            logger.error(f"Failed to query dashboard cards: {e}", exc_info=True)
            return ToolResult(
                error=i18n.translate("query_dashboard_cards.error", category="tool.messages", error=str(e))
            )

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        """获取备注内容"""
        if result.extra_info:
            found_count = len(result.extra_info.get('cards', []))
            return i18n.translate("query_dashboard_cards.success", category="tool.messages", count=found_count)
        return i18n.translate("query_dashboard_cards.success", category="tool.messages", count=0)
