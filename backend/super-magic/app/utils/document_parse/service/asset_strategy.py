"""文档资产提取策略。

该模块只负责把用户可理解的高层策略解析为稳定的驱动执行参数，
不负责具体文件读取、图片筛选或 Markdown 写入。
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import StrEnum
from typing import Any

from ..models import DocumentProfile
from .asset_strategy_scorer import AssetStrategyScorer, StrategyScoreResult


class AssetStrategy(StrEnum):
    """文档转换可选择的资产输出策略。"""

    AUTO = "auto"
    TEXT_ONLY = "text_only"
    PAGE_VISUAL = "page_visual"
    REUSABLE_ASSETS = "reusable_assets"
    FULL_FIDELITY = "full_fidelity"


@dataclass(frozen=True)
class AssetExtractionOptions:
    """高层资产策略解析后的确定性执行参数。"""

    requested_strategy: str
    resolved_strategy: str
    extract_embedded_images: bool
    embedded_image_policy: str
    page_snapshot_policy: str
    visual_hint: str
    reason: str
    confidence: str
    requires_user_confirmation: bool = False
    scores: dict[str, float | None] = field(default_factory=dict)
    score_margin: float = 0.0
    evidence: list[str] = field(default_factory=list)
    blocked_strategies: dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """返回可写入工具结果和文档索引的结构化策略信息。"""

        return asdict(self)


class AssetStrategyResolver:
    """根据用户策略、文档特征和阅读目标解析资产提取方案。"""

    @classmethod
    def resolve(
        cls,
        requested_strategy: str | AssetStrategy | None,
        profile: DocumentProfile | None = None,
        sample_signal: dict[str, Any] | None = None,
        goal: str = "",
    ) -> AssetExtractionOptions:
        """将高层策略解析为驱动可直接执行的参数。"""

        requested = cls._normalize(requested_strategy)
        score_result: StrategyScoreResult | None = None
        if requested == AssetStrategy.AUTO:
            score_result = AssetStrategyScorer.score(
                profile=profile,
                sample_signal=sample_signal,
                goal=goal,
            )
            resolved = AssetStrategy(score_result.recommended_strategy)
            reason = score_result.reason
            confidence = score_result.confidence
            confirmation = score_result.requires_user_confirmation
        else:
            resolved = requested
            reason = cls._explicit_reason(resolved)
            confidence = "explicit"
            confirmation = False
            score_result = StrategyScoreResult(
                scores={item.value: (1.0 if item == resolved else None) for item in AssetStrategy if item != AssetStrategy.AUTO},
                recommended_strategy=resolved.value,
                reason=reason,
                confidence=confidence,
                requires_user_confirmation=False,
                score_margin=1.0,
                evidence=[reason],
                blocked_strategies={},
            )
        return cls._options(
            requested=requested,
            resolved=resolved,
            reason=reason,
            confidence=confidence,
            requires_user_confirmation=confirmation,
            score_result=score_result,
        )

    @classmethod
    def build_context(
        cls,
        profile: DocumentProfile,
        sample_signal: dict[str, Any] | None = None,
        goal: str = "",
    ) -> dict[str, Any]:
        """生成供主 Agent 判断是否需要 ask_user 的策略上下文。"""

        options = cls.resolve(AssetStrategy.AUTO, profile, sample_signal, goal)
        metadata = profile.metadata or {}
        signal = sample_signal or {}
        context = {
            "file_type": profile.file_type,
            "document_kind": cls._document_kind(profile),
            "unit_type": profile.unit_type,
            "total_units": profile.total_units,
            "has_extractable_text": signal.get("has_extractable_text"),
            "image_dominant": signal.get("image_dominant"),
            "layout_sensitive": cls._layout_sensitive(profile, signal),
            "embedded_image_risk": cls._embedded_image_risk(profile, signal),
            "estimated_embedded_images": signal.get("embedded_image_count", signal.get("image_count")),
            "recommended_strategy": options.resolved_strategy,
            "confidence": options.confidence,
            "requires_user_confirmation": options.requires_user_confirmation,
            "reason": options.reason,
            "allowed_strategies": [item.value for item in AssetStrategy],
            "scores": options.scores,
            "score_margin": options.score_margin,
            "decision_mode": "ask_user" if options.requires_user_confirmation else "automatic",
            "evidence": options.evidence,
            "blocked_strategies": options.blocked_strategies,
            "sample_metrics": {
                key: signal.get(key)
                for key in (
                    "body_chars",
                    "image_count",
                    "embedded_image_count",
                    "reusable_candidate_count",
                    "filtered_image_count",
                    "duplicate_image_count",
                    "decorative_image_count",
                    "transparent_image_count",
                    "solid_image_count",
                )
                if key in signal
            },
        }
        if "is_scanned_like" in metadata:
            context["is_scanned_like"] = bool(metadata.get("is_scanned_like"))
        return context

    @staticmethod
    def _options(
        requested: AssetStrategy,
        resolved: AssetStrategy,
        reason: str,
        confidence: str,
        requires_user_confirmation: bool,
        score_result: StrategyScoreResult | None = None,
    ) -> AssetExtractionOptions:
        """构造策略到驱动参数的固定映射。"""

        mapping = {
            AssetStrategy.TEXT_ONLY: (False, "none", "never", "none"),
            AssetStrategy.PAGE_VISUAL: (False, "none", "always", "page_snapshot"),
            AssetStrategy.REUSABLE_ASSETS: (True, "selected", "never", "none"),
            AssetStrategy.FULL_FIDELITY: (True, "all", "always", "page_snapshot"),
        }
        extract_images, image_policy, snapshot_policy, visual_hint = mapping[resolved]
        return AssetExtractionOptions(
            requested_strategy=requested.value,
            resolved_strategy=resolved.value,
            extract_embedded_images=extract_images,
            embedded_image_policy=image_policy,
            page_snapshot_policy=snapshot_policy,
            visual_hint=visual_hint,
            reason=reason,
            confidence=confidence,
            requires_user_confirmation=requires_user_confirmation,
            scores=score_result.scores if score_result else {},
            score_margin=score_result.score_margin if score_result else 0.0,
            evidence=score_result.evidence if score_result else [],
            blocked_strategies=score_result.blocked_strategies if score_result else {},
        )

    @staticmethod
    def _normalize(strategy: str | AssetStrategy | None) -> AssetStrategy:
        """将外部字符串规范化为受限枚举。"""

        if isinstance(strategy, AssetStrategy):
            return strategy
        try:
            return AssetStrategy(str(strategy or AssetStrategy.AUTO).strip().lower())
        except ValueError as exc:
            allowed = ", ".join(item.value for item in AssetStrategy)
            raise ValueError(f"Unsupported asset_strategy: {strategy}. Use one of: {allowed}.") from exc

    @staticmethod
    def _explicit_reason(strategy: AssetStrategy) -> str:
        """返回显式策略的可读说明。"""

        return {
            AssetStrategy.TEXT_ONLY: "The caller selected text-only output.",
            AssetStrategy.PAGE_VISUAL: "The caller selected page-visual output.",
            AssetStrategy.REUSABLE_ASSETS: "The caller selected reusable image asset output.",
            AssetStrategy.FULL_FIDELITY: "The caller selected full-fidelity output.",
        }[strategy]

    @staticmethod
    def _document_kind(profile: DocumentProfile) -> str:
        """归纳文档类型，避免策略判断依赖文件扩展名。"""

        if profile.file_type == "powerpoint" or profile.unit_type == "slide":
            return "presentation_like"
        if profile.file_type == "pdf":
            return "pdf"
        if profile.file_type == "spreadsheet":
            return "spreadsheet"
        return profile.file_type or "document"

    @staticmethod
    def _layout_sensitive(profile: DocumentProfile, sample_signal: dict[str, Any]) -> bool:
        """判断页面布局是否可能影响语义理解。"""

        if profile.file_type == "powerpoint" or profile.unit_type == "slide":
            return True
        return bool(sample_signal.get("image_count") and not sample_signal.get("has_extractable_text"))

    @staticmethod
    def _embedded_image_risk(profile: DocumentProfile, sample_signal: dict[str, Any]) -> str:
        """估计全量内嵌图片会造成的噪声风险。"""

        image_count = int(sample_signal.get("image_count") or 0)
        if image_count >= 20:
            return "high"
        if image_count >= 5:
            return "medium"
        if image_count > 0:
            return "low"
        return "none"
