"""data.js 文件验证器"""

import re
from pathlib import Path
from agentlang.logger import get_logger

logger = get_logger(__name__)


class DataJsValidator:
    """data.js 文件验证器
    
    职责：验证 data.js 文件的格式和内容是否符合规范
    """
    
    async def validate(self, project_dir: Path) -> None:
        """校验data.js文件内容

        校验要求：
        1. 必须存在 window.DASHBOARD_CARDS 导出语句，支持两种格式：
           - window.DASHBOARD_CARDS = DASHBOARD_CARDS; (需要同时有变量声明)
           - window.DASHBOARD_CARDS = []; (可以没有变量声明)
        2. 如果使用变量引用格式，必须有 DASHBOARD_CARDS 变量声明

        Args:
            project_dir: 项目目录路径

        Raises:
            ValueError: 当校验失败时抛出异常
        """
        data_js_path = project_dir / "data.js"

        if not data_js_path.exists():
            raise ValueError("data.js file does not exist")

        try:
            # 读取文件内容
            with open(data_js_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # 校验1: 检查DASHBOARD_CARDS变量声明
            # 匹配各种可能的声明方式：const, let, var
            dashboard_cards_pattern = r'(?:const|let|var)\s+DASHBOARD_CARDS\s*='
            has_dashboard_cards_declaration = re.search(dashboard_cards_pattern, content)
            
            # 校验2: 检查window.DASHBOARD_CARDS导出语句
            # 支持两种格式：
            # 1. window.DASHBOARD_CARDS = DASHBOARD_CARDS;
            # 2. window.DASHBOARD_CARDS = [];
            window_export_pattern_with_var = r'window\.DASHBOARD_CARDS\s*=\s*DASHBOARD_CARDS\s*;'
            window_export_pattern_with_array = r'window\.DASHBOARD_CARDS\s*=\s*\[\s*\]\s*;'
            has_window_export = re.search(window_export_pattern_with_var, content) or re.search(window_export_pattern_with_array, content)
            
            # 验证逻辑：
            # - 如果有 window.DASHBOARD_CARDS = DASHBOARD_CARDS; 必须有变量声明
            # - 如果只有 window.DASHBOARD_CARDS = []; 可以没有变量声明
            if re.search(window_export_pattern_with_var, content):
                # 使用变量引用的方式，必须有变量声明
                if not has_dashboard_cards_declaration:
                    raise ValueError("Missing DASHBOARD_CARDS variable declaration. Please ensure data.js file contains a declaration like 'const DASHBOARD_CARDS = [...]'")
            elif not has_window_export:
                # 没有任何window.DASHBOARD_CARDS导出语句
                raise ValueError("Missing window.DASHBOARD_CARDS export statement. Please ensure data.js file contains 'window.DASHBOARD_CARDS = DASHBOARD_CARDS;' or 'window.DASHBOARD_CARDS = [];' export statement")

            # 校验通过

        except Exception as e:
            if isinstance(e, ValueError):
                # 重新抛出校验错误
                raise
            else:
                # 处理文件读取等其他错误
                logger.error(f"读取data.js文件失败: {e}", exc_info=True)
                raise ValueError(f"Failed to read data.js file: {str(e)}")

