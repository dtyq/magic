"""会话配置结构体定义。"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ImageModelSize:
    """图片生成模型单个尺寸规格。"""

    label: str = ""
    value: str = ""
    scale: str = ""

    @classmethod
    def from_dict(cls, raw: object) -> "ImageModelSize":
        if not isinstance(raw, dict):
            return cls()
        return cls(
            label=str(raw.get("label") or ""),
            value=str(raw.get("value") or ""),
            scale=str(raw.get("scale") or ""),
        )

    def to_dict(self) -> dict[str, str]:
        return {"label": self.label, "value": self.value, "scale": self.scale}


@dataclass
class SessionConfig:
    """
    会话配置，对应 .session.json 中 last / current 块的结构化表示。

    在 agentlang 层，video_generation_config 是透传的不透明配置，
    以 JSON 兼容对象存储，不做深层解析。
    """

    model_id: str | None = None
    image_model_id: str | None = None
    image_model_sizes: list[ImageModelSize] | None = None
    video_model_id: str | None = None
    video_generation_config: dict[str, object] | None = None
    mcp_servers: dict[str, list[str]] | None = None
    message_version: str | None = None
    agent_mode: str | None = None
    agent_code: str | None = None

    @classmethod
    def from_dict(cls, raw: dict[str, object]) -> "SessionConfig":
        """从 session.json 的原始 dict 块构建 SessionConfig。"""
        sizes_raw = raw.get("image_model_sizes")
        image_model_sizes: list[ImageModelSize] | None = None
        if isinstance(sizes_raw, list):
            image_model_sizes = [ImageModelSize.from_dict(s) for s in sizes_raw]

        video_generation_config: dict[str, object] | None = None
        vgc_raw = raw.get("video_generation_config")
        if isinstance(vgc_raw, dict):
            video_generation_config = vgc_raw

        mcp_servers: dict[str, list[str]] | None = None
        mcp_raw = raw.get("mcp_servers")
        if isinstance(mcp_raw, dict):
            mcp_servers = {
                k: v if isinstance(v, list) else []
                for k, v in mcp_raw.items()
            }

        def _str_or_none(key: str) -> str | None:
            v = raw.get(key)
            return str(v).strip() if isinstance(v, str) and v.strip() else None

        return cls(
            model_id=_str_or_none("model_id"),
            image_model_id=_str_or_none("image_model_id"),
            image_model_sizes=image_model_sizes,
            video_model_id=_str_or_none("video_model_id"),
            video_generation_config=video_generation_config,
            mcp_servers=mcp_servers,
            message_version=_str_or_none("message_version"),
            agent_mode=_str_or_none("agent_mode"),
            agent_code=_str_or_none("agent_code"),
        )

    def to_dict(self) -> dict[str, object]:
        """序列化为 session.json 可写入的原始 dict。"""
        return {
            "model_id": self.model_id,
            "image_model_id": self.image_model_id,
            "image_model_sizes": (
                [s.to_dict() for s in self.image_model_sizes]
                if self.image_model_sizes is not None
                else None
            ),
            "video_model_id": self.video_model_id,
            "video_generation_config": self.video_generation_config,
            "mcp_servers": self.mcp_servers,
            "message_version": self.message_version,
            "agent_mode": self.agent_mode,
            "agent_code": self.agent_code,
        }
