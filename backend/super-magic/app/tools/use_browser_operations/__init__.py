"""浏览器操作模块

此模块包含所有浏览器操作的定义和实现，使用Pydantic模型进行参数验证。
"""

from app.tools.use_browser_operations.base import BaseOperationParams, OperationGroup, operation
from app.tools.use_browser_operations.operations_registry import operations_registry
from app.tools.use_browser_operations.content import ContentOperations
from app.tools.use_browser_operations.interaction import InteractionOperations
from app.tools.use_browser_operations.navigation import NavigationOperations

__all__ = [
    'BaseOperationParams',
    'OperationGroup',
    'operation',
    'operations_registry',
    'ContentOperations',
    'InteractionOperations',
    'NavigationOperations'
]
