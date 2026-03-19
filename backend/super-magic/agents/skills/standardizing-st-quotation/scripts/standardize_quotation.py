#!/usr/bin/env python3
"""Standardize heterogeneous quotation sheets with LLM+script cooperation.

Modes:
1. detect: produce detection/candidate JSON with confidence and recommended plan
2. apply: apply an explicit plan JSON to produce standardized output
3. auto: detect then apply; automatically handles single-sheet or multi-sheet workbooks
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd

SUPPORTED_EXTENSIONS = {".csv", ".xls", ".xlsx"}
HEADER_SCAN_MAX_ROWS = 40
DEFAULT_LLM_THRESHOLD = 0.65
DEFAULT_MULTI_MIN_DATA_ROWS = 3
MAX_PREVIEW_COLUMNS = 12
MAX_PREVIEW_ROWS = 6

POSITIVE_SHEET_NAME_KEYWORDS = (
    "报价",
    "清单",
    "台账",
    "校准",
    "检定",
    "计划",
    "一览",
    "明细",
)
NEGATIVE_SHEET_NAME_KEYWORDS = (
    "要求",
    "说明",
    "封面",
    "目录",
    "规则",
)
DEFAULT_NON_DATA_INSTRUMENT_KEYWORDS = (
    "合计",
    "总计",
    "说明",
    "要求",
    "封面",
    "目录",
    "校准证书要求",
    "仪器基本信息要求",
)

COLUMN_ALIASES = {
    "仪器名称": (
        "仪器名称",
        "设备名称",
        "器具名称",
        "项目名称",
        "名称",
        "检测对象",
    ),
    "型号规格": (
        "型号规格",
        "设备型号规格",
        "型号/规格",
        "规格型号",
        "规格",
        "型号",
    ),
    "数量": (
        "数量",
        "台数",
        "件数",
        "数量(台)",
        "数量（台）",
    ),
}


@dataclass
class HeaderCandidate:
    row_index: int
    score: float
    mapping: dict[str, int]
    row_cells: list[str]
    non_empty_count: int


@dataclass
class SheetCandidate:
    sheet_name: str
    score: float
    header: HeaderCandidate
    estimated_data_rows: int


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return ""
    text = text.replace("\u3000", " ")
    text = " ".join(text.split())
    return text


def _normalize_for_match(value: Any) -> str:
    text = _normalize_text(value)
    if not text:
        return ""
    return (
        text.replace(" ", "")
        .replace("\n", "")
        .replace("\t", "")
        .replace("（", "(")
        .replace("）", ")")
        .replace("：", ":")
    )


def _find_project_root(start: Path) -> Path:
    for parent in [start, *start.parents]:
        if (parent / ".workspace").exists():
            return parent
    cwd = Path.cwd().resolve()
    for parent in [cwd, *cwd.parents]:
        if (parent / ".workspace").exists():
            return parent
    return cwd


def _resolve_existing_path(path_str: str, project_root: Path) -> Path:
    workspace_root = project_root / ".workspace"
    raw_path = Path(path_str)
    if raw_path.is_absolute():
        candidates = [raw_path]
    else:
        candidates = [
            Path.cwd() / raw_path,
            workspace_root / raw_path,
            project_root / raw_path,
        ]
    for candidate in candidates:
        if candidate.exists():
            return candidate.resolve()
    candidate_text = "\n".join(f"- {c}" for c in candidates)
    raise FileNotFoundError(f"File not found. Tried:\n{candidate_text}")


def _resolve_output_path(path_str: str | None, default_path: Path, project_root: Path) -> Path:
    workspace_root = project_root / ".workspace"
    if path_str is None:
        path = default_path
    else:
        raw_path = Path(path_str)
        if raw_path.is_absolute():
            path = raw_path
        elif raw_path.parts and raw_path.parts[0] == ".workspace":
            path = project_root / raw_path
        else:
            path = workspace_root / raw_path
    path.parent.mkdir(parents=True, exist_ok=True)
    return path.resolve()


def _read_csv_with_fallback(path: Path) -> pd.DataFrame:
    errors = []
    for encoding in ("utf-8-sig", "utf-8", "gb18030", "gbk"):
        try:
            return pd.read_csv(path, header=None, encoding=encoding)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{encoding}: {type(exc).__name__}: {exc}")
    detail = "\n".join(errors)
    raise ValueError(f"Failed to read CSV with fallback encodings:\n{detail}")


def _read_all_sheets(path: Path) -> dict[str, pd.DataFrame]:
    suffix = path.suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        allowed = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise ValueError(f"Unsupported input extension '{suffix}', expected one of: {allowed}")

    if suffix == ".csv":
        return {"CSV": _read_csv_with_fallback(path)}

    sheets: dict[str, pd.DataFrame] = {}
    excel_file = pd.ExcelFile(path)
    for sheet_name in excel_file.sheet_names:
        sheets[sheet_name] = pd.read_excel(path, sheet_name=sheet_name, header=None)
    return sheets


def _find_alias_column(cells_normalized: list[str], aliases: tuple[str, ...]) -> int | None:
    normalized_aliases = [_normalize_for_match(alias) for alias in aliases]
    for idx, cell_text in enumerate(cells_normalized):
        if not cell_text:
            continue
        for alias in normalized_aliases:
            if alias and alias in cell_text:
                return idx
    return None


def _detect_header_candidate(df: pd.DataFrame) -> HeaderCandidate | None:
    max_rows = min(len(df), HEADER_SCAN_MAX_ROWS)
    best: HeaderCandidate | None = None

    for row_index in range(max_rows):
        raw_cells = [_normalize_text(v) for v in df.iloc[row_index].tolist()]
        normalized_cells = [_normalize_for_match(v) for v in raw_cells]
        non_empty_count = sum(1 for cell in normalized_cells if cell)
        if non_empty_count < 2:
            continue

        mapping: dict[str, int] = {}
        for canonical, aliases in COLUMN_ALIASES.items():
            col_index = _find_alias_column(normalized_cells, aliases)
            if col_index is not None:
                mapping[canonical] = col_index

        if "仪器名称" not in mapping:
            continue

        unique_cols = len(set(mapping.values()))
        if unique_cols < 2 and non_empty_count < 3:
            # Typical false positive: one-cell paragraph containing many keywords.
            continue

        row_text = "|".join([cell for cell in raw_cells if cell])
        row_text_match = _normalize_for_match(row_text)

        score = 0.0
        score += 4.0
        if "型号规格" in mapping:
            score += 3.0
        if "数量" in mapping:
            score += 2.5
        score += min(non_empty_count, 12) * 0.1
        if "序号" in row_text_match:
            score += 0.4
        if any(_normalize_for_match(k) in row_text_match for k in DEFAULT_NON_DATA_INSTRUMENT_KEYWORDS):
            score -= 5.0

        candidate = HeaderCandidate(
            row_index=row_index,
            score=score,
            mapping=mapping,
            row_cells=raw_cells,
            non_empty_count=non_empty_count,
        )
        if best is None or candidate.score > best.score:
            best = candidate

    return best


def _is_non_data_instrument_name(name: str, drop_keywords: tuple[str, ...]) -> bool:
    match_name = _normalize_for_match(name)
    if not match_name:
        return True
    if len(match_name) > 120:
        return True
    return any(_normalize_for_match(k) in match_name for k in drop_keywords)


def _estimate_data_rows(df: pd.DataFrame, instrument_col: int, drop_keywords: tuple[str, ...], header_row: int) -> int:
    count = 0
    for row_idx in range(header_row + 1, len(df)):
        if instrument_col >= df.shape[1]:
            break
        instrument = _normalize_text(df.iat[row_idx, instrument_col])
        if not instrument:
            continue
        if _is_non_data_instrument_name(instrument, drop_keywords):
            continue
        count += 1
    return count


def _score_sheet(sheet_name: str, header: HeaderCandidate, data_rows: int) -> float:
    score = header.score + min(data_rows / 50.0, 5.0)
    sheet_name_norm = _normalize_for_match(sheet_name)
    if any(_normalize_for_match(k) in sheet_name_norm for k in POSITIVE_SHEET_NAME_KEYWORDS):
        score += 1.0
    if any(_normalize_for_match(k) in sheet_name_norm for k in NEGATIVE_SHEET_NAME_KEYWORDS):
        score -= 2.0
    if "数量" in header.mapping:
        score += 0.8
    if "型号规格" in header.mapping:
        score += 0.8
    return score


def _preview_row(df: pd.DataFrame, row_index: int, *, max_columns: int = MAX_PREVIEW_COLUMNS) -> list[dict[str, Any]]:
    if row_index < 0 or row_index >= len(df):
        return []
    row = df.iloc[row_index].tolist()
    return [
        {
            "col_index": col_index,
            "value": _normalize_text(row[col_index]) if col_index < len(row) else "",
        }
        for col_index in range(min(len(row), max_columns))
    ]


def _build_sheet_preview(
    df: pd.DataFrame,
    *,
    header_row_index: int,
    max_rows: int = MAX_PREVIEW_ROWS,
    max_columns: int = MAX_PREVIEW_COLUMNS,
) -> dict[str, Any]:
    sample_rows: list[dict[str, Any]] = []
    for row_idx in range(header_row_index + 1, len(df)):
        cells = _preview_row(df, row_idx, max_columns=max_columns)
        if not cells:
            continue
        if not any(cell["value"] for cell in cells):
            continue
        sample_rows.append(
            {
                "row_index": row_idx,
                "row_display": row_idx + 1,
                "cells": cells,
            }
        )
        if len(sample_rows) >= max_rows:
            break
    return {
        "header_row_index": header_row_index,
        "header_row_display": header_row_index + 1,
        "header_row_cells": _preview_row(df, header_row_index, max_columns=max_columns),
        "sample_rows": sample_rows,
    }


def _build_plan_from_candidate(candidate: SheetCandidate) -> dict[str, Any]:
    mapping = candidate.header.mapping
    return {
        "sheet_name": candidate.sheet_name,
        "header_row_index": candidate.header.row_index,
        "column_mapping": {
            "仪器名称": mapping.get("仪器名称"),
            "型号规格": mapping.get("型号规格"),
            "数量": mapping.get("数量"),
        },
        "quantity_default": 1,
        "drop_instrument_keywords": list(DEFAULT_NON_DATA_INSTRUMENT_KEYWORDS),
    }


def _compute_confidence(best: SheetCandidate, second: SheetCandidate | None) -> tuple[float, list[str]]:
    mapping = best.header.mapping
    reasons: list[str] = []
    confidence = 0.0

    if "仪器名称" in mapping:
        confidence += 0.30
    if "型号规格" in mapping:
        confidence += 0.22
    else:
        reasons.append("缺少明确的型号规格列映射")

    if "数量" in mapping:
        confidence += 0.22
    else:
        reasons.append("缺少明确的数量列映射（将默认填充数量=1）")

    if best.estimated_data_rows >= 100:
        confidence += 0.14
    elif best.estimated_data_rows >= 20:
        confidence += 0.10
    elif best.estimated_data_rows >= 5:
        confidence += 0.06
    else:
        reasons.append("有效数据行较少，可能误选了sheet")

    if best.header.non_empty_count >= 5:
        confidence += 0.06
    elif best.header.non_empty_count <= 2:
        reasons.append("表头行非空列过少，可能是文本说明行")

    if second is None:
        confidence += 0.06
    else:
        score_gap = best.score - second.score
        if score_gap >= 2.0:
            confidence += 0.06
        elif score_gap <= 0.5:
            reasons.append("多个候选sheet得分接近，选择存在歧义")

    confidence = max(0.0, min(confidence, 0.99))
    return round(confidence, 4), reasons


def detect_standardization_plan(
    input_file: str,
    *,
    llm_threshold: float = DEFAULT_LLM_THRESHOLD,
    sheet_name: str | None = None,
    header_row: int | None = None,
) -> tuple[dict[str, Any], Path, Path]:
    script_dir = Path(__file__).resolve().parent
    project_root = _find_project_root(script_dir)
    workspace_root = project_root / ".workspace"
    input_path = _resolve_existing_path(input_file, project_root)

    output_dir = _default_output_dir(
        input_path=input_path,
        workspace_root=workspace_root,
        project_root=project_root,
    )
    output_hint = output_dir / f"{input_path.stem}_标准化报价单.csv"

    sheets = _read_all_sheets(input_path)
    candidates: list[SheetCandidate] = []
    candidate_debug: list[dict[str, Any]] = []

    for current_sheet_name, df in sheets.items():
        if df.empty:
            continue
        if sheet_name and current_sheet_name != sheet_name:
            continue

        if header_row is not None:
            if header_row < 0 or header_row >= len(df):
                continue
            raw_cells = [_normalize_text(v) for v in df.iloc[header_row].tolist()]
            normalized_cells = [_normalize_for_match(v) for v in raw_cells]
            mapping: dict[str, int] = {}
            for canonical, aliases in COLUMN_ALIASES.items():
                idx = _find_alias_column(normalized_cells, aliases)
                if idx is not None:
                    mapping[canonical] = idx
            header = HeaderCandidate(
                row_index=header_row,
                score=0.0,
                mapping=mapping,
                row_cells=raw_cells,
                non_empty_count=sum(1 for v in raw_cells if v),
            )
        else:
            header = _detect_header_candidate(df)

        if header is None or "仪器名称" not in header.mapping:
            continue

        data_rows = _estimate_data_rows(
            df=df,
            instrument_col=header.mapping["仪器名称"],
            drop_keywords=DEFAULT_NON_DATA_INSTRUMENT_KEYWORDS,
            header_row=header.row_index,
        )
        score = _score_sheet(current_sheet_name, header, data_rows)
        candidate = SheetCandidate(
            sheet_name=current_sheet_name,
            score=score,
            header=header,
            estimated_data_rows=data_rows,
        )
        candidates.append(candidate)
        candidate_debug.append(
            {
                "sheet_name": current_sheet_name,
                "score": round(score, 3),
                "header_row_index": header.row_index,
                "header_row_display": header.row_index + 1,
                "mapping": header.mapping,
                "estimated_data_rows": data_rows,
                "header_row_cells": _preview_row(df, header.row_index),
            }
        )

    if not candidates:
        raise ValueError(
            "No valid worksheet detected. "
            "Expected at least an instrument-name column (e.g., 仪器名称/设备名称/器具名称)."
        )

    candidates.sort(key=lambda item: item.score, reverse=True)
    best = candidates[0]
    second = candidates[1] if len(candidates) > 1 else None

    confidence_score, ambiguity_reasons = _compute_confidence(best, second)
    llm_assist_recommended = confidence_score < llm_threshold or len(ambiguity_reasons) > 0
    recommended_plan = _build_plan_from_candidate(best)
    selected_df = sheets[best.sheet_name]

    detection = {
        "input_file": _to_workspace_or_project_relative(input_path, project_root),
        "recommended_output_file": _to_workspace_or_project_relative(output_hint, project_root),
        "selected_sheet": best.sheet_name,
        "header_row_index": best.header.row_index,
        "header_row_display": best.header.row_index + 1,
        "column_mapping": best.header.mapping,
        "estimated_data_rows": best.estimated_data_rows,
        "confidence_score": confidence_score,
        "llm_threshold": llm_threshold,
        "llm_assist_recommended": llm_assist_recommended,
        "llm_assist_reasons": ambiguity_reasons,
        "candidates": candidate_debug,
        "selected_sheet_preview": _build_sheet_preview(
            selected_df,
            header_row_index=best.header.row_index,
        ),
        "recommended_plan": recommended_plan,
    }
    return detection, input_path, project_root


def _coerce_index(value: Any, field_name: str, allow_none: bool = False) -> int | None:
    if value is None and allow_none:
        return None
    if isinstance(value, bool):
        raise ValueError(f"{field_name} cannot be bool")
    if isinstance(value, (int, float)):
        num = int(value)
        if num != value:
            raise ValueError(f"{field_name} must be integer-like")
        return num
    if isinstance(value, str):
        value = value.strip()
        if not value and allow_none:
            return None
        if value.isdigit() or (value.startswith("-") and value[1:].isdigit()):
            return int(value)
    raise ValueError(f"{field_name} must be an integer")


def normalize_plan(plan_data: dict[str, Any], sheets: dict[str, pd.DataFrame]) -> dict[str, Any]:
    if not isinstance(plan_data, dict):
        raise ValueError("plan must be a JSON object")
    if "sheet_name" not in plan_data:
        raise ValueError("plan.sheet_name is required")
    if "header_row_index" not in plan_data:
        raise ValueError("plan.header_row_index is required")
    if "column_mapping" not in plan_data:
        raise ValueError("plan.column_mapping is required")

    sheet_name_raw = str(plan_data["sheet_name"])
    if not sheet_name_raw.strip():
        raise ValueError("plan.sheet_name cannot be empty")
    if sheet_name_raw in sheets:
        sheet_name = sheet_name_raw
    else:
        normalized_name = sheet_name_raw.strip()
        matched_names = [name for name in sheets if str(name).strip() == normalized_name]
        if len(matched_names) == 1:
            sheet_name = matched_names[0]
        else:
            raise ValueError(f"plan.sheet_name not found: {sheet_name_raw}")

    header_row_index = _coerce_index(plan_data["header_row_index"], "plan.header_row_index")
    assert header_row_index is not None
    if header_row_index < 0 or header_row_index >= len(sheets[sheet_name]):
        raise ValueError("plan.header_row_index out of range")

    column_mapping_raw = plan_data["column_mapping"]
    if not isinstance(column_mapping_raw, dict):
        raise ValueError("plan.column_mapping must be object")

    instrument_col = _coerce_index(column_mapping_raw.get("仪器名称"), "plan.column_mapping.仪器名称")
    model_col = _coerce_index(column_mapping_raw.get("型号规格"), "plan.column_mapping.型号规格", allow_none=True)
    quantity_col = _coerce_index(column_mapping_raw.get("数量"), "plan.column_mapping.数量", allow_none=True)
    assert instrument_col is not None
    target_df = sheets[sheet_name]
    max_cols = target_df.shape[1]

    for field_name, value in (
        ("plan.column_mapping.仪器名称", instrument_col),
        ("plan.column_mapping.型号规格", model_col),
        ("plan.column_mapping.数量", quantity_col),
    ):
        if value is None:
            continue
        if value < 0:
            raise ValueError(f"{field_name} cannot be negative")
        if value >= max_cols:
            raise ValueError(f"{field_name} out of range, max index is {max_cols - 1}")

    used_columns = [
        ("仪器名称", instrument_col),
        ("型号规格", model_col),
        ("数量", quantity_col),
    ]
    seen: dict[int, str] = {}
    for canonical, idx in used_columns:
        if idx is None:
            continue
        if idx in seen:
            prev = seen[idx]
            raise ValueError(f"Duplicate column mapping detected: '{prev}' and '{canonical}' both map to {idx}")
        seen[idx] = canonical

    quantity_default = plan_data.get("quantity_default", 1)
    quantity_default_int = _coerce_index(quantity_default, "plan.quantity_default")
    assert quantity_default_int is not None
    if quantity_default_int <= 0:
        raise ValueError("plan.quantity_default must be > 0")

    drop_keywords_raw = plan_data.get("drop_instrument_keywords", list(DEFAULT_NON_DATA_INSTRUMENT_KEYWORDS))
    if not isinstance(drop_keywords_raw, list):
        raise ValueError("plan.drop_instrument_keywords must be list")
    drop_keywords: list[str] = []
    for idx, item in enumerate(drop_keywords_raw):
        text = _normalize_text(item)
        if not text:
            raise ValueError(f"plan.drop_instrument_keywords[{idx}] cannot be empty")
        drop_keywords.append(text)

    return {
        "sheet_name": sheet_name,
        "header_row_index": header_row_index,
        "column_mapping": {
            "仪器名称": instrument_col,
            "型号规格": model_col,
            "数量": quantity_col,
        },
        "quantity_default": quantity_default_int,
        "drop_instrument_keywords": drop_keywords,
    }


def _parse_quantity(value: Any, default_value: int = 1) -> tuple[int, bool]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return default_value, True
    if isinstance(value, str):
        value = value.replace(",", "").strip()
        if not value:
            return default_value, True
    num = pd.to_numeric(value, errors="coerce")
    if pd.isna(num):
        return default_value, True
    numeric = float(num)
    if numeric <= 0:
        return default_value, True
    return int(round(numeric)), False


def apply_standardization_plan(
    df: pd.DataFrame,
    plan: dict[str, Any],
) -> tuple[pd.DataFrame, dict[str, int], dict[str, str]]:
    mapping = plan["column_mapping"]
    header_row = plan["header_row_index"]
    instrument_col = mapping["仪器名称"]
    model_col = mapping.get("型号规格")
    quantity_col = mapping.get("数量")
    quantity_default = plan["quantity_default"]
    drop_keywords = tuple(plan["drop_instrument_keywords"])

    stats = {
        "source_rows_after_header": max(len(df) - (header_row + 1), 0),
        "dropped_empty_instrument_rows": 0,
        "dropped_non_data_rows": 0,
        "quantity_defaulted_rows": 0,
    }

    records: list[dict[str, Any]] = []
    for row_idx in range(header_row + 1, len(df)):
        if instrument_col >= df.shape[1]:
            break
        instrument = _normalize_text(df.iat[row_idx, instrument_col])
        if not instrument:
            stats["dropped_empty_instrument_rows"] += 1
            continue
        if _is_non_data_instrument_name(instrument, drop_keywords):
            stats["dropped_non_data_rows"] += 1
            continue

        model_spec = ""
        if model_col is not None and model_col < df.shape[1]:
            model_spec = _normalize_text(df.iat[row_idx, model_col])

        quantity_raw = None
        if quantity_col is not None and quantity_col < df.shape[1]:
            quantity_raw = df.iat[row_idx, quantity_col]
        quantity, used_default = _parse_quantity(quantity_raw, default_value=quantity_default)
        if used_default:
            stats["quantity_defaulted_rows"] += 1

        records.append(
            {
                "仪器名称": instrument,
                "型号规格": model_spec,
                "数量": quantity,
            }
        )

    standardized_df = pd.DataFrame(records, columns=["仪器名称", "型号规格", "数量"])
    header_cells = [_normalize_text(v) for v in df.iloc[header_row].tolist()]
    source_columns = {
        "仪器名称": header_cells[instrument_col] if instrument_col < len(header_cells) else "",
        "型号规格": header_cells[model_col] if isinstance(model_col, int) and model_col < len(header_cells) else "",
        "数量": header_cells[quantity_col] if isinstance(quantity_col, int) and quantity_col < len(header_cells) else "",
    }
    return standardized_df, stats, source_columns


def _to_workspace_or_project_relative(path: Path, project_root: Path) -> str:
    workspace_root = project_root / ".workspace"
    for base in (workspace_root, project_root):
        try:
            return str(path.relative_to(base))
        except Exception:  # noqa: BLE001
            continue
    return str(path)


def _default_output_dir(input_path: Path, workspace_root: Path, project_root: Path) -> Path:
    # Keep standardized artifacts isolated from source files.
    # Always write default outputs into a dedicated workspace directory.
    return workspace_root / "standardized"


def _default_output_paths(input_path: Path, workspace_root: Path, project_root: Path) -> tuple[Path, Path, Path]:
    output_dir = _default_output_dir(
        input_path=input_path,
        workspace_root=workspace_root,
        project_root=project_root,
    )
    output_path = output_dir / f"{input_path.stem}_标准化报价单.csv"
    report_path = output_path.with_name(f"{output_path.stem}_标准化报告.json")
    detect_path = output_path.with_name(f"{output_path.stem}_标准化检测.json")
    return output_path, report_path, detect_path


def _sanitize_filename_component(text: str, fallback: str) -> str:
    # Keep human-readable Unicode names while removing filesystem-illegal chars.
    safe = _normalize_text(text)
    safe = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "_", safe)
    safe = re.sub(r"\s+", "", safe)
    safe = safe.strip("._- ")
    if len(safe) > 48:
        safe = safe[:48].rstrip("._- ")
    return safe or fallback


def _build_input_prefix(input_path: Path) -> str:
    return _sanitize_filename_component(input_path.stem, "quotation")


def _slugify_sheet_name(sheet_name: str, index: int, used: set[str]) -> str:
    base = f"{index + 1:02d}_{_sanitize_filename_component(sheet_name, f'sheet_{index + 1:02d}')}"
    if base not in used:
        used.add(base)
        return base
    suffix = 2
    while True:
        resolved = f"{base}_{suffix}"
        if resolved not in used:
            used.add(resolved)
            return resolved
        suffix += 1


def _select_sheets_for_auto_multi(
    detection: dict[str, Any],
    *,
    sheet_names: list[str] | None,
    min_data_rows: int,
) -> list[str]:
    if sheet_names:
        candidate_names = [str(item.get("sheet_name", "")) for item in detection.get("candidates", [])]
        resolved: list[str] = []
        for provided in sheet_names:
            if provided in candidate_names:
                resolved.append(provided)
                continue
            normalized = provided.strip()
            matched = [name for name in candidate_names if name.strip() == normalized]
            if len(matched) == 1:
                resolved.append(matched[0])
            else:
                resolved.append(provided)
        return resolved

    candidates = detection.get("candidates", [])
    selected = [
        item["sheet_name"]
        for item in candidates
        if int(item.get("estimated_data_rows", 0)) >= min_data_rows
    ]
    if not selected and candidates:
        selected = [str(candidates[0]["sheet_name"])]
    return selected


def _write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _run_auto_multi_standardization(
    *,
    input_path: Path,
    project_root: Path,
    detection: dict[str, Any],
    output_path: Path,
    detect_path: Path,
    min_data_rows: int,
    sheet_names: list[str] | None,
    llm_threshold: float,
    fail_on_llm_recommendation: bool,
) -> dict[str, Any]:
    output_dir = output_path.parent
    output_dir.mkdir(parents=True, exist_ok=True)

    input_prefix = _build_input_prefix(input_path)
    _write_json(detect_path, detection)

    selected_sheets = _select_sheets_for_auto_multi(
        detection,
        sheet_names=sheet_names,
        min_data_rows=min_data_rows,
    )

    sheet_results: list[dict[str, Any]] = []
    used_slugs: set[str] = set()
    for idx, current_sheet_name in enumerate(selected_sheets):
        sheet_slug = _slugify_sheet_name(current_sheet_name, idx, used_slugs)
        file_prefix = f"{input_prefix}_{sheet_slug}"

        current_output = output_dir / f"{file_prefix}_standardized.csv"
        current_report = output_dir / f"{file_prefix}_report.json"
        current_detect = output_dir / f"{file_prefix}_detect.json"
        current_plan = output_dir / f"{file_prefix}_plan.json"

        status = "standardized"
        error = ""
        report_payload: dict[str, Any] | None = None

        try:
            report_payload = run_standardization(
                mode="auto",
                input_file=str(input_path),
                output_file=str(current_output),
                report_file=str(current_report),
                detect_file=str(current_detect),
                plan_file=None,
                llm_threshold=llm_threshold,
                sheet_name=current_sheet_name,
                sheet_names=None,
                min_data_rows=min_data_rows,
                header_row=None,
                fail_on_llm_recommendation=fail_on_llm_recommendation,
            )
        except Exception as exc:  # noqa: BLE001
            error = f"{type(exc).__name__}: {exc}"
            if "Detection recommends LLM assistance" in str(exc):
                status = "requires_plan"
            else:
                status = "failed"
            if not current_detect.exists():
                try:
                    run_standardization(
                        mode="detect",
                        input_file=str(input_path),
                        output_file=None,
                        report_file=None,
                        detect_file=str(current_detect),
                        plan_file=None,
                        llm_threshold=llm_threshold,
                        sheet_name=current_sheet_name,
                        sheet_names=None,
                        min_data_rows=min_data_rows,
                        header_row=None,
                        fail_on_llm_recommendation=False,
                    )
                except Exception as detect_exc:  # noqa: BLE001
                    error = f"{error} | detect_fallback_error: {type(detect_exc).__name__}: {detect_exc}"

        detect_payload: dict[str, Any] = {}
        if current_detect.exists():
            detect_payload = json.loads(current_detect.read_text(encoding="utf-8"))

        sheet_results.append(
            {
                "sheet_name": current_sheet_name,
                "sheet_slug": sheet_slug,
                "status": status,
                "error": error,
                "output_file": _to_workspace_or_project_relative(current_output, project_root),
                "report_file": _to_workspace_or_project_relative(current_report, project_root),
                "detect_file": _to_workspace_or_project_relative(current_detect, project_root),
                "plan_file": _to_workspace_or_project_relative(current_plan, project_root),
                "llm_assist_recommended": detect_payload.get("llm_assist_recommended"),
                "confidence_score": detect_payload.get("confidence_score"),
                "llm_assist_reasons": detect_payload.get("llm_assist_reasons", []),
                "processor_ready": status == "standardized",
                "processor_input_file": _to_workspace_or_project_relative(current_output, project_root)
                if status == "standardized"
                else "",
                "standardization_report": report_payload or {},
            }
        )

    summary = {
        "total_sheets": len(sheet_results),
        "standardized": sum(1 for item in sheet_results if item["status"] == "standardized"),
        "requires_plan": sum(1 for item in sheet_results if item["status"] == "requires_plan"),
        "failed": sum(1 for item in sheet_results if item["status"] == "failed"),
    }
    if summary["failed"] > 0:
        final_status = "failed"
    elif summary["requires_plan"] > 0:
        final_status = "partial_success"
    else:
        final_status = "success"

    manifest = {
        "mode": "auto",
        "auto_multi": True,
        "status": final_status,
        "input_file": _to_workspace_or_project_relative(input_path, project_root),
        "output_dir": _to_workspace_or_project_relative(output_dir, project_root),
        "input_prefix": input_prefix,
        "global_detect_file": _to_workspace_or_project_relative(detect_path, project_root),
        "selected_sheets": selected_sheets,
        "summary": summary,
        "sheets": sheet_results,
        "next_step": (
            "For each sheet with processor_ready=true, call st_batch_quotation_processor once with the sheet's processor_input_file."
        ),
    }
    manifest_path = output_dir / f"{input_prefix}_manifest.json"
    _write_json(manifest_path, manifest)
    return {
        **manifest,
        "manifest_file": _to_workspace_or_project_relative(manifest_path, project_root),
    }


def run_standardization(
    *,
    mode: str,
    input_file: str,
    output_file: str | None,
    report_file: str | None,
    detect_file: str | None,
    plan_file: str | None,
    llm_threshold: float,
    sheet_name: str | None,
    sheet_names: list[str] | None,
    min_data_rows: int,
    header_row: int | None,
    fail_on_llm_recommendation: bool,
) -> dict[str, Any]:
    script_dir = Path(__file__).resolve().parent
    project_root = _find_project_root(script_dir)
    workspace_root = project_root / ".workspace"

    input_path = _resolve_existing_path(input_file, project_root)
    default_output, default_report, default_detect = _default_output_paths(
        input_path,
        workspace_root,
        project_root,
    )

    output_path = _resolve_output_path(output_file, default_output, project_root)
    report_path = _resolve_output_path(report_file, default_report, project_root)
    detect_path = _resolve_output_path(detect_file, default_detect, project_root)

    if sheet_name and sheet_names:
        raise ValueError("--sheet-name and --sheet-names cannot be used together")
    if mode != "auto" and sheet_names:
        raise ValueError("--sheet-names is only supported for mode=auto")

    detection, resolved_input_path, _ = detect_standardization_plan(
        input_file=str(input_path),
        llm_threshold=llm_threshold,
        sheet_name=sheet_name,
        header_row=header_row,
    )

    if mode == "detect":
        _write_json(detect_path, detection)
        return {
            "mode": "detect",
            **detection,
            "detect_file": _to_workspace_or_project_relative(detect_path, project_root),
        }

    if mode == "auto" and plan_file is None and sheet_name is None and header_row is None:
        selected_sheets = _select_sheets_for_auto_multi(
            detection,
            sheet_names=sheet_names,
            min_data_rows=min_data_rows,
        )
        if len(selected_sheets) == 1 and sheet_names:
            return run_standardization(
                mode="auto",
                input_file=str(input_path),
                output_file=str(output_path),
                report_file=str(report_path),
                detect_file=str(detect_path),
                plan_file=None,
                llm_threshold=llm_threshold,
                sheet_name=selected_sheets[0],
                sheet_names=None,
                min_data_rows=min_data_rows,
                header_row=None,
                fail_on_llm_recommendation=fail_on_llm_recommendation,
            )
        if input_path.suffix.lower() != ".csv" and len(selected_sheets) > 1:
            return _run_auto_multi_standardization(
                input_path=input_path,
                project_root=project_root,
                detection=detection,
                output_path=output_path,
                detect_path=detect_path,
                min_data_rows=min_data_rows,
                sheet_names=sheet_names,
                llm_threshold=llm_threshold,
                fail_on_llm_recommendation=fail_on_llm_recommendation,
            )

    sheets = _read_all_sheets(resolved_input_path)

    if mode == "apply":
        if not plan_file:
            raise ValueError("--plan-file is required for mode=apply")
        plan_path = _resolve_existing_path(plan_file, project_root)
        raw_plan = json.loads(plan_path.read_text(encoding="utf-8"))
        plan = normalize_plan(raw_plan, sheets)
        plan_source = _to_workspace_or_project_relative(plan_path, project_root)
    else:
        if plan_file:
            plan_path = _resolve_existing_path(plan_file, project_root)
            raw_plan = json.loads(plan_path.read_text(encoding="utf-8"))
            plan = normalize_plan(raw_plan, sheets)
            plan_source = _to_workspace_or_project_relative(plan_path, project_root)
        else:
            if detection["llm_assist_recommended"] and fail_on_llm_recommendation:
                _write_json(detect_path, detection)
                raise ValueError(
                    "Detection recommends LLM assistance. "
                    f"Please generate plan JSON from detect result and run apply mode. detect_file={detect_path}"
                )
            plan = normalize_plan(detection["recommended_plan"], sheets)
            plan_source = "recommended_plan"

    selected_df = sheets[plan["sheet_name"]]
    standardized_df, stats, source_columns = apply_standardization_plan(selected_df, plan)
    if standardized_df.empty:
        raise ValueError(
            "Standardization result is empty. "
            "Plan was valid but no data rows remained after cleaning."
        )

    standardized_df.to_csv(output_path, index=False, encoding="utf-8-sig")
    _write_json(detect_path, detection)

    report = {
        "mode": mode,
        "input_file": _to_workspace_or_project_relative(resolved_input_path, project_root),
        "output_file": _to_workspace_or_project_relative(output_path, project_root),
        "report_file": _to_workspace_or_project_relative(report_path, project_root),
        "detect_file": _to_workspace_or_project_relative(detect_path, project_root),
        "selected_sheet": plan["sheet_name"],
        "header_row_index": plan["header_row_index"],
        "header_row_display": plan["header_row_index"] + 1,
        "column_mapping": plan["column_mapping"],
        "source_columns": source_columns,
        "plan_source": plan_source,
        "llm_assist_recommended": detection["llm_assist_recommended"],
        "confidence_score": detection["confidence_score"],
        "llm_assist_reasons": detection["llm_assist_reasons"],
        "stats": {
            **stats,
            "output_rows": int(len(standardized_df)),
        },
    }
    _write_json(report_path, report)
    return report


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Standardize quotation file for st_batch_quotation_processor.")
    parser.add_argument("--input-file", required=True, help="Input quotation file path.")
    parser.add_argument("--output-file", help="Output standardized CSV file path.")
    parser.add_argument("--report-file", help="Output report JSON path.")
    parser.add_argument("--detect-file", help="Output detection JSON path.")
    parser.add_argument("--plan-file", help="Plan JSON path for mode=apply or auto override.")
    parser.add_argument("--sheet-name", help="Optional fixed sheet name for detection.")
    parser.add_argument(
        "--sheet-names",
        help="Optional comma-separated sheet names for auto multi-sheet processing.",
    )
    parser.add_argument(
        "--min-data-rows",
        type=int,
        default=DEFAULT_MULTI_MIN_DATA_ROWS,
        help="In auto mode, minimum estimated data rows for selecting candidate sheets in multi-sheet processing.",
    )
    parser.add_argument("--header-row", type=int, help="Optional fixed header row index (0-based).")
    parser.add_argument(
        "--mode",
        choices=["auto", "detect", "apply"],
        default="auto",
        help="auto=detect+apply (single or multi auto-detected), detect=only emit detection, apply=apply explicit plan",
    )
    parser.add_argument(
        "--llm-threshold",
        type=float,
        default=DEFAULT_LLM_THRESHOLD,
        help="Confidence threshold below which LLM assistance is recommended.",
    )
    parser.add_argument(
        "--fail-on-llm-recommendation",
        action="store_true",
        help="In auto mode, fail when detection recommends LLM assistance.",
    )
    return parser


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()

    sheet_names: list[str] | None = None
    if args.sheet_names:
        parsed_sheet_names = [item.strip() for item in args.sheet_names.split(",") if item.strip()]
        sheet_names = parsed_sheet_names or None

    result = run_standardization(
        mode=args.mode,
        input_file=args.input_file,
        output_file=args.output_file,
        report_file=args.report_file,
        detect_file=args.detect_file,
        plan_file=args.plan_file,
        llm_threshold=args.llm_threshold,
        sheet_name=args.sheet_name,
        sheet_names=sheet_names,
        min_data_rows=args.min_data_rows,
        header_row=args.header_row,
        fail_on_llm_recommendation=args.fail_on_llm_recommendation,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
