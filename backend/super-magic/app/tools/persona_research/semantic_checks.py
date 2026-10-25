"""persona-research 的两道语义检查：人设是否改写式泄漏结论、主持人是否一次问两件事。

关键词和规则先做初筛，命中或需要时再用一次小模型调用判定。规则管不住换说法：
| 漏洞             | 规则初筛                               | 为什么还要语义判定                                   |
| 人设改写式泄漏   | save_personas 匹配假设的 outcome_terms | 「怕再办一张又剩着」就是「用不完」换了说法，关键词匹配不到 |
| 单问号连问       | asks_joined_questions 数提问分句       | 「那次怎么回事？比如几点、和谁」是同一问的细节提示，规则分不清 |

判定失败（模型不可用、超时、返回不是 JSON）一律放行，并由调用方在结果里写明「语义检查未执行」：
它是第二道防线，不能因为检查本身出错卡住研究。
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from agentlang.context.tool_context import ToolContext
from agentlang.llms.factory import LLMFactory
from agentlang.logger import get_logger
from app.core.ai_abilities import AIAbility, get_ability_config
from app.core.context.run_interruption import await_with_interruption
from app.tools.core.tool_keepalive import start_tool_keep_alive, stop_tool_keep_alive
from app.tools.media_utils.constants import DISABLE_THINKING_BODY

logger = get_logger(__name__)

FALLBACK_MODEL_ID = "auto"
LEAK_JUDGE_MAX_TOKENS = 800
QUESTION_JUDGE_MAX_TOKENS = 120


class JudgeUnavailable(Exception):
    """语义判定没有给出可用结果；调用方放行并说明。"""


def resolve_model_id(agent_context: Any) -> str:
    """专属模型优先；未配置时跟随当前对话的文本模型，它一定在用户套餐内。"""
    configured = get_ability_config(AIAbility.PERSONA_CHAT, "model_id")
    if isinstance(configured, str) and configured.strip():
        return configured.strip()
    model_context = getattr(agent_context, "model_context", None)
    current = getattr(model_context, "current_text_model_id", None)
    return current.strip() if isinstance(current, str) and current.strip() else FALLBACK_MODEL_ID


async def ask_json(tool_context: Optional[ToolContext], system: str, user: str, max_tokens: int) -> Dict[str, Any]:
    """一次关闭思考的模型调用，返回解析后的 JSON 对象；任何失败都抛 JudgeUnavailable。"""
    agent_context = tool_context.get_extension("agent_context") if tool_context else None
    model_id = resolve_model_id(agent_context)
    interruption_event = agent_context.get_interruption_event() if agent_context else None
    keep_alive_task = start_tool_keep_alive(tool_context) if tool_context else None
    try:
        llm_config = LLMFactory.get_model_config(model_id).model_copy(deep=True)
        llm_config.max_output_tokens = max_tokens
        response = await await_with_interruption(
            LLMFactory.call_with_tool_support(
                model_id=model_id,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                tools=None,
                stop=None,
                extra_body=DISABLE_THINKING_BODY,
                llm_config=llm_config,
            ),
            interruption_event,
        )
        text = response.choices[0].message.content if response and response.choices else ""
        return _parse_json_object(text or "")
    except JudgeUnavailable:
        raise
    except Exception as exc:  # CancelledError 是 BaseException，不会在这里被吞掉
        logger.warning(f"persona-research 语义检查调用失败 model={model_id}: {exc}")
        raise JudgeUnavailable(str(exc)) from exc
    finally:
        stop_tool_keep_alive(keep_alive_task)


def _parse_json_object(text: str) -> Dict[str, Any]:
    """接受裸 JSON 或 ```json 代码块；取第一个 { 到最后一个 }。"""
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise JudgeUnavailable("the judge did not return JSON")
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise JudgeUnavailable(f"the judge returned invalid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise JudgeUnavailable("the judge did not return a JSON object")
    return data


# ── 单问号连问 ─────────────────────────────────────────────────────────────

_QUOTED = re.compile(r"“[^”]*”|「[^」]*」|『[^』]*』|‘[^’]*’|\"[^\"]*\"")
_SENTENCE_BREAK = re.compile(r"[。！!？?]+|(?<=[a-zA-Z])\.\s")
_CLAUSE_BREAK = re.compile(r"[，,；;：:—]+")
_ASKS = re.compile(
    r"什么|怎么|为什么|为啥|哪|多少|几[次个天回件块分钟岁家趟]|是否|会不会|能不能|有没有|要不要|是不是|吗$|呢$"
    r"|\b(what|how|why|which|would|will|do|does|did|is|are|can|could)\b",
    re.IGNORECASE,
)
# 细节提示分句：补充同一个问题要讲什么，不算第二问。
_ELABORATION = re.compile(
    r"^(比如|例如|像是|具体|尽量|越具体|从头|讲讲|说说|聊聊|举个|举一个|想到什么|不用|随便"
    r"|for example|e\.g\.|such as|tell me|walk me)",
    re.IGNORECASE,
)


def asks_joined_questions(text: str) -> bool:
    """初筛：问号不超过一个、但全文有 2 个及以上提问分句时为 True；引号里的受访者原话不计。

    多个问号由 persona_chat 直接拒绝，这里不管。没有问号也要数：被拒过的主持人会把问号换成句号，
    例：「什么情况下你会觉得这张卡不值，那种时候你最不敢把哪件衣服放进去。」→ True。
    「什么样的会员你不会买，如果这条解决了你会买吗？」→ True（交给语义判定）。
    「那次从头到尾怎么回事？比如几点、和谁」→ False（「比如」开头的分句是细节提示）。
    回测 9 项研究 57 个不超过一个问号的提问：命中 20 个，由语义判定区分真连问和细节提示。
    """
    masked = _QUOTED.sub("X", text)
    if len(re.findall(r"[？?]", masked)) >= 2:
        return False
    asks = 0
    for sentence in _SENTENCE_BREAK.split(masked):
        # 句中一旦出现「比如、具体说说」等细节提示，后面的分句都算这条提示的展开。
        elaborating = False
        for clause in (c.strip() for c in _CLAUSE_BREAK.split(sentence)):
            if not clause:
                continue
            if _ELABORATION.match(clause):
                elaborating = True
            elif not elaborating and _ASKS.search(clause):
                asks += 1
    return asks >= 2


_QUESTION_JUDGE_PROMPT = """\
You check one moderator message from a qualitative research interview. Decide whether it asks the participant about two or more different things that each need their own answer.

- Two things: "What kind of membership would you not buy, and if that were fixed, would you buy it?"
- One thing with detail prompts: "Walk me through that time: when it was, who was there, how you decided."
- One thing that restates the participant's words first: "You said it felt risky. Risky how?"
- One thing that asks for an answer plus its basis: "What is the most you would pay a month? Give me a number and how you got to it." Asking why, how they decided, or what it is based on belongs to the same answer.
- Two things ending with a period instead of a question mark still count as two: "When would the card not be worth it, and which clothes would you never put in that machine."

Reply with JSON only: {"two_questions": true or false, "reason": "<one short sentence>"}"""


async def judge_joined_question(tool_context: Optional[ToolContext], question: str) -> str:
    """问了两件不同的事时返回原因，否则返回空字符串；判定不可用时抛 JudgeUnavailable。"""
    data = await ask_json(tool_context, _QUESTION_JUDGE_PROMPT, f"Moderator message:\n{question}", QUESTION_JUDGE_MAX_TOKENS)
    if data.get("two_questions") is True:
        return str(data.get("reason") or "it asks two different things").strip()
    return ""


# ── 人设改写式泄漏 ─────────────────────────────────────────────────────────

STANCE_FIELDS = ("tagline", "tags", "expression", "needs_pains", "tech_adoption", "decision_weights")


@dataclass(frozen=True)
class Leak:
    persona: str  # 判定输入里的人设标签，例如 P2
    field: str
    hypothesis_id: str
    text: str
    why: str


_LEAK_JUDGE_PROMPT = """\
You audit AI personas for a consumer research study before they are interviewed. A persona leaks a hypothesis only when one of its stance fields states or predicts the persona's attitude, preference, worry, intention, or verdict about what the hypothesis tests, as a general conclusion rather than a concrete event.

Concrete past events are never leaks, even when they are about the same topic as the hypothesis. A dated, specific thing that happened (when, what, at what cost) describes a situation; the persona's later answer is still open. The study is about these situations, so topic overlap alone is not a leak.
- Leak: needs_pains "afraid of buying another card and leaving sessions unused again", for a hypothesis about unused sessions.
- Leak: needs_pains "schedules change every week, so my commute keeps breaking" (a standing conclusion with no event), for a hypothesis about schedule changes breaking commutes.
- Not a leak: needs_pains "last month moved to the night shift and found the bus runs every 30 minutes at that hour" (a dated event).
- Not a leak: behavior "last year's 10-session card: used 6, the rest expired".
- Leak: tagline "only trusts tools that peers have used for months", for a hypothesis about peer referrals.
- Leak: expression "I can't know what other people washed in there, so I won't go", for a hypothesis about hygiene worries outweighing price. Quotes in expression count as the persona's stated attitude.

Check every field, including each expression line. When unsure, do not flag: only flag a field when you can name the attitude or verdict it states.

Reply with JSON only: {"leaks": [{"persona": "<label such as P1>", "field": "<field name>", "hypothesis_id": "<such as H1>", "text": "<the leaking text, copied>", "why": "<one short sentence in English>"}]}. Use an empty list when nothing leaks."""


async def judge_persona_leaks(
    tool_context: Optional[ToolContext],
    hypotheses: List[Dict[str, str]],
    personas: Dict[str, Dict[str, List[str]]],
) -> List[Leak]:
    """一次调用判全部人设。personas 以标签（P1、P2…）为键、立场性字段文本为值。

    只保留标签、字段、假设都在输入里的判定，丢掉模型编造的条目。
    """
    payload = json.dumps({"hypotheses": hypotheses, "personas": personas}, ensure_ascii=False, indent=1)
    data = await ask_json(tool_context, _LEAK_JUDGE_PROMPT, payload, LEAK_JUDGE_MAX_TOKENS)
    items = data.get("leaks")
    if not isinstance(items, list):
        raise JudgeUnavailable("the judge returned no leaks list")
    known_ids = {h["id"] for h in hypotheses}
    leaks = []
    for item in items:
        if not isinstance(item, dict):
            continue
        leak = Leak(
            persona=str(item.get("persona") or "").strip(),
            field=str(item.get("field") or "").strip(),
            hypothesis_id=str(item.get("hypothesis_id") or "").strip(),
            text=str(item.get("text") or "").strip(),
            why=str(item.get("why") or "").strip(),
        )
        if leak.persona in personas and leak.field in STANCE_FIELDS and leak.hypothesis_id in known_ids:
            leaks.append(leak)
    return leaks
