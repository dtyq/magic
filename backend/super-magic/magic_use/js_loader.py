"""
JavaScript 加载管理模块

负责 JavaScript 代码的加载、依赖解析和执行，
为浏览器页面提供 JS 功能支持。
"""

import glob
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Set

from playwright.async_api import Page
from agentlang.logger import get_logger

# 设置日志
logger = get_logger(__name__)


class JSLoader:
    """JavaScript加载器，负责加载和管理JS代码"""

    def __init__(self, page: Page):
        """初始化JS加载器

        Args:
            page: Playwright页面对象
        """
        self.page = page
        self._js_code = {}    # 存储各模块代码
        self._js_dir = Path(__file__).parent / "js"  # JS文件目录路径
        self._loading_modules = set()  # 正在加载中的模块，用于检测循环依赖

        # 确保JS目录存在
        os.makedirs(self._js_dir, exist_ok=True)

    async def _parse_dependencies(self, js_code: str) -> List[str]:
        """从JS代码中解析依赖声明

        查找类似 // @depends: module1, module2 的注释

        Args:
            js_code: JavaScript代码

        Returns:
            依赖模块名列表
        """
        dependencies = []
        # 正则表达式匹配依赖声明注释
        pattern = r'//\s*@depends:\s*([\w\s,]+)'
        matches = re.search(pattern, js_code)

        if matches:
            # 解析并清理依赖名称
            deps_str = matches.group(1)
            for dep in deps_str.split(','):
                dep_name = dep.strip()
                if dep_name:
                    dependencies.append(dep_name)

        return dependencies

    async def load_module(self, module_name: str, force_reload: bool = False) -> bool:
        """加载JavaScript模块，默认情况下仅在模块不存在时加载
        支持自动加载依赖模块

        Args:
            module_name: 模块名称，对应js/目录下的文件名（不含.js扩展名）
            force_reload: 是否强制重新加载，即使模块已存在，默认为False

        Returns:
            bool: 模块是否成功加载
        """
        try:
            # 检测循环依赖
            if module_name in self._loading_modules:
                logger.error(f"检测到循环依赖: {module_name}")
                return False

            # 首先检查模块是否已经加载，除非要求强制重新加载
            if not force_reload:
                check_exists_script = f"""() => {{
                    return window.MagicUse && window.MagicUse['{module_name}'];
                }}"""

                module_exists = await self.page.evaluate(check_exists_script)

                if module_exists:
                    logger.debug(f"JavaScript模块 {module_name} 已存在，跳过加载")
                    return True

            # 从文件加载JavaScript代码
            js_path = self._js_dir / f"{module_name}.js"
            if not js_path.exists():
                logger.error(f"JavaScript模块文件不存在: {js_path}")
                raise FileNotFoundError(f"JavaScript模块文件不存在: {js_path}")

            js_code = js_path.read_text(encoding="utf-8")
            self._js_code[module_name] = js_code

            # 解析依赖
            dependencies = await self._parse_dependencies(js_code)
            if dependencies:
                logger.debug(f"模块 {module_name} 依赖: {dependencies}")

                # 标记当前模块为正在加载
                self._loading_modules.add(module_name)

                # 先加载依赖模块
                for dep in dependencies:
                    dep_loaded = await self.load_module(dep)
                    if not dep_loaded:
                        logger.error(f"加载依赖模块 {dep} 失败，无法继续加载 {module_name}")
                        self._loading_modules.remove(module_name)
                        return False

                # 依赖加载完成，移除正在加载标记
                self._loading_modules.remove(module_name)

            # 使用evaluate方法直接在页面中执行代码，绕过CSP限制
            load_script = f"""
            () => {{
                try {{
                    window.SuperMagic = window.SuperMagic || {{
                        'version': '0.0.1',
                    }};
                    window.MagicUse = window.MagicUse || {{}};
                    // 执行模块代码
                    (function() {{
                        {js_code}
                    }})();
                    window.MagicUse['{module_name}'] = true;
                    return true;
                }} catch (error) {{
                    console.error('执行模块代码出错:', error);
                    return {{
                        error: error.toString(),
                        stack: error.stack
                    }};
                }}
            }}
            """

            eval_result = await self.page.evaluate(load_script)

            # 检查结果
            if eval_result == True:
                logger.debug(f"JavaScript模块 {module_name} 已加载")
                return True
            else:
                logger.error(f"JavaScript模块 {module_name} 加载失败: {eval_result.get('error')}")
                raise Exception(f"加载失败: {eval_result.get('error')}")

        except Exception as e:
            logger.error(f"加载JavaScript模块 {module_name} 失败: {e}")
            if module_name in self._loading_modules:
                self._loading_modules.remove(module_name)
            raise

    async def scan_and_load_all_modules(self) -> Dict[str, bool]:
        """扫描js目录下的所有JS文件并加载它们

        Returns:
            加载结果字典，键为模块名，值为是否加载成功
        """
        results = {}

        try:
            # 扫描目录下的所有JS文件
            js_files = glob.glob(str(self._js_dir / "*.js"))

            for js_file in js_files:
                # 提取模块名（文件名去掉.js扩展名）
                module_name = Path(js_file).stem

                try:
                    # 加载模块
                    await self.load_module(module_name)
                    results[module_name] = True
                except Exception as e:
                    logger.error(f"自动加载模块 {module_name} 失败: {e}")
                    results[module_name] = False

            return results
        except Exception as e:
            logger.error(f"扫描和加载JS模块失败: {e}")
            return results
