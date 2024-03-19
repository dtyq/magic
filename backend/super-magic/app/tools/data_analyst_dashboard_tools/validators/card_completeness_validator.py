"""卡片完成度验证器"""

import re
from pathlib import Path
from typing import Dict, List
from agentlang.logger import get_logger
from agentlang.utils.file import safe_delete

logger = get_logger(__name__)


class CardCompletenessValidator:
    """卡片完成度验证器
    
    职责：验证 data.js 中的卡片是否与 cards_todo.md 中的规划一致
    """
    
    async def validate(self, project_dir: Path) -> None:
        """验证卡片完成度，对比data.js与cards_todo.md的卡片内容
        
        验证逻辑：
        1. 如果cards_todo.md文件不存在，跳过验证
        2. 使用正则匹配提取卡片信息
        3. 比对规划卡片与已实现卡片
        
        Args:
            project_dir: 项目目录路径
            
        Raises:
            ValueError: 当存在未开发的卡片时抛出异常
        """
        cards_todo_path = project_dir / "cards_todo.md"
        data_js_path = project_dir / "data.js"
        
        # 如果cards_todo.md文件不存在，跳过验证
        if not cards_todo_path.exists():
            logger.info("cards_todo.md文件不存在，跳过卡片完成度验证")
            return
        
        # 如果data.js文件不存在，抛出错误
        if not data_js_path.exists():
            raise ValueError("data.js file does not exist, cannot validate card completeness")
        
        try:
            # 读取文件内容
            with open(cards_todo_path, 'r', encoding='utf-8') as f:
                todo_content = f.read()
            with open(data_js_path, 'r', encoding='utf-8') as f:
                data_js_content = f.read()
            
            # 简化的卡片解析
            planned_cards = self._extract_planned_cards(todo_content)
            implemented_card_ids = self._extract_implemented_cards(data_js_content)
            
            # 如果无法解析到规划卡片，跳过验证
            if not planned_cards:
                logger.info("cards_todo.md文件中未找到有效的卡片规划，跳过验证")
                return
            
            # 检查未实现的卡片
            missing_cards = self._find_missing_cards(planned_cards, implemented_card_ids)
            
            if missing_cards:
                missing_list = '\n  - '.join([''] + missing_cards)
                error_message = f"Card completeness validation failed. Missing cards:{missing_list}"
                raise ValueError(error_message)
            
            logger.info(f"卡片完成度验证通过：规划了 {len(planned_cards)} 个卡片，全部已实现")
            
            # 验证成功后删除cards_todo.md文件
            try:
                await safe_delete(cards_todo_path)
                logger.info("已删除cards_todo.md文件")
            except Exception as delete_error:
                logger.warning(f"删除cards_todo.md文件失败，但不影响验证结果: {delete_error}")
            
        except Exception as e:
            if isinstance(e, ValueError):
                raise
            else:
                logger.error(f"卡片完成度验证过程失败: {e}", exc_info=True)
                raise ValueError(f"Failed to validate card completeness: {str(e)}")

    def _extract_planned_cards(self, todo_content: str) -> List[Dict[str, str]]:
        """从cards_todo.md中提取规划的卡片信息
        
        简化的解析逻辑，支持格式：
        - 卡片名称 [card_id] (类型) - 数据说明
        - 卡片名称 [card_id] (类型)
        - 卡片名称 (类型) - 数据说明
        - 卡片名称 (类型)
        
        Args:
            todo_content: cards_todo.md文件内容
            
        Returns:
            List[Dict[str, str]]: 卡片列表，包含name、type、card_id(可选)、description(可选)
        """
        cards = []
        valid_types = ['metric', 'kpi', 'table', 'markdown', 'echarts']
        
        # 匹配四种格式的卡片规划
        patterns = [
            r'^\s*-\s*([^[]+?)\s*\[([^\]]+)\]\s*\(([^)]+)\)\s*-\s*(.+)',  # 带ID和数据说明格式
            r'^\s*-\s*([^[]+?)\s*\[([^\]]+)\]\s*\(([^)]+)\)',  # 带ID格式
            r'^\s*-\s*(?!\s*\[[ x]\])([^(]+?)\s*\(([^)]+)\)\s*-\s*(.+)',   # 不带ID但有数据说明格式
            r'^\s*-\s*(?!\s*\[[ x]\])([^(]+?)\s*\(([^)]+)\)'   # 不带ID格式
        ]
        
        for line in todo_content.split('\n'):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
                
            for i, pattern in enumerate(patterns):
                match = re.match(pattern, line)
                if match:
                    if i == 0:  # 带ID和数据说明格式
                        name, card_id, card_type, description = match.groups()
                        card_info = {
                            'name': name.strip(), 
                            'type': card_type.strip().lower(), 
                            'card_id': card_id.strip(),
                            'description': description.strip()
                        }
                    elif i == 1:  # 带ID格式
                        name, card_id, card_type = match.groups()
                        card_info = {
                            'name': name.strip(), 
                            'type': card_type.strip().lower(), 
                            'card_id': card_id.strip()
                        }
                    elif i == 2:  # 不带ID但有数据说明格式
                        name, card_type, description = match.groups()
                        card_info = {
                            'name': name.strip(), 
                            'type': card_type.strip().lower(),
                            'description': description.strip()
                        }
                    else:  # 不带ID格式
                        name, card_type = match.groups()
                        card_info = {
                            'name': name.strip(), 
                            'type': card_type.strip().lower()
                        }
                    
                    if card_info['type'] in valid_types:
                        cards.append(card_info)
                    break
        
        return cards

    def _extract_implemented_cards(self, data_js_content: str) -> List[str]:
        """从data.js中提取已实现的卡片ID列表
        
        解析逻辑，只提取卡片ID
        
        Args:
            data_js_content: data.js文件内容
            
        Returns:
            List[str]: 已实现的卡片ID列表
        """
        # 使用正则匹配提取所有卡片的id
        # 匹配格式：id: "card_id" 或 id: 'card_id'
        id_pattern = r'id:\s*["\']([^"\']+)["\']'
        
        # 找到所有id并返回去重后的列表
        id_matches = re.findall(id_pattern, data_js_content)
        
        # 去重并返回
        return list(set(id_matches))
    
    def _find_missing_cards(self, planned_cards: List[Dict[str, str]], implemented_card_ids: List[str]) -> List[str]:
        """查找未实现的卡片
        
        Args:
            planned_cards: 规划的卡片列表
            implemented_card_ids: 已实现的卡片ID列表
            
        Returns:
            List[str]: 未实现的卡片描述列表
        """
        missing_cards = []
        
        for planned_card in planned_cards:
            card_name = planned_card['name']
            card_type = planned_card['type']
            card_id = planned_card.get('card_id')
            description = planned_card.get('description')
            
            # 只有当规划卡片有card_id时才进行验证
            if card_id:
                # 检查卡片ID是否已实现
                if card_id not in implemented_card_ids:
                    # 构建卡片描述，包含数据说明（如果有的话）
                    card_desc = f"'{card_name}' [id: {card_id}] ({card_type})"
                    if description:
                        card_desc += f" - {description}"
                    missing_cards.append(card_desc)
            else:
                # 没有卡片ID的规划卡片跳过验证（因为无法准确匹配）
                logger.warning(f"跳过验证卡片 '{card_name}' ({card_type})：缺少card_id，无法进行准确匹配")
        
        return missing_cards
    def _extract_planned_cards(self, todo_content: str) -> List[Dict[str, str]]:
        """从cards_todo.md中提取规划的卡片信息
        
        简化的解析逻辑，支持格式：
        - 卡片名称 [card_id] (类型) - 数据说明
        - 卡片名称 [card_id] (类型)
        - 卡片名称 (类型) - 数据说明
        - 卡片名称 (类型)
        
        Args:
            todo_content: cards_todo.md文件内容
            
        Returns:
            List[Dict[str, str]]: 卡片列表，包含name、type、card_id(可选)、description(可选)
        """
        cards = []
        valid_types = ['metric', 'kpi', 'table', 'markdown', 'echarts']
        
        # 匹配四种格式的卡片规划
        patterns = [
            r'^\s*-\s*([^[]+?)\s*\[([^\]]+)\]\s*\(([^)]+)\)\s*-\s*(.+)',  # 带ID和数据说明格式
            r'^\s*-\s*([^[]+?)\s*\[([^\]]+)\]\s*\(([^)]+)\)',  # 带ID格式
            r'^\s*-\s*(?!\s*\[[ x]\])([^(]+?)\s*\(([^)]+)\)\s*-\s*(.+)',   # 不带ID但有数据说明格式
            r'^\s*-\s*(?!\s*\[[ x]\])([^(]+?)\s*\(([^)]+)\)'   # 不带ID格式
        ]
        
        for line in todo_content.split('\n'):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
                
            for i, pattern in enumerate(patterns):
                match = re.match(pattern, line)
                if match:
                    if i == 0:  # 带ID和数据说明格式
                        name, card_id, card_type, description = match.groups()
                        card_info = {
                            'name': name.strip(), 
                            'type': card_type.strip().lower(), 
                            'card_id': card_id.strip(),
                            'description': description.strip()
                        }
                    elif i == 1:  # 带ID格式
                        name, card_id, card_type = match.groups()
                        card_info = {
                            'name': name.strip(), 
                            'type': card_type.strip().lower(), 
                            'card_id': card_id.strip()
                        }
                    elif i == 2:  # 不带ID但有数据说明格式
                        name, card_type, description = match.groups()
                        card_info = {
                            'name': name.strip(), 
                            'type': card_type.strip().lower(),
                            'description': description.strip()
                        }
                    else:  # 不带ID格式
                        name, card_type = match.groups()
                        card_info = {
                            'name': name.strip(), 
                            'type': card_type.strip().lower()
                        }
                    
                    if card_info['type'] in valid_types:
                        cards.append(card_info)
                    break
        
        return cards
    def _extract_implemented_cards(self, data_js_content: str) -> List[str]:
        """从data.js中提取已实现的卡片ID列表
        
        解析逻辑，只提取卡片ID
        
        Args:
            data_js_content: data.js文件内容
            
        Returns:
            List[str]: 已实现的卡片ID列表
        """
        # 使用正则匹配提取所有卡片的id
        # 匹配格式：id: "card_id" 或 id: 'card_id'
        id_pattern = r'id:\s*["\']([^"\']+)["\']'
        
        # 找到所有id并返回去重后的列表
        id_matches = re.findall(id_pattern, data_js_content)
        
        # 去重并返回
        return list(set(id_matches))
    
    def _find_missing_cards(self, planned_cards: List[Dict[str, str]], implemented_card_ids: List[str]) -> List[str]:
        """查找未实现的卡片
        
        Args:
            planned_cards: 规划的卡片列表
            implemented_card_ids: 已实现的卡片ID列表
            
        Returns:
            List[str]: 未实现的卡片描述列表
        """
        missing_cards = []
        
        for planned_card in planned_cards:
            card_name = planned_card['name']
            card_type = planned_card['type']
            card_id = planned_card.get('card_id')
            description = planned_card.get('description')
            
            # 只有当规划卡片有card_id时才进行验证
            if card_id:
                # 检查卡片ID是否已实现
                if card_id not in implemented_card_ids:
                    # 构建卡片描述，包含数据说明（如果有的话）
                    card_desc = f"'{card_name}' [id: {card_id}] ({card_type})"
                    if description:
                        card_desc += f" - {description}"
                    missing_cards.append(card_desc)
            else:
                # 没有卡片ID的规划卡片跳过验证（因为无法准确匹配）
                logger.warning(f"跳过验证卡片 '{card_name}' ({card_type})：缺少card_id，无法进行准确匹配")
        
        return missing_cards


