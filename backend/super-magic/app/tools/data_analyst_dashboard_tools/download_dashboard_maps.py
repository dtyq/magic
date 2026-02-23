"""手动下载Dashboard地图GeoJSON工具

支持按地区名称手动下载GeoJSON文件并更新 magic.project.js 中的 geo 配置。
通常无需手动下载，因为 create_dashboard_cards、update_dashboard_cards、validate_dashboard 时会自动下载地图。
"""

from pathlib import Path
from typing import Any, Dict, List

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from agentlang.event.event import EventType
from agentlang.logger import get_logger
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.workspace_tool import WorkspaceTool
from app.tools.abstract_file_tool import AbstractFileTool

from app.tools.data_analyst_dashboard_tools.validators import (
    GeoJsonDownloader,
    MagicProjectValidator,
)

logger = get_logger(__name__)


class DownloadDashboardMapsParams(BaseToolParams):
    """手动下载地图参数"""

    project_path: str = Field(
        ...,
        description="""<!--zh: 看板项目路径，相对于工作区根目录，如 "销售分析看板" 或 "SalesDashboard"-->
Dashboard project path, relative to workspace root, e.g. "SalesDashboard" """
    )

    area_names: List[str] = Field(
        ...,
        description="""<!--zh: 要下载的地区名称列表（1-10个），支持：中国、 provinces（如广东省、北京市）、major_city（如深圳市、广州市）。需使用精确名称，可参考 geojson_area_codes.json-->
Area names to download (1-10), supports: China, provinces (e.g. Guangdong Province, Beijing City), major_city (e.g. Shenzhen City, Guangzhou City). Use exact names from geojson_area_codes.json""",
        min_length=1,
        max_length=10,
    )

    @field_validator("project_path")
    @classmethod
    def validate_project_path(cls, v: str) -> str:
        if not v or not isinstance(v, str) or not v.strip():
            raise ValueError("project_path cannot be empty")
        return v.strip()

    @field_validator("area_names")
    @classmethod
    def validate_area_names(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("area_names cannot be empty")
        return [a.strip() for a in v if a and isinstance(a, str) and a.strip()]


@tool()
class DownloadDashboardMaps(
    AbstractFileTool[DownloadDashboardMapsParams], WorkspaceTool[DownloadDashboardMapsParams]
):
    """<!--zh
    手动下载Dashboard地图GeoJSON工具

    通常无需手动下载，因为 create_dashboard_cards、update_dashboard_cards、validate_dashboard 时会自动下载地图。

    【调用时机】创建/更新地图卡片前，或 validate_dashboard 未自动下载到所需地图时

    【主要用途】按地区名称显式下载 GeoJSON，适用于：
    - 计划创建地图卡片但尚未写入 data.js 时预先下载
    - 补充自动检测遗漏的地区
    - 网络环境导致自动下载失败后重试

    【area_names】使用精确中文名称，如：中国、广东省、深圳市、北京市、上海市
    -->
    Manual download Dashboard map GeoJSON tool

    Usually no need to download manually, as maps are auto-downloaded by create_dashboard_cards, update_dashboard_cards, and validate_dashboard. 
    
    【When to use】Before creating map cards, or when validate_dashboard didn't download needed maps.

    【area_names】Use exact Chinese names: China, Guangdong Province, Shenzhen City, Beijing City, Shanghai City.
    """

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        if not arguments or "project_path" not in arguments:
            return i18n.translate("unknown.message", category="tool.messages")
        project_path = arguments["project_path"]
        if not result.ok:
            return i18n.translate("download_dashboard_maps.error", category="tool.messages", error=result.content or "")
        extra = result.extra_info or {}
        downloaded = extra.get("downloaded_count", 0)
        skipped = extra.get("skipped_count", 0)
        failed = extra.get("failed_areas", [])
        remark = i18n.translate("download_dashboard_maps.success", category="tool.messages",
            project_path=project_path,
            downloaded_count=downloaded,
            skipped_count=skipped)
        if failed:
            remark += " 失败: " + ", ".join(failed)
        return remark

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        if not result.ok:
            return {
                "action": i18n.translate("download_dashboard_maps", category="tool.actions"),
                "remark": i18n.translate("download_dashboard_maps.error", category="tool.messages", error=result.content or ""),
            }
        return {
            "action": i18n.translate("download_dashboard_maps", category="tool.actions"),
            "remark": self._get_remark_content(result, arguments),
        }

    async def execute(
        self, tool_context: ToolContext, params: DownloadDashboardMapsParams
    ) -> ToolResult:
        try:
            project_dir = self.resolve_path(params.project_path)
            if not project_dir or not project_dir.exists():
                return ToolResult.error(f"Project does not exist: {params.project_path}")

            magic_project_path = project_dir / "magic.project.js"
            if not magic_project_path.exists():
                return ToolResult.error("magic.project.js does not exist")

            geo_dir = project_dir / "geo"
            geo_dir.mkdir(parents=True, exist_ok=True)

            geojson_downloader = GeoJsonDownloader()
            magic_project_validator = MagicProjectValidator()

            downloaded_files: List[str] = []
            geo_config_items: List[Dict[str, str]] = []
            failed_areas: List[str] = []
            skipped_count = 0

            for area_name in params.area_names:
                try:
                    filename = geojson_downloader.convert_name_to_filename(area_name)
                    file_path, was_downloaded = await geojson_downloader.download_geojson(
                        filename, geo_dir, area_name
                    )

                    if was_downloaded:
                        downloaded_files.append(str(file_path))
                        await self._dispatch_file_event(
                            tool_context, str(file_path), EventType.FILE_CREATED
                        )
                    else:
                        skipped_count += 1

                    map_name = geojson_downloader.generate_map_name(area_name)
                    geo_config_items.append({
                        "name": map_name,
                        "url": f"./geo/{file_path.name}",
                    })
                except Exception as e:
                    logger.warning("下载地图 %s 失败: %s", area_name, e)
                    failed_areas.append(f"{area_name}({e})")

            if failed_areas and not geo_config_items:
                return ToolResult(
                    error=f"All areas failed to download. Errors: {'; '.join(failed_areas)}"
                )

            if geo_config_items:
                try:
                    added, _ = await magic_project_validator.update_geo_config(
                        magic_project_path, geo_config_items
                    )
                except Exception as e:
                    logger.warning("更新 geo 配置失败: %s", e)
                    return ToolResult.error(f"Failed to update geo config: {e}")

            summary_parts = [
                f"Downloaded: {len(downloaded_files)}, "
                f"Skipped (already exists): {skipped_count}, "
                f"Geo config updated."
            ]
            if failed_areas:
                summary_parts.append(f" Failed: {', '.join(failed_areas)}")

            return ToolResult(
                content=" ".join(summary_parts),
                extra_info={
                    "project_path": params.project_path,
                    "downloaded_count": len(downloaded_files),
                    "skipped_count": skipped_count,
                    "downloaded_files": downloaded_files,
                    "geo_config_items": geo_config_items,
                    "failed_areas": failed_areas,
                },
            )
        except Exception as e:
            logger.error("手动下载地图失败: %s", e, exc_info=True)
            return ToolResult.error(f"Failed to download maps: {e}")
