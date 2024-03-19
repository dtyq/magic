"""浏览器操作注册表

动态加载和管理所有操作组

# 操作注册表设计

## 设计目标

操作注册表是浏览器操作架构的核心组件，它实现了以下目标：
- 集中管理所有操作组和操作
- 支持动态发现和加载操作
- 提供统一的操作访问接口
- 支持按组织和分类查询操作

## 工作原理

1. **动态发现**：
   - 自动扫描use_browser_operations包下的所有模块
   - 查找并注册所有OperationGroup子类
   - 无需手动注册，新增操作组会被自动发现

2. **懒加载机制**：
   - 注册表使用延迟初始化模式
   - 首次请求操作时才实例化操作组
   - 减少启动时间和资源消耗

3. **插件式架构**：
   - 遵循开闭原则，支持扩展不修改
   - 新操作可以在独立模块中定义
   - 操作组间保持松耦合

## 使用方式

- 获取操作: operations_registry.get_operation(name)
- 获取所有操作: operations_registry.get_all_operations()
- 按组获取操作: operations_registry.get_operations_by_group(group_name)
- 获取组信息: operations_registry.get_group_info()

## 扩展注册表

添加新的操作组只需：
1. 创建继承自OperationGroup的新类
2. 定义group_name和group_description类变量
3. 在类中实现操作方法并使用@operation装饰器

无需修改注册表代码，新操作组将被自动发现和加载。
"""

import importlib
import inspect
import os
import pkgutil
import sys
from typing import Any, Dict, List, Optional, Type

from agentlang.logger import get_logger
from app.tools.use_browser_operations.base import OperationGroup

# 日志记录器
logger = get_logger(__name__)

class OperationsRegistry:
    """浏览器操作注册表

    动态加载和管理所有操作组
    """
    def __init__(self):
        self._operation_groups: Dict[str, Type[OperationGroup]] = {}
        self._operations: Dict[str, Dict[str, Any]] = {}
        self._group_instances: Dict[str, OperationGroup] = {}
        self._initialized = False

    def register_operation_group(self, group_class: Type[OperationGroup]):
        """注册操作组

        Args:
            group_class: 操作组类
        """
        group_name = group_class.group_name
        self._operation_groups[group_name] = group_class
        logger.debug(f"注册操作组: {group_name}")

    def auto_discover_operation_groups(self):
        """自动发现并注册操作组

        扫描use_browser_operations包下的所有模块，查找并注册所有OperationGroup子类
        """
        # 获取当前包路径
        package_name = 'app.tools.use_browser_operations'
        package = sys.modules[package_name]
        package_path = os.path.dirname(package.__file__)

        logger.debug(f"开始扫描 {package_path} 下的操作组")

        # 扫描该包下的所有模块
        for _, module_name, is_pkg in pkgutil.iter_modules([package_path]):
            # 跳过package和当前模块，避免循环导入
            if is_pkg or module_name in ['operations_registry', 'base']:
                continue

            # 动态导入模块
            module_fullname = f"{package_name}.{module_name}"
            try:
                module = importlib.import_module(module_fullname)

                # 查找模块中的所有OperationGroup子类
                for name, obj in inspect.getmembers(module):
                    if (inspect.isclass(obj) and
                        issubclass(obj, OperationGroup) and
                        obj != OperationGroup):
                        # 注册找到的操作组
                        self.register_operation_group(obj)
                        logger.debug(f"从模块 {module_name} 中自动发现并注册操作组: {obj.group_name}")
            except Exception as e:
                logger.error(f"加载模块 {module_fullname} 失败: {e!s}")

        logger.info(f"操作组自动发现完成，共发现 {len(self._operation_groups)} 个操作组")

    def _ensure_initialized(self):
        """确保注册表已初始化（延迟初始化）"""
        if self._initialized:
            return

        # 如果还没有发现操作组，先进行自动发现
        if not self._operation_groups:
            self.auto_discover_operation_groups()

        self.initialize()

    def initialize(self):
        """初始化注册表，创建所有操作组实例并注册操作"""
        if self._initialized:
            return

        logger.debug(f"初始化操作注册表，操作组数: {len(self._operation_groups)}")

        # 创建操作组实例
        for group_name, group_class in self._operation_groups.items():
            self._group_instances[group_name] = group_class()

        # 注册所有操作
        for group_name, group_instance in self._group_instances.items():
            operations = group_instance.get_operations()
            for op_name, op_info in operations.items():
                self._operations[op_name] = {
                    "group": group_name,
                    "handler": op_info["handler"],
                    "params_class": op_info["params_class"],
                    "description": op_info["description"],
                    "examples": op_info.get("examples", []),
                }
                logger.debug(f"注册操作: {op_name} (来自 {group_name})")

        self._initialized = True
        logger.info(f"操作注册表初始化完成，共 {len(self._operations)} 个操作")

    def get_operation(self, operation_name: str) -> Optional[Dict[str, Any]]:
        """获取操作信息

        Args:
            operation_name: 操作名称

        Returns:
            操作信息字典，如果不存在则返回None
        """
        self._ensure_initialized()

        op_info = self._operations.get(operation_name)
        if not op_info:
            logger.warning(f"未找到操作: {operation_name}")

        return op_info

    def get_all_operations(self) -> Dict[str, Dict[str, Any]]:
        """获取所有操作

        Returns:
            所有操作信息字典
        """
        self._ensure_initialized()
        return self._operations

    def get_operations_by_group(self, group_name: str) -> Dict[str, Dict[str, Any]]:
        """按组获取操作

        Args:
            group_name: 组名称

        Returns:
            组内的操作信息字典
        """
        self._ensure_initialized()
        operations = {}
        for op_name, op_info in self._operations.items():
            if op_info["group"] == group_name:
                operations[op_name] = op_info
        return operations

    def get_group_names(self) -> List[str]:
        """获取所有组名称

        Returns:
            所有组名称列表
        """
        self._ensure_initialized()
        return list(self._operation_groups.keys())

    def get_group_info(self) -> Dict[str, Dict[str, Any]]:
        """获取所有组信息

        Returns:
            所有组信息字典
        """
        self._ensure_initialized()
        group_info = {}
        for group_name, group_class in self._operation_groups.items():
            group_info[group_name] = {
                "name": group_name,
                "description": group_class.group_description,
                "operations_count": len(self.get_operations_by_group(group_name))
            }
        return group_info


# 创建全局操作注册表实例（延迟初始化模式）
operations_registry = OperationsRegistry()
