"""布局栅格验证器"""

import re
from pathlib import Path
from typing import Any, Dict, List, Optional
from agentlang.logger import get_logger

logger = get_logger(__name__)


class LayoutGridValidator:
    """布局栅格验证器
    
    职责：验证 dashboard 的布局栅格是否横向铺满
    """
    
    async def validate(self, project_dir: Path) -> None:
        """验证布局栅格横向是否铺满
        
        验证逻辑：
        1. 从config.js中读取GRID_COLS配置（栅格列数）
        2. 从data.js中解析所有卡片的layout信息
        3. 创建二维网格，标记每个卡片占据的区域（考虑立体布局）
        4. 检查每一行是否横向铺满
        5. 放宽规则：去掉全局空缺列检查；最后 2 行允许有空隙；或空缺列下方无卡片时允许
        
        Args:
            project_dir: 项目目录路径
            
        Raises:
            ValueError: 当存在未铺满的行时抛出异常
        """
        data_js_path = project_dir / "data.js"
        config_js_path = project_dir / "config.js"
        
        # 检查文件是否存在
        if not data_js_path.exists():
            raise ValueError("data.js file does not exist, cannot validate layout grid")
        
        if not config_js_path.exists():
            raise ValueError("config.js file does not exist, cannot validate layout grid")
        
        try:
            # 1. 读取GRID_COLS配置
            with open(config_js_path, 'r', encoding='utf-8') as f:
                config_content = f.read()
            
            grid_cols = self._extract_grid_cols(config_content)
            if grid_cols is None:
                logger.warning("无法从config.js中提取GRID_COLS配置，跳过布局栅格验证")
                return
            
            # 2. 读取并解析data.js中的卡片布局
            with open(data_js_path, 'r', encoding='utf-8') as f:
                data_js_content = f.read()
            
            cards_layout = self._extract_cards_layout(data_js_content)
            if not cards_layout:
                logger.warning("data.js中未找到有效的卡片布局，跳过布局栅格验证")
                return
            
            # 3. 按行分组并检查每行是否铺满
            unfilled_rows = self._check_rows_filled(cards_layout, grid_cols)
            
            if unfilled_rows:
                error_lines = []
                for row_info in unfilled_rows:
                    row_y = row_info['y']
                    unfilled_count = row_info['unfilled_count']
                    unfilled_ranges = row_info['unfilled_ranges']
                    card_ids = row_info['card_ids']
                    
                    ranges_str = ", ".join(unfilled_ranges)
                    error_lines.append(
                        f"Row y={row_y}: {unfilled_count} columns unfilled at {ranges_str}. "
                        f"Cards in this row: {', '.join(card_ids)}"
                    )
                
                error_message = (
                    f"Layout grid validation failed (GRID_COLS={grid_cols}). Found {len(unfilled_rows)} rows not fully filled:\n  - " +
                    "\n  - ".join(error_lines)
                )
                raise ValueError(error_message)
            
            logger.info(f"布局栅格验证通过：所有行均已横向铺满（GRID_COLS={grid_cols}）")
            
        except Exception as e:
            if isinstance(e, ValueError):
                raise
            else:
                logger.error(f"布局栅格验证过程失败: {e}", exc_info=True)
                raise ValueError(f"Failed to validate layout grid: {str(e)}")
    
    def _extract_grid_cols(self, config_content: str) -> Optional[int]:
        """从config.js中提取GRID_COLS配置
        
        Args:
            config_content: config.js文件内容
            
        Returns:
            Optional[int]: GRID_COLS的值，如果未找到则返回None
        """
        # 匹配 GRID_COLS: 数字 或 "GRID_COLS": 数字
        pattern = r'["\']?GRID_COLS["\']?\s*:\s*(\d+)'
        match = re.search(pattern, config_content)
        
        if match:
            return int(match.group(1))
        
        return None
    
    def _extract_cards_layout(self, data_js_content: str) -> List[Dict[str, Any]]:
        """从data.js中提取所有卡片的布局信息
        
        Args:
            data_js_content: data.js文件内容
            
        Returns:
            List[Dict[str, Any]]: 卡片布局列表，每项包含id、x、y、w、h
        """
        cards_layout = []
        
        # 匹配卡片对象，提取id和layout
        # 匹配格式：{ id: "card_id", ... layout: { x: 0, y: 0, w: 4, h: 3 } ... }
        card_pattern = r'\{\s*id:\s*["\']([^"\']+)["\'].*?layout:\s*\{\s*x:\s*(\d+)\s*,\s*y:\s*(\d+)\s*,\s*w:\s*(\d+)\s*,\s*h:\s*(\d+)\s*\}'
        
        matches = re.finditer(card_pattern, data_js_content, re.DOTALL)
        
        for match in matches:
            card_id = match.group(1)
            x = int(match.group(2))
            y = int(match.group(3))
            w = int(match.group(4))
            h = int(match.group(5))
            
            cards_layout.append({
                'id': card_id,
                'x': x,
                'y': y,
                'w': w,
                'h': h
            })
        
        return cards_layout
    
    def _check_rows_filled(self, cards_layout: List[Dict[str, Any]], grid_cols: int) -> List[Dict[str, Any]]:
        """检查每行是否横向铺满
        
        验证逻辑（已放宽）：
        1. 创建一个二维网格表示每个位置是否被卡片占据
        2. 遍历所有卡片，标记其占据的区域（从 [x, x+w) × [y, y+h)）
        3. 检查每一行是否所有列都被占据
        4. 放宽规则：最后 2 行允许有空隙；或空缺列下方无卡片时允许
        
        Args:
            cards_layout: 卡片布局列表
            grid_cols: 栅格列数
            
        Returns:
            List[Dict[str, Any]]: 未铺满的行信息列表
        """
        if not cards_layout:
            return []
        
        # 找出最大的 y 坐标（考虑卡片高度）
        max_y = max(card['y'] + card['h'] for card in cards_layout)
        
        # 创建二维网格
        grid = [[False] * grid_cols for _ in range(max_y)]
        
        # 标记每个卡片占据的区域
        for card in cards_layout:
            for y in range(card['y'], min(card['y'] + card['h'], max_y)):
                for x in range(card['x'], min(card['x'] + card['w'], grid_cols)):
                    grid[y][x] = True
        
        # 检查每一行是否铺满（放宽：去掉全局空缺列检查；最后 2 行允许有空隙）
        unfilled_rows = []
        for y in range(max_y):
            unfilled_cols = [x for x in range(grid_cols) if not grid[y][x]]
            
            if unfilled_cols:
                is_last_n_rows = y >= max_y - 2
                has_cards_below_unfilled = False
                for check_y in range(y + 1, max_y):
                    if any(grid[check_y][x] for x in unfilled_cols):
                        has_cards_below_unfilled = True
                        break
                if is_last_n_rows or not has_cards_below_unfilled:
                    continue
                
                # 找出这一行有哪些卡片
                cards_in_row = [card for card in cards_layout if card['y'] <= y < card['y'] + card['h']]
                
                # 找出连续的空缺区间
                ranges = self._get_unfilled_ranges(unfilled_cols)
                
                unfilled_rows.append({
                    'y': y,
                    'unfilled_count': len(unfilled_cols),
                    'unfilled_ranges': ranges,
                    'card_ids': [card['id'] for card in cards_in_row]
                })
        
        return unfilled_rows
    
    def _get_unfilled_ranges(self, unfilled_cols: List[int]) -> List[str]:
        """将未填充的列转换为连续区间表示
        
        Args:
            unfilled_cols: 未填充的列索引列表
            
        Returns:
            List[str]: 区间字符串列表，如 ["[0, 4)", "[8, 12)"]
        """
        if not unfilled_cols:
            return []
        
        ranges = []
        start = unfilled_cols[0]
        end = start + 1
        
        for i in range(1, len(unfilled_cols)):
            if unfilled_cols[i] == end:
                # 连续的列，扩展区间
                end += 1
            else:
                # 不连续，保存当前区间并开始新区间
                ranges.append(f"[{start}, {end})")
                start = unfilled_cols[i]
                end = start + 1
        
        # 保存最后一个区间
        ranges.append(f"[{start}, {end})")
        
        return ranges

    async def _restore_config_js_from_template(self, project_dir: Path) -> None:
        """从模板恢复config.js文件
        
        Args:
            project_dir: 项目目录路径
            
        Raises:
            ValueError: 当模板文件不存在或恢复失败时抛出异常
        """
        try:
            # 获取模板文件路径
            template_path = Path(__file__).parent.parent.parent / "data_analyst_dashboard_template" / "config.js"
            if not template_path.exists():
                raise ValueError(f"Template file does not exist: {template_path}")
            
            # 目标文件路径
            target_config_path = project_dir / "config.js"
            
            # 读取模板内容
            with open(template_path, 'r', encoding='utf-8') as f:
                template_content = f.read()
            
            # 写入到目标文件
            with open(target_config_path, 'w', encoding='utf-8') as f:
                f.write(template_content)
                
            logger.info(f"已从模板恢复config.js文件: {template_path} -> {target_config_path}")
            
        except Exception as e:
            logger.error(f"从模板恢复config.js文件失败: {e}", exc_info=True)
            raise ValueError(f"Failed to restore config.js file from template: {str(e)}")


