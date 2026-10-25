"""Canvas Application Composition Root。"""

from __future__ import annotations

import os
from pathlib import Path

from agentlang.config.config import config
from agentlang.logger import get_logger
from app.core.config.debug_config import (
    get_canvas_fake_video_estimate_points,
    is_canvas_fake_video_estimate_enabled,
)
from app.tools.canvas.application import CanvasApplication
from app.tools.canvas.application.add_elements_service import AddElementsService
from app.tools.canvas.application.connection_service import ConnectionService
from app.tools.canvas.application.content_preparation_service import ContentPreparationService
from app.tools.canvas.application.content_service import ContentService
from app.tools.canvas.application.dependencies import CanvasApplicationDependencies
from app.tools.canvas.application.element_sizing_service import CanvasElementSizingService
from app.tools.canvas.application.frame_elements_service import FrameElementsService
from app.tools.canvas.application.generation_submission_service import GenerationSubmissionService
from app.tools.canvas.application.initialization_service import InitializationService
from app.tools.canvas.application.layout_service import LayoutService
from app.tools.canvas.application.retry_content_service import RetryContentService
from app.tools.canvas.application.wait_generation_service import WaitGenerationService
from app.tools.canvas.domain.services.element_reference_resolver import ElementReferenceResolver
from app.tools.canvas.generation import (
    CanvasGenerationResultApplier,
    GenerationCapabilityRegistry,
    GenerationExecutionStrategyRegistry,
    GenerationTaskPoller,
    GenerationTaskRepository,
    InMemoryGenerationTaskRepository,
    default_generation_capabilities,
)
from app.tools.canvas.hierarchy import HierarchyStrategyRegistry
from app.tools.canvas.infrastructure.assets import WorkspaceAssetGateway
from app.tools.canvas.infrastructure.persistence.canvas_repository_interface import CanvasRepositoryInterface
from app.tools.canvas.infrastructure.persistence.element_details_adapter import ElementDetailsAdapter
from app.tools.canvas.production.adapters import (
    DesignVideoPointEstimatePort,
    FakeAssetDownloadPort,
    FakeImageSearchPort,
    FakeMediaProbePort,
    FakeVideoCompositionPort,
    FakeVideoPointEstimatePort,
    FfmpegVideoCompositionPort,
    FileMediaProbePort,
    GenericImageSearchPort,
    WorkspaceAssetDownloadPort,
)
from app.tools.canvas.production.contracts import ContentProductionRuleRegistry
from app.tools.canvas.production.estimation import (
    ContentProductionCostEstimatorRegistry,
    CostEstimateRepositoryInterface,
    CostEstimateRequestNormalizerRegistry,
    InMemoryCostEstimateRepository,
    VideoCostEstimator,
    VideoProductionRequestNormalizer,
)
from app.tools.canvas.production.ports import AssetDownloadPort, ImageSearchPort, MediaProbePort, VideoCompositionPort
from app.tools.canvas.production.rules import (
    ImageGenerationRule,
    ImageSearchRule,
    VideoCompositionRule,
    VideoGenerationRule,
)
from app.tools.canvas.production.services.estimate_content_points_service import EstimateContentPointsService
from app.tools.canvas.production.services.image_search_service import ImageSearchService
from app.tools.canvas.production.services.video_composition_service import VideoCompositionService
from app.tools.canvas.queries import CanvasQueryService
from app.tools.canvas.repository import CanvasRepository, CanvasUnitOfWork
from app.tools.canvas.strategies import ConnectionStrategyRegistry, ContentStrategyRegistry, LayoutStrategyRegistry

_default_generation_tasks = InMemoryGenerationTaskRepository()
_default_cost_estimate_records = InMemoryCostEstimateRepository()
logger = get_logger(__name__)


class CanvasApplicationFactory:
    """在唯一 Composition Root 显式组装 Canvas Application。"""

    @classmethod
    def create_default(cls, workspace: Path) -> CanvasApplication:
        """为工具运行时创建默认 Canvas Application。"""
        return cls.create(CanvasRepository(workspace))

    @classmethod
    def create(
        cls,
        repository: CanvasRepositoryInterface,
        *,
        layout_strategies: LayoutStrategyRegistry | None = None,
        content_strategies: ContentStrategyRegistry | None = None,
        connection_strategies: ConnectionStrategyRegistry | None = None,
        generation_capabilities: GenerationCapabilityRegistry | None = None,
        generation_tasks: GenerationTaskRepository | None = None,
        cost_estimate_records: CostEstimateRepositoryInterface | None = None,
        video_composition_port: VideoCompositionPort | None = None,
        image_search_port: ImageSearchPort | None = None,
        asset_download_port: AssetDownloadPort | None = None,
        media_probe_port: MediaProbePort | None = None,
    ) -> CanvasApplication:
        """显式创建所有共享依赖和独立用例服务。"""
        workspace = repository.workspace
        selected_layout_strategies = layout_strategies if layout_strategies is not None else LayoutStrategyRegistry()
        selected_content_strategies = content_strategies if content_strategies is not None else ContentStrategyRegistry()
        selected_connection_strategies = connection_strategies if connection_strategies is not None else ConnectionStrategyRegistry()
        hierarchy_strategies = HierarchyStrategyRegistry()
        sidecar_adapter = ElementDetailsAdapter()
        selected_generation_capabilities = generation_capabilities if generation_capabilities is not None else GenerationCapabilityRegistry(
            capabilities=default_generation_capabilities(workspace)
        )
        selected_generation_tasks = generation_tasks if generation_tasks is not None else _default_generation_tasks
        selected_cost_records = cost_estimate_records if cost_estimate_records is not None else _default_cost_estimate_records
        video_normalizer = VideoProductionRequestNormalizer()
        normalizer_registry = CostEstimateRequestNormalizerRegistry([video_normalizer])
        use_fake_video_estimate = (
            os.getenv("CANVAS_FAKE_GENERATION") == "1"
            or is_canvas_fake_video_estimate_enabled()
        )
        point_port = (
            FakeVideoPointEstimatePort(get_canvas_fake_video_estimate_points())
            if use_fake_video_estimate
            else DesignVideoPointEstimatePort(workspace)
        )
        estimator_registry = ContentProductionCostEstimatorRegistry([VideoCostEstimator(point_port)])
        production_rules = ContentProductionRuleRegistry([
            ImageGenerationRule(),
            VideoGenerationRule(),
            VideoCompositionRule(),
            ImageSearchRule(),
        ])
        composition_port = video_composition_port if video_composition_port is not None else (
            FakeVideoCompositionPort() if os.getenv("CANVAS_FAKE_GENERATION") == "1" else FfmpegVideoCompositionPort()
        )
        selected_image_search_port = image_search_port if image_search_port is not None else (
            FakeImageSearchPort() if os.getenv("CANVAS_FAKE_GENERATION") == "1" else GenericImageSearchPort()
        )
        selected_download_port = asset_download_port if asset_download_port is not None else (
            FakeAssetDownloadPort() if os.getenv("CANVAS_FAKE_GENERATION") == "1" else WorkspaceAssetDownloadPort()
        )
        selected_media_probe = media_probe_port if media_probe_port is not None else (
            FakeMediaProbePort() if os.getenv("CANVAS_FAKE_GENERATION") == "1" else FileMediaProbePort()
        )
        dependencies = CanvasApplicationDependencies(
            repository=repository,
            unit_of_work=CanvasUnitOfWork(repository),
            layout_strategies=selected_layout_strategies,
            content_strategies=selected_content_strategies,
            connection_strategies=selected_connection_strategies,
            sidecar_adapter=sidecar_adapter,
            query_service=CanvasQueryService(repository, sidecar_adapter),
            generation_capabilities=selected_generation_capabilities,
            generation_tasks=selected_generation_tasks,
            asset_gateway=WorkspaceAssetGateway(workspace),
            hierarchy_strategies=hierarchy_strategies,
            frame_selection=hierarchy_strategies.get("frame_selection"),
            element_references=ElementReferenceResolver(),
            generation_execution=GenerationExecutionStrategyRegistry(),
            generation_poller=GenerationTaskPoller(),
            generation_result_applier=CanvasGenerationResultApplier(),
            production_rules=production_rules,
            cost_estimators=estimator_registry,
            cost_estimate_records=selected_cost_records,
            cost_request_normalizers=normalizer_registry,
            video_request_normalizer=video_normalizer,
            video_composition_port=composition_port,
            image_search_port=selected_image_search_port,
            asset_download_port=selected_download_port,
            media_probe_port=selected_media_probe,
        )
        return cls._assemble(dependencies)

    @staticmethod
    def _assemble(dependencies: CanvasApplicationDependencies) -> CanvasApplication:
        """根据完整依赖对象显式组装所有 Application Service。"""
        content_preparation = ContentPreparationService(
            content_strategies=dependencies.content_strategies,
            asset_gateway=dependencies.asset_gateway,
        )
        element_sizing = CanvasElementSizingService(
            workspace=dependencies.repository.workspace,
            media_probe=dependencies.media_probe_port,
        )
        generation_submission = GenerationSubmissionService(
            unit_of_work=dependencies.unit_of_work,
            generation_capabilities=dependencies.generation_capabilities,
            generation_tasks=dependencies.generation_tasks,
            generation_execution=dependencies.generation_execution,
            generation_result_applier=dependencies.generation_result_applier,
            element_sizing=element_sizing,
            max_concurrency=CanvasApplicationFactory._generation_max_concurrency(),
        )
        video_composition_service = VideoCompositionService(
            unit_of_work=dependencies.unit_of_work,
            composition_port=dependencies.video_composition_port,
            production_rule=dependencies.production_rules.get("video_composition"),
            workspace=dependencies.repository.workspace,
        )
        return CanvasApplication(
            repository=dependencies.repository,
            query_service=dependencies.query_service,
            initialization_service=InitializationService(repository=dependencies.repository),
            add_elements_service=AddElementsService(
                unit_of_work=dependencies.unit_of_work,
                layout_strategies=dependencies.layout_strategies,
                connection_strategies=dependencies.connection_strategies,
                element_references=dependencies.element_references,
                content_preparation=content_preparation,
                generation_submission_service=generation_submission,
                element_sizing=element_sizing,
                video_composition_service=video_composition_service,
            ),
            frame_elements_service=FrameElementsService(
                unit_of_work=dependencies.unit_of_work,
                frame_selection=dependencies.frame_selection,
            ),
            content_service=ContentService(
                unit_of_work=dependencies.unit_of_work,
                content_preparation=content_preparation,
                generation_submission_service=generation_submission,
            ),
            retry_content_service=RetryContentService(
                repository=dependencies.repository,
                unit_of_work=dependencies.unit_of_work,
                generation_submission_service=generation_submission,
                video_composition_service=video_composition_service,
            ),
            layout_service=LayoutService(
                unit_of_work=dependencies.unit_of_work,
                layout_strategies=dependencies.layout_strategies,
            ),
            connection_service=ConnectionService(
                unit_of_work=dependencies.unit_of_work,
                connection_strategies=dependencies.connection_strategies,
            ),
            wait_generation_service=WaitGenerationService(
                repository=dependencies.repository,
                unit_of_work=dependencies.unit_of_work,
                generation_capabilities=dependencies.generation_capabilities,
                generation_tasks=dependencies.generation_tasks,
                generation_poller=dependencies.generation_poller,
                generation_result_applier=dependencies.generation_result_applier,
                element_sizing=element_sizing,
            ),
            estimate_content_points_service=EstimateContentPointsService(
                repository=dependencies.repository,
                rules=dependencies.production_rules,
                estimators=dependencies.cost_estimators,
                estimate_records=dependencies.cost_estimate_records,
                normalizers=dependencies.cost_request_normalizers,
            ),
            image_search_service=ImageSearchService(
                unit_of_work=dependencies.unit_of_work,
                search_port=dependencies.image_search_port,
                download_port=dependencies.asset_download_port,
                media_probe=dependencies.media_probe_port,
                layout_strategies=dependencies.layout_strategies,
                production_rule=dependencies.production_rules.get("image_search"),
                workspace=dependencies.repository.workspace,
            ),
            generation_submission_service=generation_submission,
        )

    @staticmethod
    def _generation_max_concurrency() -> int:
        """读取并发生成上限，非法配置时安全降级为串行。"""
        value = config.get("canvas.generation_max_concurrency", 4)
        try:
            normalized = int(value)
        except (TypeError, ValueError):
            logger.warning(
                "Canvas generation concurrency config is invalid; fallback to serial execution: value={}",
                value,
            )
            return 1
        if normalized <= 0:
            logger.warning(
                "Canvas generation concurrency config must be greater than zero; fallback to serial execution: value={}",
                value,
            )
            return 1
        return normalized
