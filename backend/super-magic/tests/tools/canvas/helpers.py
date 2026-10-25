"""Canvas 测试使用的强类型命令构造辅助。"""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from app.tools.canvas.application import CanvasApplication
from app.tools.canvas.application.commands import AddElementCommand, GenerationParametersOverride, RetryContentCommand
from app.tools.canvas.bootstrap import CanvasApplicationFactory
from app.tools.canvas.tools import (
    AddContentInput,
    ConnectionInput,
    ElementInput,
    FrameSelectionInput,
    LayoutElementInput,
    MainContentInput,
)


class TypedCanvasApplication:
    """把测试输入模型转换为 Application 明确要求的命令对象。"""

    def __init__(self, application: CanvasApplication) -> None:
        """保存真实 Application，并只在测试边界完成输入转换。"""
        self._application = application

    def __getattr__(self, name: str) -> Any:
        """把未涉及命令转换的查询和初始化调用转发给真实 Application。"""
        return getattr(self._application, name)

    async def add_elements(self, project_path: str, items: list[dict[str, Any]], *args: Any, **kwargs: Any) -> Any:
        """将测试字典转换为 AddElementCommand。"""
        commands = []
        for item in items:
            normalized = _normalize_content(item)
            try:
                commands.append(ElementInput.model_validate(normalized).to_command())
            except ValidationError:
                # 领域层负向测试需要保留非法 element_type，让业务码由 Application 负责判定。
                commands.append(
                    AddElementCommand(
                        item_ref=str(normalized.get("item_ref", "")),
                        element_type=str(normalized.get("element_type", "")),
                        name=normalized.get("name"),
                    )
                )
        return await self._application.add_elements(project_path, commands, *args, **kwargs)

    async def add_contents(self, project_path: str, items: list[dict[str, Any]], *args: Any, **kwargs: Any) -> Any:
        """将测试字典转换为 AddContentCommand。"""
        return await self._application.add_contents(project_path, [AddContentInput.model_validate(_normalize_content(item)).to_command() for item in items], *args, **kwargs)

    async def connections(self, project_path: str, items: list[dict[str, Any]], *args: Any, **kwargs: Any) -> Any:
        """将测试字典转换为 ConnectionCommand。"""
        return await self._application.connections(project_path, [ConnectionInput.model_validate(item).to_command() for item in items], *args, **kwargs)

    async def frame_elements(self, project_path: str, items: list[dict[str, Any]], *args: Any, **kwargs: Any) -> Any:
        """将测试字典转换为 FrameElementsCommand。"""
        return await self._application.frame_elements(project_path, [FrameSelectionInput.model_validate(item).to_command() for item in items], *args, **kwargs)

    async def layout(self, project_path: str, items: list[dict[str, Any]], *args: Any, **kwargs: Any) -> Any:
        """将测试字典转换为 LayoutElementCommand。"""
        return await self._application.layout(project_path, [LayoutElementInput.model_validate(item).to_command() for item in items], *args, **kwargs)

    async def retry_content(self, project_path: str, items: list[dict[str, Any]], *args: Any, **kwargs: Any) -> Any:
        """将测试字典转换为 RetryContentCommand。"""
        commands = []
        for item in items:
            override = item.get("generation_override") or {}
            commands.append(RetryContentCommand(
                item_ref=item["item_ref"],
                element_id=item["element_id"],
                content_id=item["content_id"],
                generation_override=GenerationParametersOverride(
                    prompt=str(override.get("prompt", "")),
                    _provided_fields=frozenset(override),
                ) if item.get("generation_override") is not None else None,
            ))
        return await self._application.retry_content(project_path, commands, *args, **kwargs)

    async def select_main(self, project_path: str, items: list[dict[str, Any]], *args: Any, **kwargs: Any) -> Any:
        """将测试字典转换为 SelectMainContentCommand。"""
        return await self._application.select_main(project_path, [MainContentInput.model_validate(item).to_command() for item in items], *args, **kwargs)


def create_test_application(*args: Any, **kwargs: Any) -> TypedCanvasApplication:
    """创建带测试输入适配的 Canvas Application。"""
    return TypedCanvasApplication(CanvasApplicationFactory.create(*args, **kwargs))


def _normalize_content(item: dict[str, Any]) -> dict[str, Any]:
    """把旧测试中的简写富文本转换为公开输入模型格式。"""
    value = dict(item)
    content = value.get("content")
    if isinstance(content, dict):
        content = dict(content)
        payload = content.get("content")
        if isinstance(payload, list) and payload and all(isinstance(node, dict) and "text" in node for node in payload):
            content["content"] = "".join(str(node["text"]) for node in payload)
        value["content"] = content
    return value


_factory_create = CanvasApplicationFactory.create


def _create_typed_application(cls: type[CanvasApplicationFactory], *args: Any, **kwargs: Any) -> TypedCanvasApplication:
    """在测试模块中让现有工厂调用统一返回强类型测试适配器。"""
    return TypedCanvasApplication(_factory_create(*args, **kwargs))


CanvasApplicationFactory.create = classmethod(_create_typed_application)
