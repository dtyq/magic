"""资产提取策略评分器。"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from ..models import DocumentProfile


@dataclass(frozen=True)
class StrategyScoreResult:
    """保存策略分数、证据和最终决策信息。"""

    scores: dict[str, float | None]
    recommended_strategy: str
    reason: str
    confidence: str
    requires_user_confirmation: bool
    score_margin: float
    evidence: list[str]
    blocked_strategies: dict[str, str]

    def to_dict(self) -> dict[str, Any]:
        """返回可写入抽样状态和工具结果的结构化评分。"""

        return asdict(self)


class AssetStrategyScorer:
    """根据抽样信号对资产策略进行可解释的相对排序。"""

    @classmethod
    def score(
        cls,
        profile: DocumentProfile | None,
        sample_signal: dict[str, Any] | None = None,
        goal: str = "",
    ) -> StrategyScoreResult:
        """计算策略分数，并在需要时返回用户确认建议。"""

        override = cls._goal_override(goal)
        if override:
            strategy, reason = override
            return StrategyScoreResult(
                scores={
                    "text_only": 1.0 if strategy == "text_only" else 0.0,
                    "page_visual": 1.0 if strategy == "page_visual" else 0.0,
                    "reusable_assets": 1.0 if strategy == "reusable_assets" else 0.0,
                    "full_fidelity": 1.0 if strategy == "full_fidelity" else None,
                },
                recommended_strategy=strategy,
                reason=reason,
                confidence="high",
                requires_user_confirmation=False,
                score_margin=1.0,
                evidence=[reason],
                blocked_strategies={},
            )

        signal = sample_signal or {}
        metadata = (profile.metadata if profile else {}) or {}
        file_type = str(profile.file_type if profile else "")
        unit_type = str(profile.unit_type if profile else "")
        has_text = bool(signal.get("has_extractable_text"))
        image_dominant = bool(signal.get("image_dominant"))
        image_count = int(signal.get("image_count") or 0)
        embedded_image_count = int(signal.get("embedded_image_count") or image_count)
        candidate_count = int(signal.get("reusable_candidate_count") or 0)
        if not candidate_count and embedded_image_count:
            candidate_count = embedded_image_count
        text_density = str(metadata.get("text_density") or "")
        is_scanned_like = bool(metadata.get("is_scanned_like"))
        full_page_images = int(metadata.get("full_page_image_pages_in_sample") or 0)
        presentation = file_type == "powerpoint" or unit_type == "slide"
        layout_sensitive = presentation or is_scanned_like or bool(
            (image_count and not has_text) or full_page_images > 0
        )

        scores = {
            "text_only": cls._text_score(
                has_text=has_text,
                text_density=text_density,
                image_count=image_count,
                image_dominant=image_dominant,
                layout_sensitive=layout_sensitive,
                file_type=file_type,
            ),
            "page_visual": cls._visual_score(
                has_text=has_text,
                image_count=image_count,
                image_dominant=image_dominant,
                layout_sensitive=layout_sensitive,
                presentation=presentation,
                is_scanned_like=is_scanned_like,
                full_page_images=full_page_images,
            ),
            "reusable_assets": cls._reusable_score(
                profile=profile,
                image_count=image_count,
                embedded_image_count=embedded_image_count,
                candidate_count=candidate_count,
                image_dominant=image_dominant,
            ),
            "full_fidelity": None,
        }
        evidence = cls._evidence(
            profile=profile,
            signal=signal,
            presentation=presentation,
            is_scanned_like=is_scanned_like,
            layout_sensitive=layout_sensitive,
            candidate_count=candidate_count,
        )
        ranked = sorted(
            ((name, value) for name, value in scores.items() if value is not None),
            key=lambda item: item[1],
            reverse=True,
        )
        recommended_strategy, top_score = ranked[0]
        second_score = ranked[1][1] if len(ranked) > 1 else 0.0
        score_margin = round(max(top_score - second_score, 0.0), 3)
        confidence = cls._confidence(top_score, score_margin)
        requires_confirmation = cls._requires_confirmation(
            recommended_strategy,
            score_margin,
            presentation=presentation,
            image_dominant=image_dominant,
            is_scanned_like=is_scanned_like,
        )
        return StrategyScoreResult(
            scores={name: round(value, 3) if value is not None else None for name, value in scores.items()},
            recommended_strategy=recommended_strategy,
            reason=cls._reason(recommended_strategy, evidence),
            confidence=confidence,
            requires_user_confirmation=requires_confirmation,
            score_margin=score_margin,
            evidence=evidence,
            blocked_strategies={"full_fidelity": "Requires an explicit user request."},
        )

    @staticmethod
    def _goal_override(goal: str) -> tuple[str, str] | None:
        """识别用户目标中的强约束策略。"""

        lowered = goal.lower()
        if any(
            keyword in lowered
            for keyword in (
                "所有图片",
                "全部图片",
                "保留全部原始图片",
                "保留所有图片",
                "原始素材",
                "full fidelity",
                "all images",
                "all original images",
                "keep all original images",
                "preserve all images",
                "retain all images",
            )
        ):
            return "full_fidelity", "The user explicitly requested all original image objects."
        if any(keyword in lowered for keyword in ("提取图片", "图片素材", "可复用", "照片", "logo", "素材")):
            return "reusable_assets", "The user requested standalone image assets for reuse."
        if any(keyword in lowered for keyword in ("纯文本", "只要文字", "摘要", "总结", "检索", "问答", "text only")):
            return "text_only", "The goal is text-focused, so page visual assets are not needed."
        return None

    @staticmethod
    def _text_score(
        *,
        has_text: bool,
        text_density: str,
        image_count: int,
        image_dominant: bool,
        layout_sensitive: bool,
        file_type: str,
    ) -> float:
        """计算文本读取适配度。"""

        score = 0.2
        if has_text:
            score += 0.45
        if text_density == "high":
            score += 0.15
        elif text_density == "medium":
            score += 0.08
        if image_count == 0:
            score += 0.12
        if image_dominant:
            score -= 0.45
        if layout_sensitive:
            score -= 0.12
        if file_type == "spreadsheet":
            score += 0.08
        return max(0.0, min(score, 1.0))

    @staticmethod
    def _visual_score(
        *,
        has_text: bool,
        image_count: int,
        image_dominant: bool,
        layout_sensitive: bool,
        presentation: bool,
        is_scanned_like: bool,
        full_page_images: int,
    ) -> float:
        """计算页面视觉证据的重要性。"""

        score = 0.05
        if presentation:
            score += 0.55
        if image_dominant:
            score += 0.35
        if is_scanned_like:
            score += 0.55
        if full_page_images > 0:
            score += 0.2
        if layout_sensitive:
            score += 0.15
        if not has_text:
            score += 0.1
        if image_count == 0 and not presentation:
            score -= 0.1
        return max(0.0, min(score, 1.0))

    @staticmethod
    def _reusable_score(
        *,
        profile: DocumentProfile | None,
        image_count: int,
        embedded_image_count: int,
        candidate_count: int,
        image_dominant: bool,
    ) -> float:
        """计算独立图片资产复用价值。"""

        score = 0.08
        if profile and profile.file_type == "image":
            score += 0.82
        if image_count > 0:
            score += 0.1
        if embedded_image_count > 0:
            score += 0.1
        if candidate_count > 0:
            score += min(candidate_count * 0.06, 0.3)
        if embedded_image_count and candidate_count / max(embedded_image_count, 1) >= 0.5:
            score += 0.1
        if image_dominant:
            score -= 0.15
        if image_count == 0 and not (profile and profile.file_type == "image"):
            score -= 0.1
        return max(0.0, min(score, 1.0))

    @staticmethod
    def _evidence(
        *,
        profile: DocumentProfile | None,
        signal: dict[str, Any],
        presentation: bool,
        is_scanned_like: bool,
        layout_sensitive: bool,
        candidate_count: int,
    ) -> list[str]:
        """生成供模型和调试使用的英文证据摘要。"""

        evidence: list[str] = []
        if presentation:
            evidence.append("The document is presentation-like and slide layout may carry meaning.")
        if is_scanned_like:
            evidence.append("The sampled document looks scanned.")
        if signal.get("has_extractable_text"):
            evidence.append("The sample contains extractable text.")
        else:
            evidence.append("The sample contains little or no extractable text.")
        if signal.get("image_dominant"):
            evidence.append("The sample is image-dominant.")
        if layout_sensitive and not presentation:
            evidence.append("The sample contains layout-sensitive visual evidence.")
        if candidate_count > 0:
            evidence.append(f"The sample contains {candidate_count} candidate reusable image asset(s).")
        if profile and profile.file_type == "spreadsheet":
            evidence.append("The source is a spreadsheet, so table and range reading remains the default.")
        return evidence

    @staticmethod
    def _confidence(top_score: float, score_margin: float) -> str:
        """根据最高分和分差估计推荐置信度。"""

        if top_score >= 0.8 and score_margin >= 0.25:
            return "high"
        if top_score >= 0.6 and score_margin >= 0.12:
            return "medium"
        return "low"

    @staticmethod
    def _requires_confirmation(
        recommended_strategy: str,
        score_margin: float,
        *,
        presentation: bool,
        image_dominant: bool,
        is_scanned_like: bool,
    ) -> bool:
        """判断推荐结果是否会显著改变输出，需要先询问用户。"""

        if recommended_strategy == "page_visual" and (presentation or image_dominant or is_scanned_like):
            return True
        return recommended_strategy in {"page_visual", "reusable_assets"} and score_margin < 0.18

    @staticmethod
    def _reason(recommended_strategy: str, evidence: list[str]) -> str:
        """根据最高策略生成单句推荐原因。"""

        reasons = {
            "text_only": "The sample is primarily readable text and does not show a strong need for extra visual assets.",
            "page_visual": "The sample contains visual or layout evidence that may be important for understanding.",
            "reusable_assets": "The sample contains image objects that may be useful as standalone reusable assets.",
        }
        return reasons.get(recommended_strategy, evidence[0] if evidence else "The strategy is selected from the sampled document signals.")
