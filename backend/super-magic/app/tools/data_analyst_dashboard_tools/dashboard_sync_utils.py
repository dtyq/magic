from pathlib import Path
from typing import Any, Dict, List

from agentlang.context.tool_context import ToolContext
from agentlang.event.event import EventType
from agentlang.logger import get_logger

from app.tools.data_analyst_dashboard_tools.validators import (
    DataCleaningValidator,
    MagicProjectValidator,
    GeoJsonDownloader,
)


logger = get_logger(__name__)


async def sync_geo_and_data_sources(
    tool: Any,
    tool_context: ToolContext,
    project_path: Path,
    phase: str,
    extra_info: Dict[str, Any],
) -> None:
    """在 data.js 变更并通过严格校验后，同步地图 geo 配置与数据源配置。

    该函数封装了在 validate_dashboard 中已经存在的地图与数据源更新逻辑，
    便于在创建/更新卡片工具中复用，保持行为一致。

    Args:
        tool: 当前调用工具实例，用于分发文件事件（_dispatch_file_event）
        tool_context: 工具上下文
        project_path: Dashboard 项目根目录
        phase: 日志用的阶段描述，如 "创建卡片阶段"、"更新卡片阶段"
        extra_info: 用于补充返回给调用方的额外信息，函数内部会进行更新
    """
    try:
        magic_project_path = project_path / "magic.project.js"
        if not magic_project_path.exists():
            extra_info["magic_project_warning"] = (
                "magic.project.js 不存在，已跳过地图和数据源同步"
            )
            return

        magic_project_validator = MagicProjectValidator()

        # 1. 自动检测地图卡片并同步 geo 配置
        try:
            geojson_downloader = GeoJsonDownloader()
            area_names = await geojson_downloader.auto_detect_map_cards(project_path)

            if area_names:
                geo_dir = project_path / "geo"
                if not geo_dir.exists():
                    geo_dir.mkdir(parents=True, exist_ok=True)

                downloaded_files: List[str] = []
                geo_config_items: List[Dict[str, str]] = []

                for area_name in area_names:
                    try:
                        filename = geojson_downloader.convert_name_to_filename(
                            area_name
                        )
                        file_path, was_downloaded = await geojson_downloader.download_geojson(
                            filename,
                            geo_dir,
                            area_name,
                        )

                        if was_downloaded:
                            downloaded_files.append(str(file_path))
                            # 复用工具自身的事件分发逻辑
                            await tool._dispatch_file_event(  # type: ignore[attr-defined]
                                tool_context,
                                str(file_path),
                                EventType.FILE_CREATED,
                            )

                        map_name = geojson_downloader.generate_map_name(area_name)
                        geo_config_items.append(
                            {
                                "name": map_name,
                                "url": f"./geo/{file_path.name}",
                            }
                        )
                    except Exception as geo_err:
                        logger.warning(
                            "处理地图地区 %s 时出错（%s），已跳过该地区: %s",
                            area_name,
                            phase,
                            geo_err,
                        )

                if geo_config_items:
                    try:
                        added_geo_config_count, skipped_geo_config_count = (
                            await magic_project_validator.update_geo_config(
                                magic_project_path,
                                geo_config_items,
                            )
                        )
                        extra_info.update(
                            {
                                "geo_total_areas": len(area_names),
                                "geo_added": added_geo_config_count,
                                "geo_skipped": skipped_geo_config_count,
                                "geo_downloaded_files": downloaded_files,
                                "geo_config_items": geo_config_items,
                            }
                        )
                    except Exception as e:
                        logger.warning(
                            "更新 magic.project.js 中的 geo 配置失败（%s），已跳过: %s",
                            phase,
                            e,
                            exc_info=True,
                        )

        except Exception as e:
            logger.warning(
                "在 %s 自动检测/更新地图配置失败，已跳过: %s",
                phase,
                e,
                exc_info=True,
            )

        # 2. 自动扫描 cleaned_data 并同步数据源配置
        try:
            data_cleaning_validator = DataCleaningValidator()
            data_source_items = await data_cleaning_validator.scan_cleaned_data(
                project_path
            )
            data_source_count = await magic_project_validator.update_data_source_config(
                magic_project_path,
                data_source_items,
            )
            extra_info.update(
                {
                    "data_source_count": data_source_count,
                    "data_source_items": data_source_items,
                }
            )
        except ValueError as e:
            # 与 validate_dashboard 保持一致的错误信息，但不回滚已完成的卡片操作
            logger.error(
                "在 %s 更新数据源配置时发现数据格式问题（如非 CSV 文件），"
                "请检查 cleaned_data 目录: %s",
                phase,
                e,
            )
            extra_info["data_source_error"] = str(e)
        except Exception as e:
            logger.warning(
                "在 %s 自动更新数据源配置失败，已跳过: %s",
                phase,
                e,
                exc_info=True,
            )
    except Exception as e:
        logger.warning(
            "在 %s 同步地图/数据源配置过程出现异常，已整体跳过: %s",
            phase,
            e,
            exc_info=True,
        )

