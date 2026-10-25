"""Canvas Element 创建和 Frame 命令模型。"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.tools.canvas.application.commands.connection_commands import CreationConnectionCommand
from app.tools.canvas.application.commands.content_command import ContentCommand
from app.tools.canvas.application.commands.layout_command import LayoutCommand


@dataclass(frozen=True)
class AddElementCommand:
    """描述新增一个 Canvas Element 的完整业务命令。"""

    item_ref: str
    element_type: str
    name: str | None = None
    layout: LayoutCommand | None = None
    content: ContentCommand | None = None
    connections: tuple[CreationConnectionCommand, ...] = field(default_factory=tuple)
    element_id: str | None = None


@dataclass(frozen=True)
class AddContentCommand:
    """描述向已有 Element 追加一个 Content 版本的命令。"""

    item_ref: str
    element_id: str
    content: ContentCommand


@dataclass(frozen=True)
class FrameElementsCommand:
    """描述将已有同层级 Element 框选为 Frame 的命令。"""

    item_ref: str
    element_ids: tuple[str, ...]
    name: str | None = None
    padding: float | None = None


@dataclass(frozen=True)
class LayoutElementCommand:
    """描述对已有 Element 应用布局策略的命令。"""

    item_ref: str
    element_id: str
    layout: LayoutCommand
