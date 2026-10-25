"""Canvas 初始和独立 Connection 命令模型。"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class CreationConnectionCommand:
    """描述新增 Element 时以当前 Element 为锚点的 Connection。"""

    source_element_id: str | None = None
    source_item_ref: str | None = None
    target_element_id: str | None = None
    target_item_ref: str | None = None


@dataclass(frozen=True)
class ConnectionCommand:
    """描述新增、删除或替换的一条独立 Connection。"""

    item_ref: str
    source_element_id: str | None = None
    target_element_id: str | None = None
    replace_existing_connections: bool = False
    remove_connection_ids: tuple[str, ...] = field(default_factory=tuple)
