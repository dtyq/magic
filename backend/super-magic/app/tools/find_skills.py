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
_VALID_PROVIDERS = {"my_library", "market", "skillhub", "clawhub"}


class FindSkillsParams(BaseToolParams):
    """find_skills 工具参数"""

    keywords: List[str] = Field(
        default_factory=list,
        description=(
            "<!--zh: 搜索关键词或意图描述（数组），每个关键词独立检索后归并去重。"
            "若要列出我的技能库全部内容，传空数组 [] 并设置 providers=[\"my_library\"]。"
            "例如：[\"天气\", \"日历同步\"]-->\n"
            "Search keywords or intent descriptions (array); each keyword is queried independently then merged. "
            "To list all skills in my_library, pass [] and set providers=[\"my_library\"]. "
            "E.g. [\"weather\", \"calendar sync\"]."
        ),
        max_length=10,
    )
    providers: Optional[List[str]] = Field(
        None,
        description=(
            "<!--zh: 限定搜索来源（可选）。可选值：my_library | market | skillhub | clawhub。"
            "不传则同时搜索所有来源。keywords 为空时此字段必须且只能为 [\"my_library\"]。"
            "例如：[\"market\", \"skillhub\"]-->\n"
            "Restrict search to specific providers (optional). "
            "Options: my_library | market | skillhub | clawhub. "
            "Omit to search all sources. When keywords is [], this must be [\"my_library\"]. "
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
            try:
                v = json.loads(v)
            except json.JSONDecodeError:
                raise ValueError(f"providers 格式无效，应为数组，收到字符串: {v!r}")
        invalid = [p for p in v if p not in _VALID_PROVIDERS]
        if invalid:
            raise ValueError(
                f"无效 provider：{invalid}，可选值：{sorted(_VALID_PROVIDERS)}"
            )
        return v

    @model_validator(mode="after")
    def _validate_empty_keywords(self) -> "FindSkillsParams":
        if not self.keywords:
            if self.providers != ["my_library"]:
                raise ValueError(
                    "keywords 为空时，providers 必须且只能为 [\"my_library\"]"
                )
        return self


@tool()
class FindSkillsTool(BaseTool[FindSkillsParams]):
    """<!--zh
    按关键词检索可用 skill，来源包括：我的技能库、Magic 市场、SkillHub、ClawHub。
    支持多关键词批量检索，结果按关键词分组，附带推荐项和安装指引。
    找到候选后：有 ≥2 个候选时先用 ask_user(multi_select) 让用户选择，再调用 install_skills 安装；
    只有 1 个强匹配时，可直接向用户确认后安装。
    若用户想查看自己技能库的全部内容，使用 keywords=[] + providers=["my_library"]。
    -->
    Search for available skills by keywords across enabled sources
    (my_library, market, skillhub, clawhub).
    Supports multiple keywords; results are grouped by keyword with recommendations and install hints.
    When ≥2 candidates exist, call ask_user(multi_select) for user selection before install_skills.
    For a single strong match, confirm with the user then install directly.
    To list all skills in my_library, use keywords=[] with providers=["my_library"].
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
        )
        content = _format_result(result)

        total = sum(len(kr.candidates) for kr in result.keyword_results)
        return ToolResult(
            ok=True,
            content=content,
            # 把 pydantic 已验证的值存入 extra_info，供 remark/detail 直接使用
            extra_info={
                "total_candidates": total,
                "keywords": params.keywords,
                "providers": params.providers,
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
        if not result.content:
            return None
        kws = (result.extra_info or {}).get("keywords", [])
        file_name = f"find_skills_{'_'.join(kws) or 'all'}.md"
        return ToolDetail(
            type=DisplayType.MD,
            data=FileContent(
                file_name=file_name,
                content=f"```xml\n{result.content}\n```",
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
            lines.append(
                f'    <candidate provider="{c.provider.value}" id="{_esc(c.id)}" '
                f'name="{_esc(c.name)}"{version_attr}{score_attr}{desc_attr} />'
            )
            has_any = True

        # 报告该关键词的 provider 错误
        for pid, err in (kr.provider_errors or {}).items():
            lines.append(f'    <error provider="{pid}" message="{_esc(err)}" />')

        lines.append("  </keyword>")

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
            "If multiple candidates exist, use ask_user(multi_select) to let the user choose, "
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
