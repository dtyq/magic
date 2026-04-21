"""magic.project.js 验证器"""

import re
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from agentlang.logger import get_logger
from app.utils.async_file_utils import async_read_text, async_write_text

logger = get_logger(__name__)


class MagicProjectValidator:
    """magic.project.js 验证器
    
    职责：
    1. 验证并修复 magic.project.js 文件的格式和内容
    2. 更新 magic.project.js 中的 geo 和 dataSources 配置
    3. 设置 dashboard 就绪状态
    """
    
    def validate_and_repair(self, magic_project_path: Path) -> bool:
        """校验 magic.project.js 内容，若不通过则尝试按模板恢复

        校验标准参考 app/tools/data_analyst_dashboard_template/magic.project.js：
        - 存在 window.magicProjectConfig = {...}; 的对象赋值
        - 对象内包含 version、type、name、dataSources、geo 字段
        - dataSources 与 geo 为数组
        - 存在 window.magicProjectConfigure(window.magicProjectConfig);
        
        Args:
            magic_project_path: magic.project.js 文件路径
            
        Returns:
            bool: 是否验证通过或修复成功
        """
        try:
            with open(magic_project_path, 'r', encoding='utf-8') as f:
                content = f.read()

            if self._is_valid(content):
                return True

            logger.warning("magic.project.js 校验不通过，尝试自动修复为模板格式")
            repaired = self._try_repair(magic_project_path, original_content=content)
            if not repaired:
                return False

            with open(magic_project_path, 'r', encoding='utf-8') as f:
                repaired_content = f.read()
            return self._is_valid(repaired_content)
        except Exception:
            logger.exception("校验或修复 magic.project.js 过程中发生异常")
            return False

    def _is_valid(self, content: str) -> bool:
        """判断 magic.project.js 是否满足模板校验标准"""
        try:
            # 是否存在 window.magicProjectConfig 对象赋值
            assign_match = re.search(r'window\.magicProjectConfig\s*=\s*\{([\s\S]*?)\}\s*;', content)
            if not assign_match:
                return False

            obj_block = assign_match.group(1)

            # 必要字段
            required_keys = ["version", "type", "name", "dataSources", "geo"]
            for key in required_keys:
                # 允许 key 带或不带引号
                key_pattern = rf'["\']?{re.escape(key)}["\']?\s*:'
                if not re.search(key_pattern, obj_block):
                    return False

            # dataSources/geo 为数组
            if not re.search(r'["\']?dataSources["\']?\s*:\s*\[', obj_block):
                return False
            if not re.search(r'["\']?geo["\']?\s*:\s*\[', obj_block):
                return False

            # 是否存在配置调用
            if not re.search(r'window\.magicProjectConfigure\(\s*window\.magicProjectConfig\s*\)\s*;', content):
                return False

            return True
        except Exception:
            return False

    def _try_repair(self, magic_project_path: Path, original_content: Optional[str] = None) -> bool:
        """尝试基于模板修复 magic.project.js

        策略：
        - 读取模板内容
        - 尽力从原文件提取 dataSources、geo 的数组项，并回填到模板
        - 写回到项目 magic.project.js
        
        Args:
            magic_project_path: magic.project.js 文件路径
            original_content: 原始文件内容（可选）
            
        Returns:
            bool: 是否修复成功
        """
        try:
            if original_content is None:
                with open(magic_project_path, 'r', encoding='utf-8') as f:
                    original_content = f.read()

            template_path = Path(__file__).parent.parent.parent / "data_analyst_dashboard_template" / "magic.project.js"
            if not template_path.exists():
                logger.error(f"模板文件不存在: {template_path}")
                return False

            with open(template_path, 'r', encoding='utf-8') as f:
                template_content = f.read()

            # 尽力提取原文件的 dataSources、geo 数组内容
            cleaned_data_inner = self._extract_array_inner(original_content, 'dataSources') or ''
            geo_inner = self._extract_array_inner(original_content, 'geo') or ''

            repaired_content = template_content

            # 回填 dataSources
            repaired_content = re.sub(
                r'(\"dataSources\":\s*)\[[^\]]*\]',
                rf'\1[{cleaned_data_inner}]',
                repaired_content
            )

            # 回填 geo
            repaired_content = re.sub(
                r'(\"geo\":\s*)\[[^\]]*\]',
                rf'\1[{geo_inner}]',
                repaired_content
            )

            with open(magic_project_path, 'w', encoding='utf-8') as f:
                f.write(repaired_content)


            return True
        except Exception:
            logger.exception("修复 magic.project.js 失败")
            return False

    def _extract_array_inner(self, content: str, key: str) -> Optional[str]:
        """提取 window.magicProjectConfig 对象中数组键的内部内容（不含方括号）"""
        try:
            assign_match = re.search(r'window\.magicProjectConfig\s*=\s*\{([\s\S]*?)\}\s*;', content)
            search_scope = assign_match.group(1) if assign_match else content
            pattern = rf'["\']?{re.escape(key)}["\']?\s*:\s*\[([\s\S]*?)\]'
            m = re.search(pattern, search_scope)
            if not m:
                return None
            return m.group(1).strip()
        except Exception:
            return None
    
    async def update_geo_config(self, magic_project_path: Path, geo_files: List[Dict[str, str]]) -> Tuple[int, int]:
        """增量更新magic.project.js中的geo配置
        
        Args:
            magic_project_path: magic.project.js 文件路径
            geo_files: 地图文件配置列表
            
        Returns:
            Tuple[int, int]: (新增配置数量, 跳过配置数量)
        """
        # 读取magic.project.js文件
        with open(magic_project_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 解析现有的配置
        existing_config = self._parse_geo_config(content)

        # 检查哪些配置需要添加
        new_items_to_add = []
        skipped_items = []

        for geo_file in geo_files:
            map_name = geo_file["name"]
            map_url = geo_file["url"]

            # 检查是否已存在（按name检查）
            if any(item["name"] == map_name for item in existing_config):
                skipped_items.append(geo_file)
            else:
                new_items_to_add.append(geo_file)

        # 如果没有新配置需要添加，直接返回
        if not new_items_to_add:
            return 0, len(skipped_items)

        # 合并配置：现有配置 + 新配置
        all_config = existing_config + new_items_to_add

        # 生成新的配置数组
        config_items = []
        for config_item in all_config:
            config_items.append(f'    {{ "name": "{config_item["name"]}", "url": "{config_item["url"]}" }}')

        new_config = "[\n" + ",\n".join(config_items) + "\n  ]"

        # 使用正则表达式查找并替换window.magicProjectConfig中的geo配置
        # 匹配 "geo": [...] 或 geo: [...] 模式（兼容带引号和不带引号）
        pattern = r'(window\.magicProjectConfig\s*=\s*\{.*?["\']?geo["\']?\s*:\s*)\[[^\]]*\]'
        replacement = f'\\1{new_config}'

        # 执行替换
        updated_content, count = re.subn(pattern, replacement, content, flags=re.DOTALL)

        if count == 0:
            raise ValueError("window.magicProjectConfig.geo configuration item not found")

        # 写入更新后的内容
        with open(magic_project_path, 'w', encoding='utf-8') as f:
            f.write(updated_content)

        return len(new_items_to_add), len(skipped_items)
    
    def _parse_geo_config(self, content: str) -> List[Dict[str, str]]:
        """解析现有的window.magicProjectConfig.geo配置"""
        # 匹配现有配置 - 在window.magicProjectConfig对象中的geo数组（兼容带引号和不带引号）
        pattern = r'window\.magicProjectConfig\s*=\s*\{.*?["\']?geo["\']?\s*:\s*\[(.*?)\]'
        match = re.search(pattern, content, re.DOTALL)

        if not match:
            return []

        config_content = match.group(1).strip()
        if not config_content:
            return []

        # 解析配置项
        existing_config = []

        # 匹配每个配置对象 { "name": "xxx", "url": "xxx" }
        item_pattern = r'\{\s*"name":\s*"([^"]+)"\s*,\s*"url":\s*"([^"]+)"\s*\}'
        items = re.findall(item_pattern, config_content)

        for name, url in items:
            existing_config.append({
                "name": name,
                "url": url
            })

        return existing_config
    
    async def update_data_source_config(self, magic_project_path: Path, data_source_items: List[Dict[str, str]]) -> int:
        """全量更新magic.project.js中的dataSources配置
        
        Args:
            magic_project_path: magic.project.js 文件路径
            data_source_items: 数据源配置列表
            
        Returns:
            int: 配置的数据源数量
        """
        # 读取magic.project.js文件
        with open(magic_project_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 生成新的配置数组
        if data_source_items:
            config_items = []
            for config_item in data_source_items:
                config_items.append(f'    {{ "name": "{config_item["name"]}", "url": "{config_item["url"]}" }}')
            new_config = "[\n" + ",\n".join(config_items) + "\n  ]"
        else:
            new_config = "[]"

        # 使用正则表达式查找并替换window.magicProjectConfig中的dataSources配置
        # 匹配 "dataSources": [...] 或 dataSources: [...] 模式（兼容带引号和不带引号）
        pattern = r'(window\.magicProjectConfig\s*=\s*\{.*?["\']?dataSources["\']?\s*:\s*)\[[^\]]*\]'
        replacement = f'\\1{new_config}'

        # 执行替换
        updated_content, count = re.subn(pattern, replacement, content, flags=re.DOTALL)

        if count == 0:
            logger.warning("window.magicProjectConfig.dataSources configuration item not found, skipping data source configuration")
            return 0
        
        # 写入更新后的内容
        with open(magic_project_path, 'w', encoding='utf-8') as f:
            f.write(updated_content)
        
        return len(data_source_items)
    
    async def set_dashboard_ready(self, index_html_path: Path) -> None:
        """设置dashboard为就绪状态
        
        Args:
            index_html_path: index.html文件路径
        """
        try:
            content = await async_read_text(index_html_path)
            updated_content, updated = self._replace_ready_flag(
                content=content,
                scope_pattern=r'window\.magicDashboard\s*=\s*\{',
            )
            if updated:
                await async_write_text(index_html_path, updated_content)

            magic_project_path = index_html_path.parent / "magic.project.js"
            if magic_project_path.exists():
                magic_project_content = await async_read_text(magic_project_path)
                updated_magic_project_content, magic_project_updated = self._replace_ready_flag(
                    content=magic_project_content,
                    scope_pattern=r'window\.magicProjectConfig\s*=\s*\{',
                )
                if magic_project_updated:
                    await async_write_text(magic_project_path, updated_magic_project_content)
            # 如果结构符合预期但缺少 ready 字段，会自动补写 ready: true

        except Exception as e:
            # 只有真正的异常才记录日志，已是 ready:true 的情况不会进到这里
            logger.warning(f"设置dashboard就绪状态时出现错误，但不阻塞执行: {e}")

    def _replace_ready_flag(self, content: str, scope_pattern: str) -> Tuple[str, bool]:
        """将目标对象中的 ready 更新为 true，不存在时自动插入。

        返回:
            Tuple[str, bool]: (更新后的内容, 是否发生变更)
        """
        ready_true_pattern = rf'{scope_pattern}.*?ready:\s*true'
        if re.search(ready_true_pattern, content, flags=re.DOTALL):
            return content, False

        ready_false_pattern = rf'({scope_pattern}.*?ready:\s*)false'
        updated_content, count = re.subn(
            ready_false_pattern,
            r'\1true',
            content,
            flags=re.DOTALL,
        )
        if count > 0:
            return updated_content, True

        scope_match = re.search(scope_pattern, content, flags=re.DOTALL)
        if not scope_match:
            return content, False

        following_content = content[scope_match.end():]
        indent_match = re.search(r'\n([ \t]+)\S', following_content)
        indent = indent_match.group(1) if indent_match else "  "
        inserted_content = (
            content[:scope_match.end()]
            + f"\n{indent}ready: true,"
            + content[scope_match.end():]
        )
        return inserted_content, True

