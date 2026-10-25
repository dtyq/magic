"""Canvas Application 依赖组装模型。"""

from dataclasses import dataclass

from app.tools.canvas.domain.services.element_reference_resolver import ElementReferenceResolver
from app.tools.canvas.generation import (
    CanvasGenerationResultApplier,
    GenerationCapabilityRegistry,
    GenerationExecutionStrategyRegistry,
    GenerationTaskPoller,
    GenerationTaskRepository,
)
from app.tools.canvas.hierarchy import HierarchyStrategyRegistry
from app.tools.canvas.infrastructure.assets import AssetGateway
from app.tools.canvas.infrastructure.persistence.canvas_repository_interface import CanvasRepositoryInterface
from app.tools.canvas.infrastructure.persistence.element_details_adapter import ElementDetailsAdapter
from app.tools.canvas.production.contracts import ContentProductionRuleRegistry
from app.tools.canvas.production.estimation import (
    ContentProductionCostEstimatorRegistry,
    CostEstimateRepositoryInterface,
    CostEstimateRequestNormalizerRegistry,
    VideoProductionRequestNormalizer,
)
from app.tools.canvas.production.ports import AssetDownloadPort, ImageSearchPort, MediaProbePort, VideoCompositionPort
from app.tools.canvas.queries import CanvasQueryService
from app.tools.canvas.repository import CanvasUnitOfWork
from app.tools.canvas.strategies import ConnectionStrategyRegistry, ContentStrategyRegistry, LayoutStrategyRegistry
from app.tools.canvas.strategies.hierarchy.interface import HierarchyStrategyInterface


@dataclass
class CanvasApplicationDependencies:
    """保存 Composition Root 明确组装后的共享端口和策略。"""

    repository: CanvasRepositoryInterface
    unit_of_work: CanvasUnitOfWork
    layout_strategies: LayoutStrategyRegistry
    content_strategies: ContentStrategyRegistry
    connection_strategies: ConnectionStrategyRegistry
    sidecar_adapter: ElementDetailsAdapter
    query_service: CanvasQueryService
    generation_capabilities: GenerationCapabilityRegistry
    generation_tasks: GenerationTaskRepository
    asset_gateway: AssetGateway
    hierarchy_strategies: HierarchyStrategyRegistry
    frame_selection: HierarchyStrategyInterface
    element_references: ElementReferenceResolver
    generation_execution: GenerationExecutionStrategyRegistry
    generation_poller: GenerationTaskPoller
    generation_result_applier: CanvasGenerationResultApplier
    production_rules: ContentProductionRuleRegistry
    cost_estimators: ContentProductionCostEstimatorRegistry
    cost_estimate_records: CostEstimateRepositoryInterface
    cost_request_normalizers: CostEstimateRequestNormalizerRegistry
    video_request_normalizer: VideoProductionRequestNormalizer
    video_composition_port: VideoCompositionPort
    image_search_port: ImageSearchPort
    asset_download_port: AssetDownloadPort
    media_probe_port: MediaProbePort
