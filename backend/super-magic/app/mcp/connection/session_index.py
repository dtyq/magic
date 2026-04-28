"""MCP 会话索引管理

为每个 MCP 服务器分配唯一的字母标识（a/b/c...aa/ab...），
用于构造工具前缀（如 mcp_a_tool_name）。支持索引的分配与回收。
"""

from typing import Dict, List, Optional


class SessionIndexManager:
    """管理 MCP 服务器的会话索引分配与回收

    索引映射规则类似 Excel 列名：
        0 -> 'a', 1 -> 'b', ..., 25 -> 'z', 26 -> 'aa', 27 -> 'ab', ...

    释放的索引会被优先复用，避免无限增长。
    """

    def __init__(self) -> None:
        self.server_indices: Dict[str, int] = {}  # server_name -> index
        self.free_indices: List[int] = []          # 可复用的空闲索引（有序）

    def allocate(self, server_name: str) -> int:
        """为服务器分配会话索引，已存在时返回现有索引

        Args:
            server_name: 服务器名称

        Returns:
            int: 分配的索引
        """
        if server_name in self.server_indices:
            return self.server_indices[server_name]

        if self.free_indices:
            index = self.free_indices.pop(0)
        elif self.server_indices:
            index = max(self.server_indices.values()) + 1
        else:
            index = 0

        self.server_indices[server_name] = index
        return index

    def release(self, server_name: str) -> bool:
        """释放服务器的会话索引，使其可被后续服务器复用

        Args:
            server_name: 服务器名称

        Returns:
            bool: 是否成功释放
        """
        if server_name not in self.server_indices:
            return False

        index = self.server_indices.pop(server_name)
        self.free_indices.append(index)
        self.free_indices.sort()
        return True

    def get_index(self, server_name: str) -> Optional[int]:
        """获取服务器的会话索引

        Returns:
            Optional[int]: 索引，不存在时返回 None
        """
        return self.server_indices.get(server_name)

    def get_letter(self, server_name: str) -> Optional[str]:
        """获取服务器的会话字母标识

        Returns:
            Optional[str]: 字母标识，不存在时返回 None
        """
        index = self.get_index(server_name)
        if index is None:
            return None
        return self.index_to_letter(index)

    @staticmethod
    def index_to_letter(index: int) -> str:
        """将整数索引转换为字母标识（类似 Excel 列名）

        Args:
            index: 从 0 开始的整数索引

        Returns:
            str: 字母标识，如 'a', 'z', 'aa', 'ab'...
        """
        result = ''
        n = index + 1  # 转为 1-based

        while n > 0:
            n -= 1
            result = chr(97 + (n % 26)) + result
            n //= 26

        return result

    def clear(self) -> None:
        """清空所有索引状态"""
        self.server_indices.clear()
        self.free_indices.clear()
