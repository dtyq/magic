from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Optional


JsonObject = dict[str, object]


@dataclass(frozen=True)
class ImageModelSizeSpec:
    """图片模型支持的单个尺寸规格。

    该结构用于保存 provider 返回的尺寸标签、真实参数值和可选缩放级别，
    避免在业务代码中直接传递松散的 dict。
    """

    label: str = ""
    value: str = ""
    scale: str = ""

    @classmethod
    def from_raw(cls, raw: object) -> Optional["ImageModelSizeSpec"]:
        """从原始配置对象中解析图片尺寸规格，无法识别时返回 None。"""
        if hasattr(raw, "to_dict") and callable(raw.to_dict):
            raw = raw.to_dict()
        if not isinstance(raw, Mapping):
            return None

        label = normalize_model_id(raw.get("label")) or ""
        value = normalize_model_id(raw.get("value")) or ""
        scale = normalize_model_id(raw.get("scale")) or ""
        if not label and not value and not scale:
            return None
        return cls(label=label, value=value, scale=scale)

    def to_payload(self) -> dict[str, str]:
        """转换为可写入 session 或 dynamic_config 的精简字典。"""
        payload: dict[str, str] = {}
        if self.label:
            payload["label"] = self.label
        if self.value:
            payload["value"] = self.value
        if self.scale:
            payload["scale"] = self.scale
        return payload


@dataclass(frozen=True)
class ImageModelSpec:
    """运行时图片模型配置。

    包含图片模型 ID 以及该模型可用的尺寸能力。模型选择和上下文保存时都使用
    这个结构，只有对外序列化时才转换成 payload 字典。
    """

    model_id: Optional[str] = None
    sizes: tuple[ImageModelSizeSpec, ...] = ()

    @classmethod
    def empty(cls) -> "ImageModelSpec":
        """返回一个未选择图片模型的空配置。"""
        return cls()

    @classmethod
    def from_raw(cls, raw: object) -> "ImageModelSpec":
        """从 dynamic_config 或 session 原始字典中解析图片模型配置。"""
        if not isinstance(raw, Mapping):
            return cls.empty()
        return cls.from_values(
            model_id=raw.get("model_id"),
            sizes=raw.get("sizes"),
        )

    @classmethod
    def from_values(cls, model_id: object, sizes: object = None) -> "ImageModelSpec":
        """从明确字段构造图片模型配置，并归一化模型 ID 和尺寸列表。"""
        return cls(
            model_id=normalize_model_id(model_id),
            sizes=_size_specs_from_raw(sizes),
        )

    def with_fallback_capability(self, fallback: "ImageModelSpec") -> "ImageModelSpec":
        """在请求只指定同一模型 ID 时，补齐会话中保存的尺寸能力。"""
        if not self.model_id or self.model_id != fallback.model_id or self.sizes:
            return self
        return ImageModelSpec(model_id=self.model_id, sizes=fallback.sizes)

    @property
    def has_model(self) -> bool:
        """判断当前配置是否已经选择了图片模型。"""
        return bool(self.model_id)

    def sizes_payload(self) -> Optional[list[dict[str, str]]]:
        """返回图片尺寸能力的 payload 形式，没有尺寸时返回 None。"""
        if not self.sizes:
            return None
        return [size.to_payload() for size in self.sizes]

    def to_payload(self) -> Optional[JsonObject]:
        """转换为可持久化或注入 horizon 的图片模型 payload。"""
        if not self.model_id:
            return None
        payload: JsonObject = {"model_id": self.model_id}
        sizes = self.sizes_payload()
        if sizes is not None:
            payload["sizes"] = sizes
        return payload


@dataclass(frozen=True)
class VideoGenerationConfigSpec:
    """视频模型的生成能力配置。

    视频能力配置目前由 provider 透传，内部保持 JSON 兼容对象，不在这里解析具体字段。
    """

    raw: JsonObject

    @classmethod
    def from_raw(cls, raw: object) -> Optional["VideoGenerationConfigSpec"]:
        """从原始对象中解析视频生成能力配置，空配置返回 None。"""
        if not isinstance(raw, Mapping) or not raw:
            return None
        return cls(raw=dict(raw))

    def to_payload(self) -> JsonObject:
        """返回一份可安全传给外部调用方的配置副本。"""
        return dict(self.raw)


@dataclass(frozen=True)
class VideoModelSpec:
    """运行时视频模型配置。

    包含视频模型 ID 以及 provider 透传的生成能力配置，供视频工具和 horizon 注入使用。
    """

    model_id: Optional[str] = None
    generation_config: Optional[VideoGenerationConfigSpec] = None

    @classmethod
    def empty(cls) -> "VideoModelSpec":
        """返回一个未选择视频模型的空配置。"""
        return cls()

    @classmethod
    def from_raw(cls, raw: object) -> "VideoModelSpec":
        """从 dynamic_config 或 session 原始字典中解析视频模型配置。"""
        if not isinstance(raw, Mapping):
            return cls.empty()
        return cls.from_values(
            model_id=raw.get("model_id"),
            video_generation_config=raw.get("video_generation_config"),
        )

    @classmethod
    def from_values(cls, model_id: object, video_generation_config: object = None) -> "VideoModelSpec":
        """从明确字段构造视频模型配置，并归一化模型 ID 和能力配置。"""
        return cls(
            model_id=normalize_model_id(model_id),
            generation_config=VideoGenerationConfigSpec.from_raw(video_generation_config),
        )

    def with_fallback_capability(self, fallback: "VideoModelSpec") -> "VideoModelSpec":
        """在请求只指定同一模型 ID 时，补齐会话中保存的视频生成能力。"""
        if not self.model_id or self.model_id != fallback.model_id or self.generation_config is not None:
            return self
        return VideoModelSpec(model_id=self.model_id, generation_config=fallback.generation_config)

    @property
    def has_model(self) -> bool:
        """判断当前配置是否已经选择了视频模型。"""
        return bool(self.model_id)

    @property
    def video_generation_config(self) -> Optional[JsonObject]:
        """返回视频生成能力配置的 payload 形式。"""
        return self.generation_config.to_payload() if self.generation_config is not None else None

    def to_payload(self) -> Optional[JsonObject]:
        """转换为可持久化或注入 horizon 的视频模型 payload。"""
        if not self.model_id:
            return None
        payload: JsonObject = {"model_id": self.model_id}
        video_generation_config = self.video_generation_config
        if video_generation_config is not None:
            payload["video_generation_config"] = video_generation_config
        return payload


def normalize_model_id(model_id: object) -> Optional[str]:
    """归一化模型 ID：只接受非空字符串，其他输入统一视为未设置。"""
    if not isinstance(model_id, str):
        return None
    normalized = model_id.strip()
    return normalized or None


def _size_specs_from_raw(raw_sizes: object) -> tuple[ImageModelSizeSpec, ...]:
    """从原始尺寸列表中解析出有效的图片尺寸规格。"""
    if not isinstance(raw_sizes, Sequence) or isinstance(raw_sizes, (str, bytes)):
        return ()
    sizes = []
    for raw_size in raw_sizes:
        size = ImageModelSizeSpec.from_raw(raw_size)
        if size is not None:
            sizes.append(size)
    return tuple(sizes)
