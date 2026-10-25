"""Canvas 图片搜索与批量物化应用服务。"""

from __future__ import annotations

import hashlib
from collections.abc import Sequence
from fractions import Fraction
from pathlib import Path
from urllib.parse import urlparse

from app.tools.canvas.application.canvas_id import new_canvas_id
from app.tools.canvas.application.commands import LayoutCommand
from app.tools.canvas.application.results import CanvasImageSearchResult, ImageSearchItemResult, ImportedImageResult
from app.tools.canvas.domain.content_fields.image import ImageContentFields
from app.tools.canvas.domain.models import CanvasContent, CanvasElement, CanvasProject, ElementProperties
from app.tools.canvas.infrastructure.persistence.content_metadata_service import ContentMetadataService
from app.tools.canvas.production.contracts import ContentProductionRuleInterface, ImageSearchTask, ProductionResultType
from app.tools.canvas.production.ports import AssetDownloadPort, ImageSearchPort, ImageSearchRequest, MediaProbePort
from app.tools.canvas.repository import CanvasUnitOfWork
from app.tools.canvas.strategies import LayoutStrategyRegistry
from app.utils.async_file_utils import async_unlink


class ImageSearchService:
    """搜索、下载、探测并逐项创建 imported Image Element。"""

    def __init__(
        self,
        unit_of_work: CanvasUnitOfWork,
        search_port: ImageSearchPort,
        download_port: AssetDownloadPort,
        media_probe: MediaProbePort,
        layout_strategies: LayoutStrategyRegistry,
        production_rule: ContentProductionRuleInterface,
        workspace: Path,
    ) -> None:
        """显式绑定事务、外部端口、布局策略和工作区。"""
        self._unit_of_work = unit_of_work
        self._search_port = search_port
        self._download_port = download_port
        self._media_probe = media_probe
        self._layout_strategies = layout_strategies
        if production_rule.result_type is not ProductionResultType.BATCH_IMPORT:
            raise ValueError("image_search must produce a batch import result")
        self._production_rule = production_rule
        self._workspace = workspace

    async def search_and_import(self, project_path: str, topic_id: str, tasks: Sequence[ImageSearchTask], tool_context=None) -> CanvasImageSearchResult:
        """逐 task 搜索并只物化下载、探测成功的候选。"""
        await self._unit_of_work.repository.read(project_path)
        metadata = await self._unit_of_work.repository.read_sidecar(project_path)
        metadata["__canvas_runtime__"] = await self._unit_of_work.repository.read_sidecar_runtime(project_path)
        existing_urls = self._existing_topic_urls(metadata, topic_id)
        results: list[ImageSearchItemResult] = []
        for task in tasks:
            item_ref = task.item_ref
            name = task.name
            query = task.query
            requirement_explanation = task.requirement_explanation
            expected_aspect_ratio = task.expected_aspect_ratio
            count = task.count
            imported: list[dict[str, object]] = []
            failed = 0
            seen_urls = set(existing_urls)
            try:
                candidates = await self._search_port.search(ImageSearchRequest(query, count, expected_aspect_ratio, requirement_explanation))
            except Exception as error:
                results.append(ImageSearchItemResult(
                    item_ref=item_ref,
                    status="failed",
                    imported_count=0,
                    failed_count=0,
                    error=str(error)[:500],
                ))
                continue
            for index, candidate in enumerate(candidates):
                normalized_url = candidate.content_url.strip()
                if not normalized_url or normalized_url in seen_urls:
                    continue
                seen_urls.add(normalized_url)
                suffix = Path(urlparse(normalized_url).path).suffix.lower()
                if suffix not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
                    suffix = ".jpg"
                filename = f"{self._safe_name(name)}-{hashlib.sha1(normalized_url.encode()).hexdigest()[:10]}{suffix}"
                relative_path = f"./images/{filename}"
                absolute_path = self._workspace / project_path / relative_path[2:]
                try:
                    await self._download_port.download(normalized_url, absolute_path)
                    media = await self._media_probe.inspect_image(absolute_path)
                    if expected_aspect_ratio and not self._matches_aspect_ratio(media.width, media.height, expected_aspect_ratio):
                        raise ValueError("Downloaded image does not match the requested aspect ratio.")
                except Exception as error:
                    failed += 1
                    await async_unlink(absolute_path)
                    if failed >= count:
                        break
                    continue
                imported.append({
                    "source_url": normalized_url,
                    "host_page_url": candidate.host_page_url,
                    "name": f"{name}_{index + 1}" if count > 1 else name,
                    "src": relative_path,
                    "width": media.width,
                    "height": media.height,
                })
                if len(imported) >= count:
                    break
            if imported:
                persisted = await self._persist_imports(project_path, topic_id, item_ref, query, imported)
                existing_urls.update(str(item["source_url"]) for item in persisted if item.get("source_url"))
                results.append(ImageSearchItemResult(
                    item_ref=item_ref,
                    status="completed" if failed == 0 else "partial",
                    imported_count=len(persisted),
                    failed_count=failed,
                    items=tuple(
                        ImportedImageResult(
                            element_id=str(item["element_id"]),
                            content_id=str(item["content_id"]),
                            src=str(item["src"]),
                            name=str(item["name"]),
                            source_url=str(item["source_url"]),
                        )
                        for item in persisted
                    ),
                ))
            else:
                results.append(ImageSearchItemResult(
                    item_ref=item_ref,
                    status="failed",
                    imported_count=0,
                    failed_count=max(failed, 1),
                    error="No image candidate could be downloaded and validated.",
                ))
        return CanvasImageSearchResult(topic_id=topic_id, items=tuple(results))

    async def _persist_imports(self, project_path: str, topic_id: str, item_ref: str, query: str, items: list[dict[str, object]]) -> list[dict[str, object]]:
        """在一个项目事务内为已成功下载的图片创建 Element 和 Content。"""
        def mutate(project: CanvasProject, metadata: dict):
            created: list[dict[str, object]] = []
            for index, item in enumerate(items):
                element_id = new_canvas_id("element")
                content_id = new_canvas_id("content")
                width = item["width"]
                height = item["height"]
                if not isinstance(width, (int, float)) or isinstance(width, bool):
                    raise ValueError("Image width must be numeric.")
                if not isinstance(height, (int, float)) or isinstance(height, bool):
                    raise ValueError("Image height must be numeric.")
                element = CanvasElement(
                    element_id,
                    "image",
                    ElementProperties(name=str(item["name"]), width=float(width), height=float(height)),
                    contents=[CanvasContent(content_id, ImageContentFields(src=str(item["src"])))],
                    active_content_id=content_id,
                    main_content_id=content_id,
                )
                project.canvas.elements.append(element)
                self._layout_strategies.get("row_incremental").apply(project.canvas, element, LayoutCommand(strategy="row_incremental"), len(project.canvas.elements) - 1)
                detail = {
                    "elementId": element_id,
                    "source": "imported",
                    "assetPath": item["src"],
                    "sourceUrl": item["source_url"],
                    "hostPageUrl": item["host_page_url"],
                    "topicId": topic_id,
                    "query": query,
                    "itemRef": item_ref,
                }
                ContentMetadataService.set(metadata, element_id, content_id, detail)
                created.append({
                    "element_id": element_id,
                    "content_id": content_id,
                    "src": item["src"],
                    "name": item["name"],
                    "source_url": item["source_url"],
                })
            return created, metadata

        return await self._unit_of_work.transaction_with_sidecar(project_path, mutate)

    @staticmethod
    def _existing_topic_urls(metadata: dict, topic_id: str) -> set[str]:
        """读取 sidecar 中同一主题的来源 URL。"""
        urls: set[str] = set()
        documents = [metadata]
        runtime = metadata.get("__canvas_runtime__")
        if isinstance(runtime, dict):
            documents.append(runtime)
        for document in documents:
            elements = document.get("elements") if isinstance(document, dict) else None
            for element in elements.values() if isinstance(elements, dict) else []:
                details = element.get("contentDetails") if isinstance(element, dict) else None
                for detail in details.values() if isinstance(details, dict) else []:
                    if isinstance(detail, dict) and detail.get("topicId") == topic_id and detail.get("sourceUrl"):
                        urls.add(str(detail["sourceUrl"]))
        return urls

    @staticmethod
    def _safe_name(value: str) -> str:
        """将用户名称收窄为安全文件名。"""
        return "".join(char if char.isalnum() or char in "-_" else "_" for char in value).strip("_") or "image"

    @staticmethod
    def _matches_aspect_ratio(width: int, height: int, expected: str) -> bool:
        """按 5% 相对误差校验候选图片比例。"""
        try:
            left, right = expected.split(":", 1)
            target = float(Fraction(int(left), int(right)))
        except (ValueError, ZeroDivisionError):
            return True
        if width <= 0 or height <= 0 or target <= 0:
            return False
        return abs((width / height) - target) / target <= 0.05
