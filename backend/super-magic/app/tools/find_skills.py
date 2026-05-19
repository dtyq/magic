"""find_skills 工具：多关键词聚合检索 Skill

对模型只暴露 keywords 参数；来源选择、排序权重、top_k 等全部内部决定。
检索结果按关键词分组返回，附推荐项与 next_step 指引。
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from pydantic import Field, field_validator, model_validator

from app.i18n import i18n
from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, FileContent, ToolDetail
from app.tools.core import BaseTool, BaseToolParams, tool
from app.core.skill_utils.search_service import SearchAggregator, SearchResult

logger = get_logger(__name__)


# npx / github 不支持搜索，不作为 find_skills 的有效来源
# system 为内置系统 skill（agents/skills/ 目录），优先级最高
_VALID_PROVIDERS = {"system", "my_library", "market", "skillhub", "clawhub"}


class FindSkillsParams(BaseToolParams):
    """find_skills 工具参数"""

    keywords: List[str] = Field(
        default_factory=list,
        description=(
            "<!--zh: 搜索关键词或意图描述（数组），每个关键词独立检索后归并去重。"
            "若要列出我的技能库全部内容，传空数组 [] 并设置 providers=[\"my_library\"]。"
            "若要列出全部系统内置 skill，传空数组 [] 并设置 providers=[\"system\"]。"
            "例如：[\"天气\", \"日历同步\"]-->\n"
            "Search keywords or intent descriptions (array); each keyword is queried independently then merged. "
            "To list all skills in my_library, pass [] and set providers=[\"my_library\"]. "
            "To list all built-in system skills, pass [] and set providers=[\"system\"]. "
            "E.g. [\"weather\", \"calendar sync\"]."
        ),
        max_length=10,
    )
    query: Optional[str] = Field(
        None,
        description=(
            "<!--zh: 用户的完整需求描述（可选）。填写后会辅助打分，使结果更贴合实际意图。"
            "例如：\"我需要查询中国城市的实时天气和未来三天预报\"-->\n"
            "Full user requirement description (optional). When provided, it assists scoring "
            "alongside keywords to improve result accuracy. "
            "E.g. \"I need to query real-time weather and 3-day forecast for Chinese cities\"."
        ),
    )
    providers: Optional[List[str]] = Field(
        None,
        description=(
            "<!--zh: 限定搜索来源（可选）。可选值：system | my_library | market | skillhub | clawhub。"
            "system 为内置系统 skill（优先级最高），不传则同时搜索所有来源。"
            "keywords 为空时此字段必须且只能为 [\"my_library\"] 或 [\"system\"]。"
            "例如：[\"market\", \"skillhub\"]-->\n"
            "Restrict search to specific providers (optional). "
            "Options: system | my_library | market | skillhub | clawhub. "
            "system = built-in system skills (highest priority). "
            "Omit to search all sources. When keywords is [], this must be [\"my_library\"] or [\"system\"]. "
            "E.g. [\"market\", \"skillhub\"]."
        ),
    )

    @field_validator("keywords", mode="before")
    @classmethod
    def _validate_keywords(cls, v: object) -> object:
        if isinstance(v, str):
            try:
                v = json.loads(v)
            except json.JSONDecodeError:
                raise ValueError(f"keywords 格式无效，应为数组，收到字符串: {v!r}")
        return v

    @field_validator("providers", mode="before")
    @classmethod
    def _validate_providers(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        # 兼容模型将数组错误序列化为 JSON 字符串的情况，如 "[\"my_library\"]"
        if isinstance(v, str):
            # 空字符串视为未传参数
            if not v.strip():
                return None
            try:
                parsed = json.loads(v)
                # JSON 解析成功但结果是字符串（如 `"system"`），当作单个 provider 处理
                v = [parsed] if isinstance(parsed, str) else parsed
            except json.JSONDecodeError:
                # 裸字符串（如 `system`），当作单个 provider 处理
                v = [v.strip()]
        if not v:
            return None
        invalid = [p for p in v if p not in _VALID_PROVIDERS]
        if invalid:
            raise ValueError(
                f"无效 provider：{invalid}，可选值：{sorted(_VALID_PROVIDERS)}"
            )
        return v

    @model_validator(mode="after")
    def _validate_empty_keywords(self) -> "FindSkillsParams":
        if not self.keywords:
            _list_all_providers = {"my_library", "system"}
            if not self.providers or not all(p in _list_all_providers for p in self.providers):
                raise ValueError(
                    "keywords 为空时，providers 必须且只能为 [\"my_library\"] 或 [\"system\"]"
                )
        return self


@tool()
class FindSkillsTool(BaseTool[FindSkillsParams]):
    """<!--zh
    按关键词检索可用 skill，来源包括：系统内置（最高优先级）、我的技能库、Magic 市场、SkillHub、ClawHub。
    支持多关键词批量检索，结果按关键词分组，附带推荐项和使用指引。
    找到候选后：
    - provider=system（builtin=true）：直接调用 read_skills 加载，无需安装；
    - 其他来源：有 ≥2 个候选时先用 ask_user(multi_select) 让用户选择，再调用 install_skills 安装；
      只有 1 个强匹配时，可直接向用户确认后安装。
    若用户想查看自己技能库的全部内容，使用 keywords=[] + providers=["my_library"]。
    若用户想查看系统内置 skill 的全部内容，使用 keywords=[] + providers=["system"]。
    -->
    Search for available skills by keywords across enabled sources
    (system built-ins with highest priority, my_library, market, skillhub, clawhub).
    Supports multiple keywords; results are grouped by keyword with recommendations and usage hints.
    For builtin=true candidates (provider=system): load directly with read_skills, no install needed.
    For other candidates: when ≥2 exist, call ask_user(multi_select) before install_skills.
    For a single strong match, confirm with the user then install directly.
    To list all skills in my_library, use keywords=[] with providers=["my_library"].
    To list all system built-in skills, use keywords=[] with providers=["system"].
    """

    async def get_before_tool_call_friendly_action_and_remark(
        self, tool_name: str, tool_context: ToolContext, arguments: Dict[str, Any] = None
    ) -> Dict:
        args = arguments or {}
        kws = args.get("keywords", [])
        if isinstance(kws, str):
            try:
                kws = json.loads(kws)
            except (json.JSONDecodeError, ValueError):
                kws = []
        kw_str = "、".join(kws) if kws else i18n.translate("find_skills.keywords_all", category="tool.messages")
        return {
            "action": i18n.translate("find_skills", category="tool.actions"),
            "remark": i18n.translate("find_skills.searching", category="tool.messages", keywords=kw_str),
            "tool_name": tool_name,
        }

    async def execute(self, tool_context: ToolContext, params: FindSkillsParams) -> ToolResult:
        aggregator = SearchAggregator()
        result: SearchResult = await aggregator.search_many(
            params.keywords,
            providers=params.providers,
            query=params.query,
        )
        content = _format_result(result)

        total = sum(len(kr.candidates) for kr in result.keyword_results)
        return ToolResult(
            ok=True,
            content=content,
            extra_info={
                "total_candidates": total,
                "keywords": params.keywords,
                "providers": params.providers,
                # 供 get_tool_detail 展示用的 Markdown，与给模型的 XML 分离
                "md_content": _format_result_md(result),
            },
        )

    def _get_remark_content(self, result: ToolResult, arguments: Dict[str, Any] = None) -> str:
        extra = result.extra_info or {}
        total = extra.get("total_candidates", 0)
        kws = extra.get("keywords", [])
        providers = extra.get("providers")
        kw_str = "、".join(kws) if kws else i18n.translate("find_skills.keywords_all", category="tool.messages")
        # providers 为空或等于全量来源时，不在 remark 中展示来源
        is_partial = providers and set(providers) != _VALID_PROVIDERS
        if is_partial:
            return i18n.translate(
                "find_skills.searched_with_providers",
                category="tool.messages",
                keywords=kw_str,
                providers="、".join(providers),
                total=total,
            )
        return i18n.translate(
            "find_skills.searched",
            category="tool.messages",
            keywords=kw_str,
            total=total,
        )

    async def get_tool_detail(
        self,
        tool_context: ToolContext,
        result: ToolResult,
        arguments: Dict[str, Any] = None,
    ) -> Optional[ToolDetail]:
        extra = result.extra_info or {}
        md_content = extra.get("md_content")
        if not md_content:
            return None
        kws = extra.get("keywords", [])
        file_name = f"find_skills_{'_'.join(kws) or 'all'}.md"
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(
                file_name=file_name,
                content=md_content,
            ),
        )


# ── 格式化 ────────────────────────────────────────────────────────────────────


def _format_result(result: SearchResult) -> str:
    lines = ["<find_skills_result>"]

    has_any = False
    for kr in result.keyword_results:
        total = len(kr.candidates)
        lines.append(f'  <keyword value="{_esc(kr.keyword)}" total_candidates="{total}">')

        for c in kr.candidates:
            version_attr = f' version="{_esc(c.version)}"' if c.version else ""
            score_attr = f' score="{c.score:.2f}"'
            desc_attr = f' description="{_esc(c.description)}"' if c.description else ""
            builtin_attr = ' builtin="true"' if c.provider.value == "system" else ""
            lines.append(
                f'    <candidate provider="{c.provider.value}" id="{_esc(c.id)}" '
                f'name="{_esc(c.name)}"{version_attr}{score_attr}{desc_attr}{builtin_attr} />'
            )
            has_any = True

        # 报告该关键词的 provider 错误
        for pid, err in (kr.provider_errors or {}).items():
            lines.append(f'    <error provider="{pid}" message="{_esc(err)}" />')

        lines.append("  </keyword>")

    # 全量列出时不输出 recommendation / next_step（结果无排序意义，无需引导安装）
    is_list_all = all(not kr.keyword for kr in result.keyword_results)

    if not is_list_all:
        # 推荐项（取所有候选中分最高的）
        all_candidates = result.all_candidates
        if all_candidates:
            top = all_candidates[0]
            rec = (
                f'For best match, recommend {top.provider.value}:{top.id} ("{top.name}"). '
                "Review all candidates before installing."
            )
            lines.append(f"  <recommendation>{rec}</recommendation>")

        # next_step 指引
        if has_any:
            lines.append(
                "  <next_step>"
                "For builtin=true candidates (provider=system): they are pre-installed; "
                "load them directly with read_skills(skill_names=[\"<id>\"]). No install needed. "
                "For other candidates: if multiple exist, use ask_user(multi_select) to let the user choose, "
                "then call install_skills(items=[{provider:..., id:..., mode:\"install\"}]). "
                "If only one strong match exists, you may call install_skills directly after confirming with the user."
                "</next_step>"
            )
        else:
            lines.append(
                "  <next_step>"
                "No candidates found. Try different keywords or a more specific description."
                "</next_step>"
            )

    lines.append("</find_skills_result>")
    return "\n".join(lines)


def _esc(s: str | None) -> str:
    if not s:
        return ""
    return s.replace("&", "&amp;").replace('"', "&quot;").replace("<", "&lt;").replace(">", "&gt;")


# ── Markdown 展示格式（供 get_tool_detail 渲染，与给模型的 XML 完全独立） ────────

_PROVIDER_LABEL: dict[str, str] = {
    "system":     "内置",
    "my_library": "我的技能库",
    "market":     "Magic 市场",
    "skillhub":   "SkillHub",
    "clawhub":    "ClawHub",
    "npx":        "NPX",
    "github":     "GitHub",
}

_DESC_MAX_LEN = 80


def _truncate(s: str, max_len: int = _DESC_MAX_LEN) -> str:
    s = s.strip().replace("\n", " ").replace("\r", "")
    return s if len(s) <= max_len else s[:max_len] + "..."


def _format_result_md(result: SearchResult) -> str:
    lines: list[str] = []

    total = sum(len(kr.candidates) for kr in result.keyword_results)
    kws = [kr.keyword for kr in result.keyword_results if kr.keyword]

    # 标题行
    if kws:
        kw_str = "、".join(f"`{kw}`" for kw in kws)
        lines.append(f"**搜索关键词**：{kw_str}　共找到 **{total}** 个候选\n")
    else:
        lines.append(f"全量列出　共 **{total}** 个 Skill\n")

    has_any = False
    for kr in result.keyword_results:
        if not kr.candidates and not kr.provider_errors:
            continue

        kw_label = f"`{kr.keyword}`" if kr.keyword else "全部"
        lines.append(f"---\n\n### {kw_label}（{len(kr.candidates)} 个结果）\n")

        if kr.candidates:
            lines.append("| 名称 | 来源 | 描述 |")
            lines.append("|------|------|------|")
            for c in kr.candidates:
                label = _PROVIDER_LABEL.get(c.provider.value, c.provider.value)
                name_cell = f"**{c.name}** `内置`" if c.provider.value == "system" else f"**{c.name}**"
                # 版本号拼入来源列
                version_note = f" · {c.version}" if c.version else ""
                source_cell = f"{label}{version_note}"
                desc_cell = _truncate(c.description) if c.description else "-"
                lines.append(f"| {name_cell} | {source_cell} | {desc_cell} |")
            lines.append("")
            has_any = True

        for pid, err in (kr.provider_errors or {}).items():
            label = _PROVIDER_LABEL.get(pid, pid)
            lines.append(f"> **{label}** 搜索失败：{err}\n")

    # 全量列出时不输出推荐（无排序意义）
    is_list_all = not kws
    if not is_list_all:
        all_c = result.all_candidates
        if all_c:
            top = all_c[0]
            label = _PROVIDER_LABEL.get(top.provider.value, top.provider.value)
            action = "读取" if top.provider.value == "system" else "安装"
            lines.append(f"---\n\n**最佳推荐**：`{top.id}`（{label} · {top.name}）\n")
            if top.provider.value == "system":
                lines.append(f"> 内置 Skill，可直接使用 `read_skills(skill_names=[\"{top.id}\"])` 加载，无需安装。")
            else:
                lines.append(f"> 可通过 `install_skills` {action}后使用。")

    if not has_any:
        lines.append("\n---\n\n> 未找到匹配的 Skill，请尝试不同的关键词。")

    return "\n".join(lines)
