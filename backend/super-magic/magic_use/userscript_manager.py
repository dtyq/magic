# magic_use/userscript_manager.py
import asyncio
import fnmatch # 引入 fnmatch 用于 URL 模式匹配
import re # 引入 re 模块
from pathlib import Path
from typing import List, Optional, Dict, Any # 引入 Dict, Any

import aiofiles # 用于异步文件读取
from agentlang.logger import get_logger
from magic_use.userscript import Userscript

logger = get_logger(__name__)

# Define the path to the magic_monkey directory relative to this file
MAGIC_MONKEY_DIR = Path(__file__).resolve().parent / "magic_monkey"

class UserscriptManager:
    """
    管理油猴脚本 (Userscripts) 的加载、解析、缓存和匹配。

    采用模块级单例模式。
    """
    _instance: Optional['UserscriptManager'] = None
    _lock = asyncio.Lock()  # 类锁，用于保护单例实例化过程

    # 正则表达式用于解析 Userscript 元数据块
    _METADATA_BLOCK_RE = re.compile(r"// ==UserScript==\s*(.*?)\s*// ==/UserScript==", re.DOTALL)
    _METADATA_LINE_RE = re.compile(r"// @(\S+)\s+(.*)")

    def __init__(self, userscript_dir: Path):
        """
        私有构造函数。

        Args:
            userscript_dir: 存放油猴脚本 .js 文件的目录。
        """
        if not userscript_dir.exists() or not userscript_dir.is_dir():
            logger.warning(f"油猴脚本目录不存在或不是一个目录: {userscript_dir}, 将不会加载任何脚本。")
            # 允许目录不存在，只是不加载脚本
            self._userscript_dir = None # 标记目录无效
        else:
            self._userscript_dir = userscript_dir
        self._scripts: List[Userscript] = [] # 缓存解析后的脚本
        self._load_lock = asyncio.Lock() # 用于保护加载过程的异步锁
        self._initialized = False # 添加初始化标记

    @classmethod
    async def get_instance(cls) -> 'UserscriptManager':
        """
        获取 UserscriptManager 的单例实例。

        如果实例不存在，则异步创建它。
        使用类锁确保线程/任务安全。
        """
        if cls._instance is None:
            async with cls._lock:
                # 双重检查锁定，防止多个协程同时创建实例
                if cls._instance is None:
                    # 假设 MAGIC_MONKEY_DIR 是在 app.paths 中定义的 Path 对象
                    instance = cls(MAGIC_MONKEY_DIR)
                    # 在实例创建后立即开始加载脚本
                    # 注意：这里不在构造函数或 get_instance 中直接 await load_scripts
                    # 而是让调用者决定何时加载，或者在 PageRegistry 初始化时加载
                    cls._instance = instance
        return cls._instance

    async def _parse_script_file(self, file_path: Path) -> Optional[Userscript]:
        """
        解析单个油猴脚本文件。

        Args:
            file_path: .js 文件的路径。

        Returns:
            如果解析成功，返回 Userscript 对象，否则返回 None。
        """
        try:
            async with aiofiles.open(file_path, mode='r', encoding='utf-8') as f:
                content = await f.read()

            metadata_match = self._METADATA_BLOCK_RE.search(content)
            if not metadata_match:
                logger.warning(f"脚本文件缺少元数据块: {file_path}")
                return None

            metadata_content = metadata_match.group(1)
            metadata: Dict[str, Any] = {
                "match_patterns": [],
                "exclude_patterns": [],
                "run_at": "document-end" # 默认值
            }
            has_name = False

            for line in metadata_content.strip().splitlines():
                line = line.strip()
                match = self._METADATA_LINE_RE.match(line)
                if match:
                    key, value = match.groups()
                    key = key.lower() # 统一小写处理
                    value = value.strip()

                    if key == "match":
                        metadata["match_patterns"].append(value)
                    elif key == "exclude":
                        metadata["exclude_patterns"].append(value)
                    elif key == "name":
                        metadata[key] = value
                        has_name = True
                    elif key in ["version", "description", "run-at"]:
                        # 只记录第一个出现的 tag (对于非列表类型)
                        if key not in metadata or key in ["run-at"]: # run-at 以最后一个为准
                             metadata[key] = value
                    # 可以根据需要添加对其他元数据标签（如 @grant, @require）的处理
                    else:
                        logger.debug(f"在 {file_path} 中发现未处理的元数据标签: @{key}")

            if not has_name:
                logger.warning(f"脚本文件缺少必需的 @name 标签: {file_path}")
                return None

            # 提取脚本主体内容 (元数据块之后的所有内容)
            script_body = content[metadata_match.end():].strip()
            if not script_body:
                 logger.warning(f"脚本文件缺少实际执行内容: {file_path}")
                 # 允许没有脚本体？或者返回None？暂时允许。
                 # return None

            return Userscript(
                name=metadata.get("name"),
                file_path=file_path,
                content=script_body,
                version=metadata.get("version"),
                description=metadata.get("description"),
                match_patterns=metadata.get("match_patterns", []),
                exclude_patterns=metadata.get("exclude_patterns", []),
                run_at=metadata.get("run_at", "document-end"),
            )

        except OSError as e:
            logger.error(f"读取脚本文件失败: {file_path}, Error: {e}")
            return None
        except ValueError as e: # Userscript 的 __post_init__ 可能抛出 ValueError
            logger.error(f"创建 Userscript 对象失败 ({file_path}): {e}")
            return None
        except Exception as e:
            logger.error(f"解析脚本文件时发生意外错误: {file_path}, Error: {e}")
            return None

    async def load_scripts(self):
        """
        异步扫描脚本目录，解析所有 .js 文件并缓存结果。

        使用锁确保同一时间只有一个加载操作在进行。
        """
        # 如果目录无效，直接返回
        if self._userscript_dir is None:
            logger.info("油猴脚本目录无效，跳过脚本加载。")
            self._initialized = True # 标记为已初始化（即使没有加载）
            return

        # 防止重复初始化或并发加载
        async with self._load_lock:
            if self._initialized:
                logger.debug("Userscripts 已经加载过，跳过。")
                return

            logger.info(f"开始从 {self._userscript_dir} 加载油猴脚本...")
            loaded_scripts: List[Userscript] = []
            tasks = []

            # 使用 pathlib 的 rglob 查找所有 .js 文件
            try:
                 script_files = [f for f in self._userscript_dir.rglob("*.js") if f.is_file()]
            except Exception as e:
                 logger.error(f"扫描油猴脚本目录失败: {self._userscript_dir}, Error: {e}")
                 script_files = [] # 出错则不加载

            for file_path in script_files:
                 # 为每个文件创建一个解析任务
                 tasks.append(asyncio.create_task(self._parse_script_file(file_path)))

            if tasks:
                 results = await asyncio.gather(*tasks)
                 for script in results:
                     if script:
                         loaded_scripts.append(script)
                 logger.info(f"成功加载 {len(loaded_scripts)} 个油猴脚本。")
            else:
                 logger.info("在指定目录中未找到油猴脚本文件。")


            self._scripts = loaded_scripts # 更新缓存
            self._initialized = True # 标记初始化完成

    async def reload_scripts(self):
         """强制重新加载所有脚本"""
         async with self._load_lock: # 获取锁
             self._initialized = False # 重置初始化标记
             self._scripts.clear() # 清空缓存
             logger.info("强制重新加载油猴脚本...")
         await self.load_scripts() # 重新加载

    def get_matching_scripts(self, url: str, run_at: str = "document-end") -> List[Userscript]:
        """
        根据 URL 和注入时机查找匹配的油猴脚本。

        Args:
            url: 当前页面的 URL。
            run_at: 期望的脚本注入时机 (如 "document-end", "document-start")。

        Returns:
            匹配的 Userscript 对象列表。
        """
        if not self._initialized:
            logger.warning("Userscript manager 尚未初始化，无法获取匹配脚本。请先调用 load_scripts()")
            # 或者可以在这里触发一次加载？取决于设计决策
            # await self.load_scripts() # 如果需要自动加载
            return []

        if not url: # 如果 URL 为空或 None，不进行匹配
            return []

        matching_scripts: List[Userscript] = []
        for script in self._scripts:
            # 1. 检查注入时机是否匹配
            if script.run_at != run_at:
                continue

            # 2. 检查 URL 是否匹配 @match 规则
            is_matched = False
            if not script.match_patterns: # 如果没有 @match 规则，默认不匹配任何页面
                logger.debug(f"脚本 '{script.name}' 没有 @match 规则，跳过 URL: {url}")
                continue
            for pattern in script.match_patterns:
                # 使用 fnmatch 进行简单的通配符匹配
                # 注意：这可能无法完全覆盖 Tampermonkey 的所有复杂匹配规则
                # 但能处理常见的 * 通配符
                if fnmatch.fnmatch(url, pattern):
                    is_matched = True
                    break # 匹配到任何一个 @match 即可

            if not is_matched:
                continue # 如果没有匹配任何 @match 规则，则跳过此脚本

            # 3. 检查 URL 是否匹配 @exclude 规则
            is_excluded = False
            for pattern in script.exclude_patterns:
                if fnmatch.fnmatch(url, pattern):
                    is_excluded = True
                    break # 匹配到任何一个 @exclude 即可排除

            if is_excluded:
                continue # 如果匹配了排除规则，则跳过此脚本

            # 4. 如果通过所有检查，则添加到结果列表
            matching_scripts.append(script)
            logger.debug(f"URL '{url}' 匹配脚本 '{script.name}' (run_at={run_at})")

        return matching_scripts

# 可以选择在这里创建单例实例，如果不需要异步获取的话
# 但异步获取提供了更好的灵活性，特别是如果初始化涉及异步操作
# _userscript_manager_instance = UserscriptManager(MAGIC_MONKEY_DIR)
# def get_userscript_manager():
#     return _userscript_manager_instance
