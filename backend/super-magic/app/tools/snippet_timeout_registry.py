"""Snippet 超时注册表

各工具模块在模块级调用 register() 声明自己的最小超时需求，
run_skills_snippet 通过注册表动态计算生效超时，不感知具体工具实现。
"""

from __future__ import annotations

from collections.abc import Callable, Sequence


class SnippetTimeoutRegistry:
    """全局单例注册表，管理 run_skills_snippet 的超时提升规则。

    注册规则由各工具模块在模块导入时自行注册，彼此解耦。
    执行时遍历所有规则，取 max(requested_timeout, all matched min_timeouts)。
    """

    _rules: list[tuple[Callable[[str], bool], int]] = []

    @classmethod
    def register(cls, tool_names: str | Sequence[str], min_timeout: int) -> None:
        """注册工具调用的最小超时规则。

        Args:
            tool_names: 工具名或工具名列表，检测 python_code 中是否出现对应字符串字面量调用
            min_timeout: 该工具要求的最小超时时间（秒）
        """
        if isinstance(tool_names, str):
            tool_names = [tool_names]
        names = list(tool_names)

        def detector(python_code: str) -> bool:
            return any(
                f"'{name}'" in python_code or f'"{name}"' in python_code
                for name in names
            )

        cls._rules.append((detector, min_timeout))

    @classmethod
    def get_effective_timeout(cls, python_code: str, requested_timeout: int) -> int:
        """根据注册规则计算实际生效的超时时间。

        Args:
            python_code: 待执行的 Python 代码
            requested_timeout: 调用方请求的超时时间（秒）

        Returns:
            int: max(requested_timeout, 所有匹配规则的 min_timeout)
        """
        effective = requested_timeout
        for detector, min_timeout in cls._rules:
            if detector(python_code):
                effective = max(effective, min_timeout)
        return effective
