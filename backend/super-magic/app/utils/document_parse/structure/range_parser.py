"""Range parsing helpers for document extraction."""

from __future__ import annotations

from typing import Iterable, List, Optional

from ..errors import DocumentRangeError
from ..models import DocumentRange


class RangeParser:
    """Parse human-friendly 1-based ranges such as ``1-3,8,10-12``."""

    @staticmethod
    def parse_numeric(raw: Optional[str], total: Optional[int] = None) -> List[int]:
        if raw is None or str(raw).strip() == "":
            return list(range(1, (total or 0) + 1)) if total else []

        values: List[int] = []
        for part in str(raw).replace("，", ",").split(","):
            part = part.strip()
            if not part:
                continue
            if "-" in part:
                start_text, end_text = [x.strip() for x in part.split("-", 1)]
                if not start_text.isdigit() or not end_text.isdigit():
                    raise DocumentRangeError(f"Invalid range segment: {part}")
                start, end = int(start_text), int(end_text)
                if start <= 0 or end < start:
                    raise DocumentRangeError(f"Invalid range segment: {part}")
                values.extend(range(start, end + 1))
            else:
                if not part.isdigit():
                    raise DocumentRangeError(f"Invalid range value: {part}")
                value = int(part)
                if value <= 0:
                    raise DocumentRangeError(f"Invalid range value: {part}")
                values.append(value)

        unique = sorted(set(values), key=values.index)
        if total:
            unique = [value for value in unique if value <= total]
        return unique

    @staticmethod
    def to_range_label(kind: str, values: Iterable[int | str], raw: Optional[str] = None) -> DocumentRange:
        return DocumentRange(kind=kind, values=[str(value) for value in values], raw=raw)


def compact_numeric_ranges(values: Iterable[int]) -> str:
    ordered = sorted(set(values))
    if not ordered:
        return ""
    ranges = []
    start = prev = ordered[0]
    for value in ordered[1:]:
        if value == prev + 1:
            prev = value
            continue
        ranges.append(f"{start}-{prev}" if start != prev else str(start))
        start = prev = value
    ranges.append(f"{start}-{prev}" if start != prev else str(start))
    return ",".join(ranges)
