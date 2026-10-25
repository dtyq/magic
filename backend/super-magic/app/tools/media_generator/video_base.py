"""视频生成驱动抽象。"""

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class VideoGenerationRequest:
    """统一的视频生成请求。"""

    payload: Dict[str, Any]
    output_path: Path
    relative_output_path: str
    width: int
    height: int
    duration_seconds: float
    interruption_event: Optional[asyncio.Event] = None


@dataclass(frozen=True)
class VideoGenerationResponse:
    """统一的视频生成响应。"""

    status: str
    completed: bool
    src: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    provider_response: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)


class BaseVideoGeneratorHandler(ABC):
    """视频生成 Handler 抽象基类。"""

    @property
    @abstractmethod
    def name(self) -> str:
        """返回 Handler 名称。"""

    @abstractmethod
    def is_available(self) -> bool:
        """检查 Handler 是否可用。"""

    @abstractmethod
    async def generate(self, request: VideoGenerationRequest) -> VideoGenerationResponse:
        """执行视频生成。"""
