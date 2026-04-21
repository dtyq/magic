"""config.js 文件验证器"""

import re
from pathlib import Path
from agentlang.logger import get_logger

logger = get_logger(__name__)


class ConfigJsValidator:
    """config.js 文件验证器

    职责：验证 config.js 是否将仪表盘配置挂到 window.DASHBOARD_CONFIG（支持对象字面量或变量再导出）。
    """
    
    async def validate(self, project_dir: Path) -> None:
        """校验config.js文件内容

        校验要求：
        1. 必须存在 window.DASHBOARD_CONFIG 赋值，支持：
           - window.DASHBOARD_CONFIG = { ... };（对象字面量直接挂到 window，当前模板格式）
           - window.DASHBOARD_CONFIG = {};（空对象）
           - window.DASHBOARD_CONFIG = DASHBOARD_CONFIG;（须先有 const/let/var DASHBOARD_CONFIG = ...）
        2. 使用变量引用格式时，必须有 DASHBOARD_CONFIG 变量声明

        Args:
            project_dir: 项目目录路径

        Raises:
            ValueError: 当校验失败时抛出异常
        """
        config_js_path = project_dir / "config.js"

        if not config_js_path.exists():
            raise ValueError("config.js file does not exist")

        try:
            # 读取文件内容
            with open(config_js_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # const / let / var DASHBOARD_CONFIG = ...
            dashboard_config_pattern = r'(?:const|let|var)\s+DASHBOARD_CONFIG\s*='
            has_dashboard_config_declaration = re.search(dashboard_config_pattern, content)

            window_export_assign_var = re.search(
                r'window\.DASHBOARD_CONFIG\s*=\s*DASHBOARD_CONFIG\s*;',
                content,
            )
            # 对象字面量（含空对象 {}）：window.DASHBOARD_CONFIG = {
            window_export_object_literal = re.search(
                r'window\.DASHBOARD_CONFIG\s*=\s*\{',
                content,
            )

            if window_export_assign_var:
                if not has_dashboard_config_declaration:
                    raise ValueError(
                        "Missing DASHBOARD_CONFIG variable declaration. Please ensure config.js file contains a declaration like 'const DASHBOARD_CONFIG = {...}' before 'window.DASHBOARD_CONFIG = DASHBOARD_CONFIG;'"
                    )
            elif not window_export_object_literal:
                raise ValueError(
                    "Missing window.DASHBOARD_CONFIG assignment. Please ensure config.js contains e.g. "
                    "'window.DASHBOARD_CONFIG = { ... };' or 'window.DASHBOARD_CONFIG = DASHBOARD_CONFIG;' (with a prior const/let/var declaration)."
                )

            # 校验通过

        except Exception as e:
            if isinstance(e, ValueError):
                # 重新抛出校验错误
                raise
            else:
                # 处理文件读取等其他错误
                logger.error(f"读取config.js文件失败: {e}", exc_info=True)
                raise ValueError(f"Failed to read config.js file: {str(e)}")
    
    async def restore_from_template(self, project_dir: Path) -> None:
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

