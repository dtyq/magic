"""Review source asset candidates and copy only selected assets into the final template.

Skill: agents/skills/slide-template-maker/SKILL.md
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.i18n import i18n
from app.tools.core import BaseToolParams, tool
from app.tools.slide_template_builder.common import (
    ANALYSIS_DIR_NAME,
    SOURCE_ANALYSIS_FILE,
    SlideTemplateBuilderError,
    display_template_name,
    resolve_template_working_directory,
    resolve_workspace_template_dir,
    validate_template_directory,
)
from app.tools.workspace_tool import WorkspaceTool
from app.utils.async_file_utils import (
    async_copy2,
    async_exists,
    async_is_file,
    async_mkdir,
    async_read_json,
    async_rmtree,
    async_write_json,
)

ASSET_TARGET_PATTERN = r"^[a-z0-9][a-z0-9-]*\.[a-z0-9]+$"
AssetDecision = Literal["reuse", "discard"]
AssetQuality = Literal["high", "acceptable", "poor"]
AssetType = Literal[
    "illustration",
    "photo",
    "texture",
    "icon",
    "logo",
    "screenshot",
    "diagram",
    "other",
]
DECISION_OBJECT_EXAMPLE = (
    '{"asset": "asset-01", "decision": "discard", "asset_type": "photo", '
    '"quality": "poor", "rationale": "Unused low-resolution crop."}'
)
DECISIONS_USAGE_ERROR = (
    "Each decisions item must be a complete object with asset and decision. "
    f"Example: {DECISION_OBJECT_EXAMPLE} "
    "quality must be high, acceptable, or poor. "
    "asset_type must be illustration, photo, texture, icon, logo, screenshot, diagram, or other. "
    "Send 1-8 items per call and repeat until pending_count is 0."
)
_DECISION_ALIASES = {
    "keep": "reuse",
    "use": "reuse",
    "select": "reuse",
    "drop": "discard",
    "skip": "discard",
    "reject": "discard",
    "remove": "discard",
}
_QUALITY_ALIASES = {
    "low": "poor",
    "bad": "poor",
    "medium": "acceptable",
    "ok": "acceptable",
    "okay": "acceptable",
    "good": "high",
    "unknown": "acceptable",
}
_TYPE_ALIASES = {
    "photograph": "photo",
    "image": "photo",
    "picture": "photo",
    "graphic": "illustration",
    "artwork": "illustration",
    "svg": "illustration",
    "mascot": "illustration",
    "vector": "illustration",
    "unknown": "other",
}


def _first_text(data: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _normalize_choice(value: str | None, aliases: dict[str, str]) -> str | None:
    if value is None:
        return None
    lowered = value.strip().lower()
    return aliases.get(lowered, lowered)


def _semantic_target_name(raw: str | None, asset_id: str, extension: str) -> str:
    stem = Path(raw or "").stem if raw else ""
    if not stem:
        stem = asset_id
    stem = re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-") or "asset"
    ext = extension if extension.startswith(".") else f".{extension}"
    return f"{stem}{ext.lower()}"


class SourceAssetDecisionParams(BaseModel):
    asset: str = Field(..., description="Public catalog id such as asset-01, or a legacy asset_catalog[].asset path.")
    decision: AssetDecision
    asset_type: AssetType
    quality: AssetQuality
    rationale: str = Field(..., min_length=3, max_length=1000)
    target_name: Optional[str] = Field(None, description="Semantic output filename for a reused asset.")
    intended_role: Optional[str] = Field(None, max_length=500)

    @model_validator(mode="before")
    @classmethod
    def normalize_decision_payload(cls, value: Any) -> Any:
        if isinstance(value, str):
            raise ValueError(DECISIONS_USAGE_ERROR)
        if not isinstance(value, dict):
            return value
        normalized = dict(value)
        asset = _first_text(value, ("asset", "id"))
        if asset:
            normalized["asset"] = asset
        decision = _normalize_choice(_first_text(value, ("decision", "action")), _DECISION_ALIASES)
        if decision:
            normalized["decision"] = decision
        asset_type = _normalize_choice(_first_text(value, ("asset_type", "type")), _TYPE_ALIASES)
        if asset_type:
            normalized["asset_type"] = asset_type
        quality = _normalize_choice(_first_text(value, ("quality",)), _QUALITY_ALIASES)
        if quality:
            normalized["quality"] = quality
        rationale = _first_text(value, ("rationale", "note", "reason"))
        if rationale:
            normalized["rationale"] = rationale
        intended_role = _first_text(value, ("intended_role", "role"))
        if intended_role:
            normalized["intended_role"] = intended_role
        return normalized

    @field_validator("asset", "rationale")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("value cannot be empty")
        return value

    @field_validator("target_name", "intended_role")
    @classmethod
    def strip_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @model_validator(mode="after")
    def validate_decision(self) -> "SourceAssetDecisionParams":
        if self.decision == "reuse":
            if self.quality == "poor":
                raise ValueError("poor-quality assets cannot be reused")
            if not self.intended_role:
                self.intended_role = self.rationale
        else:
            self.target_name = None
        return self


class SelectSlideTemplateSourceAssetsParams(BaseToolParams):
    template_dir: str = Field(
        ...,
        description="""<!--zh: 已调用 prepare_slide_template_source 的模板目录。-->
Template directory previously prepared by prepare_slide_template_source.""",
    )
    decisions: list[SourceAssetDecisionParams] = Field(
        ...,
        min_length=1,
        description="""<!--zh: 本次要写入的素材审核决策。可分批调用，asset 必须使用 asset_catalog[].id（如 asset-01）。-->
One batch of complete review objects. Repeat until every catalog asset is decided. Use exact asset_catalog[].id values such as asset-01, not document-converter filenames.""",
    )

    @classmethod
    def get_custom_error_message(cls, field_name: str, error_type: str) -> Optional[str]:
        if field_name == "decisions":
            return DECISIONS_USAGE_ERROR
        return None

    @field_validator("decisions", mode="before")
    @classmethod
    def reject_decision_mapping(cls, value: Any) -> Any:
        if isinstance(value, dict):
            raise ValueError(DECISIONS_USAGE_ERROR)
        return value

    @field_validator("template_dir")
    @classmethod
    def strip_template_dir(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("template_dir is required")
        return value


def _catalog_lookups(
    catalog: list[dict[str, Any]],
) -> tuple[dict[str, dict[str, Any]], dict[str, str], dict[str, list[str]], dict[str, str]]:
    by_asset: dict[str, dict[str, Any]] = {}
    by_source_file: dict[str, str] = {}
    by_basename: dict[str, list[str]] = {}
    by_id: dict[str, str] = {}
    for item in catalog:
        if not isinstance(item, dict):
            continue
        asset = item.get("asset")
        if not isinstance(asset, str) or not asset:
            continue
        by_asset[asset] = item
        source_file = item.get("source_file")
        if isinstance(source_file, str) and source_file:
            by_source_file[source_file] = asset
        by_basename.setdefault(Path(asset).name, []).append(asset)
        public_id = item.get("id")
        if isinstance(public_id, str) and public_id:
            by_id[public_id] = asset
    return by_asset, by_source_file, by_basename, by_id


def _resolve_decision_asset(
    raw: str,
    by_asset: dict[str, dict[str, Any]],
    by_source_file: dict[str, str],
    by_basename: dict[str, list[str]],
    by_id: dict[str, str],
) -> str | None:
    if raw in by_id:
        return by_id[raw]
    candidates = [raw]
    prefix = f"{ANALYSIS_DIR_NAME}/"
    if raw.startswith(prefix):
        candidates.append(raw[len(prefix):])
    for key in candidates:
        if key in by_asset:
            return key
        if key in by_source_file:
            return by_source_file[key]
    matches = by_basename.get(Path(raw).name, [])
    if len(matches) == 1:
        return matches[0]
    return None


def _catalog_ref(item: dict[str, Any]) -> str:
    return str(item.get("id") or item.get("asset") or "")


def _format_asset_ids(asset_ids: list[str], limit: int = 20) -> str:
    preview = asset_ids[:limit]
    suffix = "" if len(asset_ids) <= limit else f", ... ({len(asset_ids) - limit} more)"
    return ", ".join(preview) + suffix


def _resolve_source_asset(work_dir: Path, relative_path: str) -> Path:
    resolved = (work_dir / relative_path).resolve(strict=False)
    analysis_root = (work_dir / ANALYSIS_DIR_NAME / "source-assets").resolve(strict=False)
    try:
        resolved.relative_to(analysis_root)
    except ValueError as exc:
        raise SlideTemplateBuilderError(f"Source asset path escapes source-assets/: {relative_path}") from exc
    return resolved


@tool(name="select_slide_template_source_assets", code_mode_only=True)
class SelectSlideTemplateSourceAssets(WorkspaceTool[SelectSlideTemplateSourceAssetsParams]):
    """<!--zh
    审核 PPT 原素材，只把高质量且会在最终模板中使用的图片和插画复制到 images/source-assets/。
    -->
    Review original PPT assets and copy only high-quality images and illustrations selected for final use into images/source-assets/.
    """

    name = "select_slide_template_source_assets"

    async def execute(self, tool_context: ToolContext, params: SelectSlideTemplateSourceAssetsParams) -> ToolResult:
        template_dir = resolve_workspace_template_dir(Path(self.base_dir), params.template_dir)
        final_assets_dir = template_dir / "images" / "source-assets"
        try:
            metadata = await async_read_json(template_dir / "template.json")
            validate_template_directory(template_dir, metadata)
            work_dir = resolve_template_working_directory(template_dir, str(metadata.get("template_id") or ""))
            analysis_file = work_dir / SOURCE_ANALYSIS_FILE
            if not await async_is_file(analysis_file):
                raise SlideTemplateBuilderError("Call prepare_slide_template_source before selecting source assets.")
            analysis = await async_read_json(analysis_file)
            catalog = analysis.get("asset_catalog")
            if not isinstance(catalog, list):
                raise SlideTemplateBuilderError("source-analysis.json asset_catalog must be an array.")

            catalog_by_asset, catalog_by_source_file, catalog_by_basename, catalog_by_id = _catalog_lookups(catalog)
            if len(catalog_by_asset) != len(catalog):
                raise SlideTemplateBuilderError(
                    "source-analysis.json asset_catalog contains invalid or duplicate asset identifiers."
                )
            resolved_decisions: dict[str, SourceAssetDecisionParams] = {}
            unknown: list[str] = []
            for item in params.decisions:
                resolved = _resolve_decision_asset(
                    item.asset,
                    catalog_by_asset,
                    catalog_by_source_file,
                    catalog_by_basename,
                    catalog_by_id,
                )
                if resolved is None:
                    unknown.append(item.asset)
                    continue
                if resolved in resolved_decisions:
                    raise SlideTemplateBuilderError("Each source asset must have exactly one decision.")
                resolved_decisions[resolved] = item
            if unknown:
                expected_ids = [_catalog_ref(item) for item in catalog if isinstance(item, dict)]
                raise SlideTemplateBuilderError(
                    "Asset decisions must use exact asset_catalog[].id identifiers; unknown assets: "
                    + ", ".join(unknown)
                    + "; expected catalog asset ids: "
                    + _format_asset_ids(expected_ids)
                )

            for asset_name, decision in list(resolved_decisions.items()):
                catalog_item = catalog_by_asset[asset_name]
                source_file = str(catalog_item.get("source_file") or "")
                source_path = _resolve_source_asset(work_dir, source_file)
                if not await async_is_file(source_path):
                    raise SlideTemplateBuilderError(f"Extracted source asset is missing: {source_file}")
                if decision.decision != "reuse":
                    continue
                source_extension = Path(str(catalog_item.get("asset") or asset_name)).suffix.lower()
                if not source_extension:
                    raise SlideTemplateBuilderError(
                        f"Extracted source asset is missing a file extension: {_catalog_ref(catalog_item)}"
                    )
                target_name = _semantic_target_name(
                    decision.target_name,
                    str(catalog_item.get("id") or asset_name),
                    source_extension,
                )
                if not re.fullmatch(ASSET_TARGET_PATTERN, target_name):
                    raise SlideTemplateBuilderError(
                        f"Could not build a semantic target_name for {_catalog_ref(catalog_item)}"
                    )
                resolved_decisions[asset_name] = decision.model_copy(update={"target_name": target_name})

            selected_names = [
                item.target_name
                for item in resolved_decisions.values()
                if item.decision == "reuse"
            ]
            existing_selected_names = [
                str(item.get("target_name") or "")
                for asset_name, item in catalog_by_asset.items()
                if asset_name not in resolved_decisions
                and item.get("decision") == "reuse"
                and item.get("target_name")
            ]
            all_selected_names = selected_names + existing_selected_names
            if len(all_selected_names) != len(set(all_selected_names)):
                raise SlideTemplateBuilderError("Reused source assets must use unique target_name values.")

            for asset_name, decision in resolved_decisions.items():
                catalog_item = catalog_by_asset[asset_name]
                catalog_item.update({
                    "decision": decision.decision,
                    "asset_type": decision.asset_type,
                    "quality": decision.quality,
                    "rationale": decision.rationale,
                    "intended_role": decision.intended_role or "",
                    "target_name": decision.target_name,
                    "final_file": None,
                })

            if await async_exists(final_assets_dir):
                await async_rmtree(final_assets_dir)
            await async_mkdir(final_assets_dir, parents=True, exist_ok=False)

            selected_files = []
            discarded_assets = []
            pending_assets = []
            for asset_name, catalog_item in catalog_by_asset.items():
                decision_name = str(catalog_item.get("decision") or "pending")
                if decision_name == "reuse":
                    target_name = str(catalog_item.get("target_name") or "")
                    source_file = str(catalog_item.get("source_file") or "")
                    final_file = f"images/source-assets/{target_name}"
                    await async_copy2(_resolve_source_asset(work_dir, source_file), template_dir / final_file)
                    catalog_item["final_file"] = final_file
                    selected_files.append(final_file)
                elif decision_name == "discard":
                    catalog_item["final_file"] = None
                    discarded_assets.append(_catalog_ref(catalog_item))
                else:
                    pending_assets.append(_catalog_ref(catalog_item))

            await async_write_json(analysis_file, analysis, ensure_ascii=False, indent=2)
            data = {
                "template_id": metadata["template_id"],
                "template_directory": str(template_dir),
                "selected_files": selected_files,
                "discarded_assets": discarded_assets,
                "pending_assets": pending_assets,
                "selected_count": len(selected_files),
                "discarded_count": len(discarded_assets),
                "pending_count": len(pending_assets),
                "source_analysis": str(analysis_file),
            }
            pending_note = ""
            if pending_assets:
                pending_note = (
                    f" Pending {len(pending_assets)} asset(s) still need a decision: "
                    + _format_asset_ids(pending_assets)
                    + ". Call select_slide_template_source_assets again with those exact catalog ids."
                )
            return ToolResult(
                content=(
                    f"Source asset review updated: selected {len(selected_files)} asset(s) and discarded "
                    f"{len(discarded_assets)} asset(s).{pending_note} "
                    "Reference every selected file from final HTML or CSS."
                ),
                data=data,
                extra_info=data,
            )
        except SlideTemplateBuilderError as exc:
            return ToolResult.error(str(exc))
        except Exception as exc:
            return ToolResult.error(f"Failed to select slide template source assets: {exc}")

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] | None = None
    ) -> Dict:
        template_dir = display_template_name((arguments or {}).get("template_dir"))
        return {
            "tool_name": tool_name,
            "action": i18n.translate("select_slide_template_source_assets", category="tool.actions"),
            "remark": i18n.translate(
                "select_slide_template_source_assets.before",
                category="tool.messages",
                template_dir=template_dir,
            ),
        }

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] | None = None,
    ) -> Dict:
        data = result.data if isinstance(result.data, dict) else {}
        template_dir = display_template_name(
            data.get("template_directory") or (arguments or {}).get("template_dir")
        )
        key = (
            "select_slide_template_source_assets.after_success"
            if result.ok
            else "select_slide_template_source_assets.after_failed"
        )
        return {
            "tool_name": tool_name,
            "action": i18n.translate("select_slide_template_source_assets", category="tool.actions"),
            "remark": i18n.translate(key, category="tool.messages", template_dir=template_dir),
        }

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] | None = None
    ) -> Optional[ToolDetail]:
        data = result.data if isinstance(result.data, dict) else {}
        if result.ok:
            content = "\n".join([
                "# Slide template source assets",
                "",
                f"- Selected: {data.get('selected_count', 0)}",
                f"- Discarded: {data.get('discarded_count', 0)}",
                f"- Pending: {data.get('pending_count', 0)}",
                f"- Final files: {', '.join(data.get('selected_files', [])) or '-'}",
            ])
        else:
            content = f"# Source asset selection failed\n\n{result.content}"
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(file_name="slide_template_source_assets.md", content=content),
        )
