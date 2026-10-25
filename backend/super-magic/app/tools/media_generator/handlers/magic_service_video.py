"""Magic Service 视频生成 Handler。"""

from app.infrastructure.magic_service.client import MagicServiceClient
from app.tools.media_generator.video_base import (
    BaseVideoGeneratorHandler,
    VideoGenerationRequest,
    VideoGenerationResponse,
)


class MagicServiceVideoHandler(BaseVideoGeneratorHandler):
    """通过 Magic Service 提交后台托管视频生成任务。"""

    def __init__(self) -> None:
        """初始化可复用的 Magic Service Client。"""
        self._client = MagicServiceClient()

    @property
    def name(self) -> str:
        """返回 Handler 名称。"""
        return "magic_service"

    def is_available(self) -> bool:
        """Magic Service 的具体配置由 Client 在请求时校验。"""
        return True

    async def generate(self, request: VideoGenerationRequest) -> VideoGenerationResponse:
        """校验远程必需字段并提交视频生成任务。"""
        for field_name in ("project_id", "model_id", "file_dir"):
            if not request.payload.get(field_name):
                raise ValueError(f"Missing required video generation field: {field_name}")
        response = await self._client.generate_design_video(request.payload)
        return VideoGenerationResponse(
            status=str(response.get("status") or "running"),
            completed=False,
            provider_response=response,
        )
