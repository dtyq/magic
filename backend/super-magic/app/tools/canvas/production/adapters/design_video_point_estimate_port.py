"""Canvas 旧 Design 视频积分预估适配器。"""

from __future__ import annotations

import math
from pathlib import Path

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from app.infrastructure.magic_service.client import MagicServiceClient
from app.tools.canvas.generation.adapters.design_video_payload_builder import DesignVideoPayloadBuilder
from app.tools.canvas.production.contracts import NormalizedVideoProductionRequest
from app.tools.canvas.production.ports.video_point_estimate_port import VideoPointEstimatePort


logger = get_logger(__name__)


class DesignVideoPointEstimatePort(VideoPointEstimatePort):
    """调用旧 Design API 的视频积分预估接口。"""

    def __init__(self, workspace: Path) -> None:
        """保存请求转换器和 Magic Service 客户端。"""
        self._payload_builder = DesignVideoPayloadBuilder(workspace)
        self._client = MagicServiceClient()

    async def estimate_points(
        self,
        request: NormalizedVideoProductionRequest,
        tool_context: ToolContext | None,
    ) -> int | float:
        """构造 Design 视频请求并返回有效积分。"""
        payload = self._payload_builder.build(
            request.project_path,
            request.parameters,
            video_id="",
            file_dir="",
            tool_context=tool_context,
        )
        logger.info(
            "Canvas Design 视频积分预估请求: endpoint=POST /api/v1/design/estimate-video-points "
            "project_id={} project_path={} item_ref={} model_id={} task={} input_mode={} "
            "reference_counts={} generation={}",
            payload.get("project_id"),
            request.project_path,
            request.item_ref,
            payload.get("model_id"),
            payload.get("task"),
            payload.get("input_mode"),
            self._reference_counts(payload),
            payload.get("generation") or {},
        )
        try:
            response = await self._client.estimate_design_video_points(payload)
        except Exception as error:
            logger.exception(
                "Canvas Design 视频积分预估请求异常: project_path={} item_ref={} error={}",
                request.project_path,
                request.item_ref,
                error,
            )
            raise
        points = response.get("points")
        logger.info(
            "Canvas Design 视频积分预估响应: project_path={} item_ref={} points={} "
            "resource_type={} detail_keys={}",
            request.project_path,
            request.item_ref,
            points,
            response.get("resource_type") or "video",
            sorted(response.get("detail", {}).keys()) if isinstance(response.get("detail"), dict) else [],
        )
        if isinstance(points, bool) or not isinstance(points, (int, float)) or not math.isfinite(points) or points < 0:
            raise ValueError("Design video point estimate is missing valid points.")
        return points

    @staticmethod
    def _reference_counts(payload: dict[str, object]) -> dict[str, int]:
        """返回参考素材数量，避免日志记录具体素材 URI。"""
        inputs = payload.get("inputs")
        if not isinstance(inputs, dict):
            return {"images": 0, "videos": 0, "audios": 0, "frames": 0}
        return {
            "images": len(inputs.get("reference_images") or [])
            if isinstance(inputs.get("reference_images"), list)
            else 0,
            "videos": len(inputs.get("reference_videos") or [])
            if isinstance(inputs.get("reference_videos"), list)
            else 0,
            "audios": len(inputs.get("reference_audios") or [])
            if isinstance(inputs.get("reference_audios"), list)
            else 0,
            "frames": len(inputs.get("frames") or [])
            if isinstance(inputs.get("frames"), list)
            else 0,
        }
