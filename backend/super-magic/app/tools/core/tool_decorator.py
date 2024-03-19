"""工具装饰器模块

提供工具注册装饰器，用于自动提取工具元数据并注册工具
"""

from typing import Optional


def tool(name: Optional[str] = None, description: Optional[str] = None):
    """工具注册装饰器

    用于注册工具类，标记为工具并存储用户提供的元数据

    Args:
        name: 可选工具名称，若不提供则在BaseTool中自动推断
        description: 可选工具描述，若不提供则在BaseTool中自动推断
    """
    def decorator(cls):
        # 标记类为工具
        cls._is_tool = True

        # 存储用户在装饰器中提供的名称和描述（如果有）
        cls._initial_name = name
        cls._initial_description = description

        # 初始化这些值，确保ToolFactory能识别
        # BaseTool.__init_subclass__会最终确定这些值
        cls._tool_name = name if name else getattr(cls, 'name', None)
        cls._tool_description = description if description else getattr(cls, 'description', None)
        cls._params_class = getattr(cls, 'params_class', None)

        # 标记未注册
        cls._registered = False

        return cls
    return decorator
