"""工具工厂模块

负责工具的自动发现、注册和创建

环境变量配置:
- AUTO_REGENERATE_TOOL_DEFINITIONS: 控制是否每次启动都重新生成预定义文件
  - true (默认): 每次启动都重新扫描和生成工具定义文件
  - false: 只在定义文件不存在时生成，存在则直接使用
  - 支持的值: true/false, 1/0, yes/no, on/off (不区分大小写)
"""

import importlib
import importlib.metadata
import inspect
import asyncio
import os
import pkgutil
import time
from typing import Dict, List, Type, TypeVar, Optional, get_origin, get_args
from dataclasses import dataclass

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.logger import get_logger
from agentlang.utils.annotation_remover import remove_developer_annotations
from app.tools.core import BaseTool
from app.tools.core.tool_definition import tool_definition_manager, ToolDefinition
from app.tools.remote.remote_tool_manager import remote_tool_manager

logger = get_logger(__name__)

# 工具类型变量
T = TypeVar('T', bound=BaseTool)


@dataclass
class ToolInfo:
    """工具信息类，存储工具的元数据和类型信息"""
    # 工具类（可能为None，用于延迟加载）
    tool_class: Optional[Type[BaseTool]]
    # 工具名称
    name: str
    # 工具描述
    description: str
    # 工具参数类型（可能为None）
    params_class: Optional[Type] = None
    # 错误信息（如果注册过程中发生错误）
    error: Optional[str] = None
    # 工具定义（用于延迟加载）
    definition: Optional['ToolDefinition'] = None
    # 是否为延迟加载模式
    lazy_load: bool = False
    # 是否仅允许 Code Mode 调用
    code_mode_only: bool = False

    def __post_init__(self):
        """验证创建的工具信息对象"""
        if not self.name:
            raise ValueError("工具名称不能为空")

    def is_valid(self) -> bool:
        """检查工具信息是否有效"""
        return self.error is None


class ToolFactory:
    """工具工厂

    负责扫描、注册和创建工具实例
    """
    _instance = None  # 单例模式实例

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ToolFactory, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self._tools: Dict[str, ToolInfo] = {}  # 工具信息字典：name -> ToolInfo对象
        self._tool_instances: Dict[str, BaseTool] = {}  # 工具实例缓存：name -> instance
        self._definitions_initialized = False
        self._definitions_init_lock: Optional[asyncio.Lock] = None
        self._initialized = True

    async def ensure_definitions_initialized(self) -> None:
        """工具定义初始化的唯一公开入口；幂等、防并发，失败时保留运行时扫描能力。"""
        if self._definitions_initialized:
            return

        if self._definitions_init_lock is None:
            self._definitions_init_lock = asyncio.Lock()

        async with self._definitions_init_lock:
            if self._definitions_initialized:
                return
            await self._initialize_definitions()

    async def _initialize_definitions(self) -> None:
        """初始化工具定义缓存；失败时回退到运行时工具扫描。"""
        auto_regenerate = os.getenv("AUTO_REGENERATE_TOOL_DEFINITIONS", "true").lower() in ("true", "1", "yes", "on")

        if auto_regenerate:
            logger.info("AUTO_REGENERATE_TOOL_DEFINITIONS=true，正在重新生成预定义文件...")
            self.initialize()

            if await self.generate_tool_definitions(force=True):
                logger.info("✓ 预定义文件重新生成完成")
                if not await self._load_from_prebuilt_definitions():
                    logger.error("预定义文件已生成但加载失败，继续使用运行时工具扫描")
            else:
                logger.error("预定义文件生成失败，继续使用运行时工具扫描")
            self._definitions_initialized = True
            return

        if await self._should_use_prebuilt_definitions():
            logger.info("AUTO_REGENERATE_TOOL_DEFINITIONS=false，使用现有预定义文件")
            if await self._load_from_prebuilt_definitions():
                self._definitions_initialized = True
                return
            logger.warning("现有预定义文件加载失败，尝试重新生成")

        self.initialize()
        if await self.generate_tool_definitions(force=True):
            logger.info("✓ 预定义文件生成完成")
            if not await self._load_from_prebuilt_definitions():
                logger.error("预定义文件已生成但加载失败，继续使用运行时工具扫描")
        else:
            logger.error("预定义文件生成失败，继续使用运行时工具扫描")

        self._definitions_initialized = True

    def register_tool(self, tool_class: Type[BaseTool]) -> None:
        """注册工具类

        Args:
            tool_class: 工具类
        """
        if not hasattr(tool_class, '_tool_name'):
            logger.warning(f"工具类 {tool_class.__name__} 未通过@tool装饰器装饰，跳过注册")
            return

        tool_name = tool_class._tool_name

        # 获取参数类
        params_class = getattr(tool_class, 'params_class', None) or getattr(tool_class, '_params_class', None)

        try:
            # 创建工具信息对象
            tool_info = ToolInfo(
                tool_class=tool_class,
                name=tool_name,
                description=tool_class._tool_description,
                params_class=params_class,
                code_mode_only=bool(getattr(tool_class, "code_mode_only", False)),
            )

            # 存储工具信息
            self._tools[tool_name] = tool_info

            # 标记为已注册
            tool_class._registered = True
            logger.debug(f"注册工具: {tool_name}")
        except Exception as e:
            logger.error(f"获取工具 {tool_name} 参数定义时出错: {e}")
            # 请求参数验证失败时，返回详细错误信息
            if hasattr(e, '__str__'):
                logger.error(f"详细错误: {e!s}")
            # 即使有错误也保留一个有效的工具记录，但标记为不可用
            self._tools[tool_name] = ToolInfo(
                tool_class=tool_class,
                name=tool_name,
                description=getattr(tool_class, '_tool_description', "无法获取描述"),
                params_class=None,
                error=str(e),
                code_mode_only=bool(getattr(tool_class, "code_mode_only", False)),
            )

    def register_tool_instance(self, tool_name: str, tool_instance: BaseTool) -> None:
        """注册工具实例（用于动态工具如 MCP 工具）

        Args:
            tool_name: 工具名称
            tool_instance: 工具实例
        """
        try:
            # 创建工具信息对象
            tool_info = ToolInfo(
                tool_class=tool_instance.__class__,
                name=tool_name,
                description=tool_instance.get_effective_description(),
                params_class=getattr(tool_instance, 'get_params_class', lambda: None)(),
                code_mode_only=bool(getattr(tool_instance, "code_mode_only", False)),
            )

            # 存储工具信息
            self._tools[tool_name] = tool_info

            # 缓存工具实例
            self._tool_instances[tool_name] = tool_instance

            logger.debug(f"注册工具实例: {tool_name}")
        except Exception as e:
            logger.error(f"注册工具实例 {tool_name} 时出错: {e}")
            raise ValueError(f"无法注册工具实例 {tool_name}: {e}")

    def unregister_tool(self, tool_name: str) -> None:
        """注销工具

        Args:
            tool_name: 工具名称
        """
        # 从工具信息中移除
        if tool_name in self._tools:
            del self._tools[tool_name]

        # 从实例缓存中移除
        if tool_name in self._tool_instances:
            del self._tool_instances[tool_name]

        logger.debug(f"注销工具: {tool_name}")

    async def _should_use_prebuilt_definitions(self) -> bool:
        # 自动生成关闭时，优先直接使用缓存；读不到或读坏时再生成。
        definition_file = tool_definition_manager.definition_file
        if await asyncio.to_thread(definition_file.exists):
            try:
                stats = await tool_definition_manager.get_stats()
                return stats.get('total_tools', 0) > 0
            except Exception:
                return False

        return False

    def _is_abstract_base_class(self, tool_class: Type) -> bool:
        """检测是否为抽象基类

        Args:
            tool_class: 工具类

        Returns:
            bool: 是否为抽象基类
        """
        # 检查1: 类名或文档字符串包含"基类"、"抽象"等关键词
        class_name = tool_class.__name__
        docstring = tool_class.__doc__ or ""

        if any(keyword in class_name.lower() for keyword in ["base", "abstract"]):
            logger.debug(f"根据类名识别为抽象基类: {class_name}")
            return True

        if any(keyword in docstring for keyword in ["基类", "抽象", "abstract", "base class"]):
            logger.debug(f"根据文档字符串识别为抽象基类: {class_name}")
            return True

        # 检查2: 是否使用了未绑定的泛型TypeVar
        if hasattr(tool_class, '__orig_bases__'):
            for base in tool_class.__orig_bases__:
                if hasattr(base, '__args__'):
                    args = get_args(base)
                    for arg in args:
                        # 检查是否是TypeVar
                        if isinstance(arg, TypeVar):
                            logger.debug(f"根据泛型TypeVar识别为抽象基类: {class_name} (TypeVar: {arg})")
                            return True

        # 检查3: 类名以Tool结尾但不是具体工具（通常是基类）
        if (class_name.endswith("Tool") and
            class_name != "BaseTool" and  # BaseTool本身不会被扫描到
            not class_name.endswith("sTool")):  # 避免误判复数形式的工具
            # 进一步检查是否有具体的工具名称
            if not hasattr(tool_class, 'name') or not tool_class.name:
                logger.debug(f"根据命名模式识别为抽象基类: {class_name}")
                return True

        return False

    async def _load_from_prebuilt_definitions(self) -> bool:
        """从预构建的工具定义文件加载工具信息"""
        start_time = time.time()

        try:
            # 从定义管理器加载所有定义
            definitions = await tool_definition_manager.get_all_definitions()
            if not definitions:
                logger.warning("预构建工具定义为空")
                return False

            # 将定义转换为 ToolInfo 对象
            for tool_name, definition in definitions.items():
                try:
                    # 创建一个轻量级的 ToolInfo 对象
                    # 注意：这里不实际导入工具类，只保存定义信息
                    tool_info = ToolInfo(
                        tool_class=None,  # 延迟加载，在需要时才导入
                        name=definition.name,
                        description=definition.description,
                        params_class=None,  # 从 schema 中获取
                        code_mode_only=definition.code_mode_only,
                    )

                    # 保存额外的元数据用于按需加载
                    tool_info.definition = definition  # 保存完整定义
                    tool_info.lazy_load = True  # 标记为延迟加载

                    self._tools[tool_name] = tool_info
                    logger.debug(f"加载工具定义: {tool_name}")

                except Exception as e:
                    logger.error(f"加载工具定义失败 {tool_name}: {e}")

            duration = time.time() - start_time
            logger.info(f"从预构建定义加载了 {len(self._tools)} 个工具，耗时 {duration:.3f}s")
            return True

        except Exception as e:
            logger.error(f"加载预构建工具定义时发生错误: {e}", exc_info=True)
            # 回退到正常模式
            self.initialize()
            return False

    def tool_exists(self, tool_name: str) -> bool:
        """检查工具是否存在，不加载工具类

        Args:
            tool_name: 工具名称

        Returns:
            bool: 工具是否存在
        """
        # 首先检查内置工具
        if tool_name in self._tools:
            return True

        if remote_tool_manager.is_remote_tool(tool_name):
            return True

        return False

    def get_tool_info_light(self, tool_name: str) -> Optional[ToolInfo]:
        """获取轻量级工具信息，不触发工具类加载

        Args:
            tool_name: 工具名称

        Returns:
            ToolInfo: 工具信息，如果不存在则返回None
        """
        if tool_name not in self._tools:
            return None
        return self._tools[tool_name]

    def check_tool_availability_light(self, tool_name: str) -> bool:
        """轻量级检查工具可用性，尽量不加载工具类

        对于预构建定义模式的工具，直接返回True（假设可用）
        只有在必要时才加载工具类进行真实检查

        Args:
            tool_name: 工具名称

        Returns:
            bool: 工具是否可用
        """
        if not self.tool_exists(tool_name):
            return False

        if remote_tool_manager.is_remote_tool(tool_name):
            # 远程工具假设可用，实际检查在执行时进行
            logger.debug(f"远程工具 {tool_name}，假设可用")
            return True

        # 对于内置工具，进行正常检查
        tool_info = self._tools[tool_name]

        # 如果是延迟加载模式，我们假设工具可用
        # 实际的可用性检查会在真正使用工具时进行
        if tool_info.lazy_load:
            logger.debug(f"延迟加载工具 {tool_name}，假设可用")
            return True

        # 对于已经加载的工具，检查其可用性
        if tool_info.tool_class:
            try:
                # 创建临时实例进行检查
                temp_instance = tool_info.tool_class()
                return temp_instance.is_available()
            except Exception as e:
                logger.debug(f"工具 {tool_name} 可用性检查失败: {e}")
                return False

        # 其他情况默认可用
        return True

    def get_tool_prompt_hint_light(self, tool_name: str) -> str:
        """轻量级获取工具提示，支持延迟加载模式

        对于延迟加载的工具，会按需加载工具类来获取提示信息
        这确保了Agent初始化时能够收集到完整的工具使用指导

        Args:
            tool_name: 工具名称

        Returns:
            str: 工具提示，如果工具不存在或无提示则返回空字符串
        """
        if not self.tool_exists(tool_name):
            logger.debug(f"工具 {tool_name} 不存在，返回空提示")
            return ""

        # 检查是否为远程工具
        if remote_tool_manager.is_remote_tool(tool_name):
            try:
                # 获取远程工具实例并获取提示
                remote_tool_instance = remote_tool_manager.get_remote_tool_instance(tool_name)
                hint = remote_tool_instance.get_prompt_hint()
                logger.debug(f"成功获取远程工具 {tool_name} 的提示信息")
                # 移除开发者注解
                if hint:
                    hint = remove_developer_annotations(hint)
                return hint
            except Exception as e:
                logger.debug(f"获取远程工具 {tool_name} 提示失败: {e}")
                return ""

        tool_info = self._tools[tool_name]

        # 如果是延迟加载模式，按需加载工具类来获取提示
        if tool_info.lazy_load:
            try:
                logger.debug(f"延迟加载工具 {tool_name}，按需获取提示")
                # 临时加载工具类获取提示（不会影响工具实例缓存）
                tool_class = self._lazy_load_tool_class(tool_name)
                temp_instance = tool_class()
                hint = temp_instance.get_prompt_hint()
                logger.debug(f"成功获取工具 {tool_name} 的提示信息")
                # 移除开发者注解
                if hint:
                    hint = remove_developer_annotations(hint)
                return hint
            except Exception as e:
                logger.debug(f"延迟加载获取工具 {tool_name} 提示失败: {e}")
                return ""

        # 对于已经加载的工具，获取其提示
        if tool_info.tool_class:
            try:
                temp_instance = tool_info.tool_class()
                hint = temp_instance.get_prompt_hint()
                # 移除开发者注解
                if hint:
                    hint = remove_developer_annotations(hint)
                return hint
            except Exception as e:
                logger.debug(f"获取工具 {tool_name} 提示失败: {e}")
                return ""

        return ""

    def get_tool_param_from_definition(self, tool_name: str) -> Optional[Dict]:
        """获取工具参数定义；优先使用缓存，缺失时回退到运行时实例。

        Args:
            tool_name: 工具名称

        Returns:
            Dict: LLM API 格式的工具参数，如果工具不存在或无参数定义则返回None
        """
        # 检查是否为远程工具
        if remote_tool_manager.is_remote_tool(tool_name):
            try:
                # 获取远程工具实例并生成参数
                remote_tool_instance = remote_tool_manager.get_remote_tool_instance(tool_name)
                tool_param = remote_tool_instance.to_param()
                logger.debug(f"从远程工具获取参数定义: {tool_name}")
                return tool_param
            except Exception as e:
                logger.warning(f"获取远程工具 {tool_name} 参数定义失败: {e}")
                return None

        if tool_name not in self._tools:
            logger.warning(f"工具不存在: {tool_name}")
            return None

        tool_info = self._tools[tool_name]

        # 优先使用预构建定义；没有缓存时使用运行时实例，保证缓存失败不影响服务可用性。
        if not tool_info.definition:
            try:
                tool_instance = self.get_tool_instance(tool_name)
                if getattr(tool_instance, "code_mode_only", False):
                    logger.debug(f"跳过 CodeModeOnly 工具参数: {tool_name}")
                    return None
                logger.debug(f"工具 {tool_name} 没有预构建定义，使用实例生成参数")
                return tool_instance.to_param()
            except Exception as e:
                logger.debug(f"工具 {tool_name} 无法从实例生成参数: {e}")
                return None

        definition = tool_info.definition

        # 直接使用预存储的参数定义，这些参数已经通过 to_param() 方法正确处理过
        tool_param = {
            "type": "function",
            "function": {
                "name": tool_name,
                "description": definition.description,
                "parameters": definition.parameters_schema or {}
            }
        }

        logger.debug(f"从预构建定义获取工具参数: {tool_name}")
        return tool_param

    async def generate_tool_definitions(self, force: bool = False) -> bool:
        """生成预定义文件

        Args:
            force: 是否强制生成，为True时即使文件存在也重新生成

        Returns:
            bool: 是否成功生成
        """
        # 检查预定义文件是否存在
        definition_exists = await asyncio.to_thread(tool_definition_manager.definition_file.exists)
        if not force and definition_exists:
            try:
                stats = await tool_definition_manager.get_stats()
                tool_count = stats.get('total_tools', 0)
                if tool_count > 0:
                    logger.info(f"预定义文件已存在且包含 {tool_count} 个工具，跳过生成")
                    return True
            except Exception as e:
                logger.warning(f"检查预定义文件状态失败: {e}，继续生成")

        logger.info("开始生成工具预定义文件...")
        start_time = time.time()

        try:
            # 清空现有定义
            tool_definition_manager.clear_definitions()

            # 使用当前已加载的工具信息，无需重新扫描
            all_tools_info = self.get_all_tools()

            success_count = 0
            failed_tools = []

            for tool_name, tool_info in all_tools_info.items():
                try:
                    # 获取工具实例
                    tool_instance = self.get_tool_instance(tool_name)
                    if not tool_instance:
                        logger.warning(f"无法获取工具实例，跳过: {tool_name}")
                        failed_tools.append(tool_name)
                        continue

                    # 获取工具类信息
                    tool_class = tool_instance.__class__
                    module_path = tool_class.__module__
                    class_name = tool_class.__name__

                    # 使用 to_param() 生成完整的工具参数定义（统一过滤出口）
                    try:
                        tool_param_definition = tool_instance.to_param()
                    except Exception as e:
                        logger.error(f"生成工具定义失败 {tool_name}: to_param() 失败 - {e}")
                        failed_tools.append(tool_name)
                        continue

                    # 创建工具定义（使用已过滤的数据）
                    definition = ToolDefinition(
                        name=tool_name,
                        description=tool_param_definition.get("function", {}).get("description"),
                        module_path=module_path,
                        class_name=class_name,
                        parameters_schema=tool_param_definition.get("function", {}).get("parameters"),
                        created_at=time.strftime("%Y-%m-%d %H:%M:%S"),
                        version="1.0",
                        code_mode_only=bool(getattr(tool_instance, "code_mode_only", False)),
                    )

                    # 添加到工具定义管理器
                    tool_definition_manager.add_definition(definition)
                    success_count += 1

                except Exception as e:
                    logger.error(f"生成工具定义失败 {tool_name}: {e}")
                    failed_tools.append(tool_name)

            # 保存所有定义到文件
            await tool_definition_manager.save_definitions()

            # 重新加载当前工厂的工具定义
            await self._reload_definitions_after_generation()

            duration = time.time() - start_time
            total_tools = len(all_tools_info)

            if failed_tools:
                logger.warning(f"工具预定义文件生成完成: 成功 {success_count}/{total_tools}，失败 {len(failed_tools)} 个，耗时 {duration:.3f}s")
                logger.warning(f"失败的工具: {', '.join(failed_tools)}")
            else:
                logger.info(f"✓ 工具预定义文件生成完成: {success_count} 个工具，耗时 {duration:.3f}s")

            return success_count > 0

        except Exception as e:
            logger.error(f"生成工具预定义文件失败: {e}")
            return False

    async def _reload_definitions_after_generation(self):
        """生成完成后重新加载定义到当前工厂实例"""
        try:
            # 重新加载定义
            tool_definition_manager._loaded = False
            definitions = await tool_definition_manager.get_all_definitions()

            # 更新当前工具信息中的定义
            for tool_name, definition in definitions.items():
                if tool_name in self._tools:
                    self._tools[tool_name].definition = definition

            logger.debug(f"重新加载了 {len(definitions)} 个工具定义")
        except Exception as e:
            logger.warning(f"重新加载工具定义失败: {e}")

    def _lazy_load_tool_class(self, tool_name: str) -> Type[BaseTool]:
        """按需加载工具类

        Args:
            tool_name: 工具名称

        Returns:
            Type[BaseTool]: 工具类

        Raises:
            ValueError: 如果无法加载工具类
        """
        tool_info = self._tools.get(tool_name)
        if not tool_info:
            raise ValueError(f"工具 {tool_name} 不存在")

        # 如果已经加载过，直接返回
        if tool_info.tool_class is not None:
            return tool_info.tool_class

                # 检查是否有延迟加载的定义
        if not tool_info.definition:
            raise ValueError(f"工具 {tool_name} 没有可用的定义信息")

        definition: ToolDefinition = tool_info.definition

        try:
            start_time = time.time()

            # 动态导入模块
            module = importlib.import_module(definition.module_path)

            # 获取工具类
            tool_class = getattr(module, definition.class_name)

            # 验证是否为有效的工具类
            if not hasattr(tool_class, '_is_tool') or not tool_class._is_tool:
                raise ValueError(f"类 {definition.class_name} 不是有效的工具类")

            import_time = time.time() - start_time
            logger.info(f"🔄 按需加载工具: {tool_name} - 导入模块耗时 {import_time:.3f}s")

            # 更新 ToolInfo
            tool_info.tool_class = tool_class
            tool_info.params_class = getattr(tool_class, 'params_class', None) or getattr(tool_class, '_params_class', None)
            tool_info.lazy_load = False

            return tool_class

        except ImportError as e:
            raise ValueError(f"无法导入工具模块 {definition.module_path}: {e}")
        except AttributeError as e:
            raise ValueError(f"模块 {definition.module_path} 中没有找到类 {definition.class_name}: {e}")
        except Exception as e:
            raise ValueError(f"加载工具类时发生错误: {e}")

    def auto_discover_tools(self) -> None:
        """自动发现并注册工具

        扫描app.tools包下的所有模块，查找并注册所有通过@tool装饰的工具类
        """
        # 获取工具包路径
        package_name = 'app.tools'
        tools_entry_points = list(importlib.metadata.entry_points(group='agentlang.tools'))
        package_names = [package_name]

        # 检查是否启用 filebase 工具
        enable_filebase_watcher = os.getenv("ENABLE_FILEBASE_WATCHER", "false").lower() in ("true", "1", "yes", "on")

        for entry_point in tools_entry_points:
            # 如果是 filebase 工具包且未启用，则跳过
            if entry_point.value == "filebase.tools" and not enable_filebase_watcher:
                logger.info(f"跳过加载工具包 {entry_point.value}: ENABLE_FILEBASE_WATCHER 未启用 (当前值: {os.getenv('ENABLE_FILEBASE_WATCHER', 'false')})")
                continue
            package_names.append(entry_point.value)
            logger.info(f"发现工具包: {entry_point.value}")
        try:
            # 定义一个递归扫描函数
            def scan_package(pkg_name: str, pkg_path: str) -> None:
                # 扫描该包下的所有模块
                for _, module_name, is_pkg in pkgutil.iter_modules([pkg_path]):
                    # 只在 app.tools 包中跳过 core 包
                    if is_pkg and module_name == 'core' and pkg_name == 'app.tools':
                        continue

                    # 如果是子包，递归扫描
                    if is_pkg:
                        subpackage_name = f"{pkg_name}.{module_name}"
                        logger.info(f"发现子包: {subpackage_name}")
                        try:
                            subpackage = importlib.import_module(subpackage_name)
                            # 检查 subpackage.__file__ 是否存在
                            if not hasattr(subpackage, '__file__') or subpackage.__file__ is None:
                                logger.warning(f"子包 {subpackage_name} 没有 __file__ 属性或为 None，跳过扫描")
                                continue

                            subpackage_path = os.path.dirname(subpackage.__file__)

                            # 递归扫描子包
                            scan_package(subpackage_name, subpackage_path)
                        except Exception as e:
                            logger.error(f"扫描子包 {subpackage_name} 失败: {e!s}")
                        continue

                    # 动态导入模块
                    module_fullname = f"{pkg_name}.{module_name}"
                    try:
                        # 导入模块
                        module_start_time = time.time()
                        module = importlib.import_module(module_fullname)
                        module_import_time = time.time() - module_start_time

                        # 查找模块中带有_is_tool标记的类
                        tools_found = 0
                        for name, obj in inspect.getmembers(module):
                            if (inspect.isclass(obj) and
                                hasattr(obj, '_is_tool') and
                                obj._is_tool and
                                not getattr(obj, '_registered', False) and
                                not inspect.isabstract(obj) and  # 过滤掉Python标准抽象类
                                not self._is_abstract_base_class(obj)):  # 过滤掉工具抽象基类
                                # 注册工具类
                                self.register_tool(obj)
                                tools_found += 1

                        # 只记录有工具的模块导入信息
                        if tools_found > 0:
                            logger.info(f"导入模块: {module_fullname} 耗时 {module_import_time:.3f}s")
                    except Exception as e:
                        logger.error(f"加载模块 {module_fullname} 失败: {e!s}")

            for package_name in package_names:
                try:
                    package = importlib.import_module(package_name)
                    package_path = os.path.dirname(package.__file__)
                    # 开始扫描
                    scan_package(package_name, package_path)
                except ImportError:
                    logger.error(f"未找到工具包: {package_name}")
                    continue  # 跳过不存在的包
                except Exception as e:
                    logger.error(f"加载工具包 {package_name} 失败: {e!s}")
                    continue  # 跳过出错的包
        except Exception as e:
            logger.error(f"扫描工具时发生错误: {e!s}", exc_info=True)

    def initialize(self) -> None:
        """初始化工厂，扫描和注册所有工具"""
        self.auto_discover_tools()
        logger.info(f"工具工厂初始化完成，共发现 {len(self._tools)} 个工具")

    def get_tool(self, tool_name: str) -> Optional[ToolInfo]:
        """获取工具信息

        Args:
            tool_name: 工具名称

        Returns:
            Optional[ToolInfo]: 工具信息对象
        """
        if not self._tools:
            self.initialize()

        return self._tools.get(tool_name)

    def get_tool_instance(self, tool_name: str) -> BaseTool:
        """获取工具实例

        Args:
            tool_name: 工具名称

        Returns:
            BaseTool: 工具实例
        """
        # 先检查缓存
        if tool_name in self._tool_instances:
            return self._tool_instances[tool_name]

        if remote_tool_manager.is_remote_tool(tool_name):
            try:
                # 获取远程工具实例
                return remote_tool_manager.get_remote_tool_instance(tool_name)
            except Exception as e:
                logger.error(f"❌ 获取远程工具实例失败: {tool_name} - {str(e)}")
                raise ValueError(f"无法获取远程工具 {tool_name} 的实例: {e}")

        # 获取内置工具信息
        tool_info = self.get_tool(tool_name)
        if not tool_info:
            logger.error(f"❌ 工具不存在: {tool_name}")
            raise ValueError(f"工具 {tool_name} 不存在")

        # 如果是延迟加载模式，先加载工具类
        if tool_info.lazy_load:
            tool_class = self._lazy_load_tool_class(tool_name)
        else:
            tool_class = tool_info.tool_class

        # 创建工具实例
        try:
            # 获取类属性
            name = getattr(tool_class, 'name', tool_name)
            description = getattr(tool_class, 'description', tool_info.description)

            # 显式传递name和description作为实例化参数
            tool_instance = tool_class(name=name, description=description)

            # 缓存实例
            self._tool_instances[tool_name] = tool_instance

            return tool_instance
        except Exception as e:
            logger.error(f"💥 创建工具实例失败: {tool_name} - {str(e)}")
            raise ValueError(f"无法创建工具 {tool_name} 的实例: {e}")

    def is_code_mode_only_tool(self, tool_name: str) -> bool:
        """检查工具是否仅允许 Code Mode 调用。"""
        if remote_tool_manager.is_remote_tool(tool_name):
            return False

        tool_info = self.get_tool(tool_name)
        if not tool_info:
            return False

        return bool(tool_info.code_mode_only)

    def get_all_tools(self) -> Dict[str, ToolInfo]:
        """获取所有工具信息

        Returns:
            Dict[str, ToolInfo]: 工具名称和信息对象的字典
        """
        if not self._tools:
            self.initialize()

        # 合并本地工具和远程工具
        all_tools = self._tools.copy()

        # 添加远程工具信息
        for tool_name in remote_tool_manager.get_registered_tool_names():
            try:
                # 为远程工具创建 ToolInfo 对象
                remote_tool = remote_tool_manager.get_remote_tool_instance(tool_name)
                tool_info = ToolInfo(
                    tool_class=None,  # 远程工具没有本地类
                    name=tool_name,
                    description=remote_tool.description,
                    params_class=None,  # 远程工具参数由其内部管理
                    error=None,
                    definition=None,
                    lazy_load=False
                )
                all_tools[tool_name] = tool_info
            except Exception as e:
                logger.warning(f"获取远程工具 {tool_name} 信息时出错: {e}")
                # 添加错误状态的工具信息
                all_tools[tool_name] = ToolInfo(
                    tool_class=None,
                    name=tool_name,
                    description=f"远程工具 (错误: {str(e)})",
                    params_class=None,
                    error=str(e),
                    definition=None,
                    lazy_load=False
                )

        return all_tools

    def get_tool_names(self) -> List[str]:
        """获取所有工具名称

        Returns:
            List[str]: 工具名称列表
        """
        if not self._tools:
            self.initialize()

        # 合并本地工具和远程工具名称；CodeModeOnly 工具只允许 sdk.tool.call 调用，不进入直接挂载列表
        all_names = [tool_name for tool_name in self._tools.keys() if not self.is_code_mode_only_tool(tool_name)]
        all_names.extend(remote_tool_manager.get_registered_tool_names())

        # 去重并保持顺序
        return list(dict.fromkeys(all_names))

    def get_all_tool_instances(self) -> List[BaseTool]:
        """获取所有工具实例

        Returns:
            List[BaseTool]: 工具实例列表
        """
        instances = []

        # 获取所有工具名称
        for tool_name in self.get_tool_names():
            try:
                instance = self.get_tool_instance(tool_name)
                if getattr(instance, "code_mode_only", False):
                    continue
                instances.append(instance)
            except Exception as e:
                logger.warning(f"获取工具 {tool_name} 实例时出错: {e}")

        return instances

    async def run_tool(self, tool_context: ToolContext, tool_name: str, **kwargs) -> ToolResult:
        """运行工具

        Args:
            tool_context: 工具上下文
            tool_name: 工具名称
            **kwargs: 工具参数

        Returns:
            ToolResult: 工具执行结果
        """
        try:
            start_time = time.time()

            # 获取工具实例
            tool_instance = self.get_tool_instance(tool_name)

            # 转换参数类型（如果适用）
            tool_info = self.get_tool(tool_name)
            params_class = tool_info.params_class if tool_info else None
            if params_class:
                try:
                    params = params_class(**kwargs)
                    result = await tool_instance.execute(tool_context, params)
                except Exception as e:
                    logger.error(f"参数验证失败: {e!s}")
                    result = ToolResult(
                        error=f"参数验证失败: {e!s}",
                        name=tool_name
                    )
            else:
                # 向后兼容：不使用参数模型的工具
                result = await tool_instance.execute(tool_context, **kwargs)

            # 设置执行时间
            result.execution_time = time.time() - start_time

            return result
        except Exception as e:
            logger.error(f"执行工具 {tool_name} 失败: {e!s}", exc_info=True)

            # 创建错误结果
            result = ToolResult(
                content="",
                error=f"执行工具失败: {e!s}",
                name=tool_name
            )

            return result


# 创建全局工具工厂实例
tool_factory = ToolFactory()
