"""Canvas Connection 操作幂等记录。

该记录只保存连线工具需要的内部幂等信息，不进入 Canvas 主文件，也不向模型返回。
"""

from __future__ import annotations

from typing import Any


class ConnectionOperationLedger:
    """维护已删除和已替换 Connection ID 的最小操作记录。"""

    _KEY = "connectionOperations"
    _REMOVED_KEY = "removedConnectionIds"
    _REPLACED_KEY = "replacements"

    def __init__(self, document: dict[str, Any]):
        """绑定一个可写的 sidecar 文档。"""
        self._document = document
        operations = document.setdefault(self._KEY, {})
        if not isinstance(operations, dict):
            operations = {}
            document[self._KEY] = operations
        removed = operations.setdefault(self._REMOVED_KEY, [])
        replacements = operations.setdefault(self._REPLACED_KEY, {})
        if not isinstance(removed, list):
            operations[self._REMOVED_KEY] = removed = []
        if not isinstance(replacements, dict):
            operations[self._REPLACED_KEY] = replacements = {}
        self._operations = operations
        self._removed: list[str] = removed
        self._replacements: dict[str, dict[str, str]] = replacements

    def was_removed(self, connection_id: str) -> bool:
        """判断 Connection 是否已经由本工具成功删除。"""
        return connection_id in self._removed

    def replacement_matches(
        self,
        connection_id: str,
        source_element_id: str | None,
        target_element_id: str | None,
    ) -> bool:
        """判断旧 Connection 是否已经被替换为指定的新端点。"""
        replacement = self._replacements.get(connection_id)
        if replacement is None:
            return False
        return (
            replacement.get("sourceElementId") == source_element_id
            and replacement.get("targetElementId") == target_element_id
        )

    def mark_removed(self, connection_id: str) -> None:
        """记录一次成功的 Connection 删除。"""
        if connection_id not in self._removed:
            self._removed.append(connection_id)
        self._replacements.pop(connection_id, None)

    def mark_replaced(
        self,
        connection_id: str,
        new_connection_id: str,
        source_element_id: str,
        target_element_id: str,
    ) -> None:
        """记录一次成功的 Connection 替换。"""
        if connection_id in self._removed:
            self._removed.remove(connection_id)
        self._replacements[connection_id] = {
            "newConnectionId": new_connection_id,
            "sourceElementId": source_element_id,
            "targetElementId": target_element_id,
        }

    def compact(self) -> None:
        """删除没有任何记录的空操作节点，避免产生空 sidecar。"""
        if self._removed or self._replacements:
            return
        self._document.pop(self._KEY, None)
