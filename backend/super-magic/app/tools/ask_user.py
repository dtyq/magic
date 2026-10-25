"""ask_user 工具：向用户提问并暂停当前 Agent 轮次。"""

import hashlib
import json
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Literal, Optional, Tuple
from xml.sax.saxutils import escape

from pydantic import Field, model_validator

from agentlang.context.tool_context import ToolContext
from agentlang.logger import get_logger
from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.tools.ask_user_parser import (
    AskUserQuestionParseError,
    QuestionRepair,
    parse_questions_xml_with_report,
)
from app.core.entity.message.server_message import (
    AskUserQuestionContent,
    AskUserResultContent,
    DisplayType,
    ToolDetail,
)
from app.core.context.execution_source import (
    SuperMagicExecutionSource,
    is_ask_user_allowed_source,
)
from app.tools.core.base_tool_params import BaseToolParams
from app.tools.core.base_user_tool_call_tool import BaseUserToolCallTool, ResultBuilder, TimeoutAnswerBuilder
from app.tools.core.tool_decorator import tool

logger = get_logger(__name__)

# 用户可见的等待策略只有两档：默认一直等待，简单选择题最多等待 60 秒。
ASK_USER_TIMEOUT_SECONDS = 60
ASK_USER_NO_TIMEOUT = 0
ASK_USER_POLICY_SKIP_SECONDS = 1


@dataclass
class _AskUserPreparation:
    """同次调用私有的解析状态，不接受模型通过工具参数伪造。"""

    fingerprint: str
    questions: List[dict]
    repairs: tuple[QuestionRepair, ...] = ()
    error_code: str = ""
    repair_notified: bool = False
    bound_preparation_id: str = ""
    ready: bool = False


class AskUserParams(BaseToolParams):
    prepared_tool_call_id: str | None = Field(
        default=None,
        description="Bind a prepared operation, including skill publication. Omit questions: the runtime supplies the exact confirmation question. Never invent a confirmation ID.",
    )
    questions: str = Field(
        default="",
        description="""<!--zh: 用 XML 格式描述要问用户的问题。支持 type: confirm / input / select / multi_select。每个问题用 <question> 标签包裹。-->
Questions in XML format. Wrap each question in a <question> tag with a `type` attribute (confirm / input / select / multi_select). For select/multi_select, add <option> children. Optional attributes: default, placeholder, min, max.""",
    )
    timeout: Optional[Literal[60]] = Field(
        default=None,
        description="""<!--zh: 可选等待时间。默认不传，表示一直等用户回答；只有简单的是否确认或单选、每题都有安全默认值时才传 60。包含输入题、需要思考或会明显影响后续方向的问题不要传 timeout。-->
Optional response deadline. Omit it by default to wait for the user indefinitely. Set it to 60 only for simple confirm or single-select questions where every question has a safe default. Omit timeout for input questions, questions that need thought, or decisions that can materially change the next steps.""",
    )


    @model_validator(mode="after")
    def require_questions_or_preparation(self) -> "AskUserParams":
        if not self.questions and not self.prepared_tool_call_id:
            raise ValueError("questions is required unless prepared_tool_call_id is supplied")
        return self


@tool()
class AskUserTool(BaseUserToolCallTool[AskUserParams]):
    """<!--zh
    向用户提问并等待回答。用于获取缺失信息、让用户做选择、或在执行高危操作前取得用户确认。
    只有主 Agent 可以调用；如果你是被其他 Agent 调用的，不要使用此工具。
    -->
    Ask the user questions and wait for their answer. Use this to gather missing information, let the user choose between options, or get explicit confirmation before performing risky operations.
    Only the main agent can call this tool; if you were invoked by another agent, do not use it.
    """

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
何时调用 ask_user：
- 缺少无法合理推断的关键信息（目标路径、凭据、格式偏好等）
- 需要用户在多个可行方案间做方向选择
- 即将执行不可逆操作，需要用户明确确认（见下方高危规则）
- 任务范围模糊，不澄清就可能做错

高危操作确认规则（即使用户已模糊表达意图也必须遵守）：
1. 删除文件/目录——列出完整待删清单，每项附简短说明（文件名、用途、大小），用日常语言概括总体影响，然后 confirm
2. 批量覆盖/重命名——列出变更前后对照表，confirm
3. shell 中带删除语义的命令（rm、find -delete 等）——先 dry-run 列出受影响文件，用日常语言向用户解释结果，confirm 后再执行
4. 发送消息、调用外部 API 等不可撤回操作——说明将发送的内容和目标，confirm
5. 修改系统配置、环境变量、定时任务——说明变更内容和可能影响，confirm

等待时间策略（必须遵守）：
- 默认不传 timeout，表示一直等用户回答。
- 只有简单的 confirm 或单选 select，且每道题都有安全默认值时，才传 timeout=60。
- input、多题填写、需要用户思考或会明显影响后续方向的问题，不传 timeout。
- 不要使用其它等待时长。用户需要较长时间时，宁可一直等待，也不要替用户决定。

问题撰写要求（适用于所有类型的提问）：
- 假设用户不懂技术，使用日常语言，不要只贴命令或裸路径
- 文件相关操作：列出文件名 + 简短说明（这个文件是什么），而不是只有路径
- 说明影响范围和后果（涉及多少文件、会不会丢数据、能否恢复）
- 数量多（>10 项）时先给一句话汇总，再列明细
- 选项式提问（select/multi_select）时，每个选项附一句描述帮助用户理解区别

交互类型选择优先级：
- 优先使用 confirm / select / multi_select，让用户通过点击完成回答，减少打字
- 是/否、继续/取消、允许/不允许这类问题，使用 confirm，不要使用 input
- 如果可以列出 2~8 个常见答案，使用 select；即使不确定是否覆盖全部情况，也使用 select，因为系统会自动追加"其他"自由输入选项
- 如果用户可能同时需要多个答案，使用 multi_select，并设置合理的 min/max
- 只有当答案必须是用户自定义文本，且无法合理提供候选项时，才使用 input
- 路径、文件名、项目名、账号、密钥、自然语言要求等确实需要用户精确填写的信息，才使用 input
- 当用户需要回答某个具体问题时，question 是要回答的问题，option 是这个问题的候选答案；不要把多个不同问题放进 option 让用户选择要回答哪个问题

不应调用：
- 可用合理默认值的偏好问题
- 用户已在上文提供过的信息
- 被其他 Agent 调用时（此时应自行判断或将未决信息写入返回结果）
- 用户消息来自 IM 渠道时，此类渠道无法展示交互式问题，应自行判断或在回复中说明需要哪些信息

questions 参数的 XML 格式示例：

<question type="confirm">删除这 5 个临时文件？(共 2.1 MB，仅工作区)</question>

<question type="select">
你偏好哪种输出格式？
<option>PDF — 最适合分享和打印</option>
<option>Markdown — 方便后续编辑</option>
</question>

<question type="input" placeholder="例如 my-project">项目名称？</question>

<question type="multi_select" min="1" max="3">
要启用哪些功能：
<option>身份认证</option>
<option>数据库</option>
<option>API 网关</option>
</question>

支持的类型：confirm、input、select、multi_select。
select/multi_select 会自动追加一个"其他"自由输入选项。
使用 timeout=60 时，必须为每道题设置安全的 default 属性；不设置 timeout 时不要依赖默认值自动结束问题。
-->
When to call ask_user:
- Must-know information that cannot be reasonably inferred (target path, credentials, format preference, etc.)
- A directional decision where multiple valid approaches exist
- About to perform an irreversible action that needs explicit user confirmation (see destructive-op rules below)
- Task scope is ambiguous enough that proceeding without clarification risks wasted effort

Destructive / irreversible operation rules (MUST confirm even when the user casually asked for it):
1. File/directory deletion — list every file with a brief description (name, purpose, size), summarize overall impact in plain language, then confirm.
2. Batch overwrite/rename — show a before-vs-after comparison table, then confirm.
3. Shell commands with delete semantics (rm, find -delete, etc.) — dry-run first to list affected files, explain the result in plain language, then confirm before executing.
4. Sending messages or calling external APIs (non-reversible) — describe what will be sent and to where, then confirm.
5. Changing system config, env vars, or cron jobs — explain the change and potential impact, then confirm.

Response deadline policy (MUST follow):
- Omit timeout by default; wait for the user indefinitely.
- Set timeout=60 only for simple confirm or single-select questions where every question has a safe default.
- Omit timeout for input questions, multi-question forms, questions that need thought, or decisions that can materially change the next steps.
- Do not use any other deadline. When the user may need more time, keep waiting instead of deciding for them.

How to write good questions (applies to ALL question types, not only destructive confirmations):
- Assume the user may not be technical. Use everyday language; do not paste raw commands or bare paths.
- For file operations, show filename + brief explanation of what the file is, not just a path.
- State scope and consequences: how many items are affected, will data be lost, is it reversible.
- For large sets (>10 items), give a one-line summary first, then the detailed list.
- For select/multi_select, add a short description to each option to help the user tell them apart.

Interaction type priority:
- Prefer confirm / select / multi_select so the user can answer by clicking with minimal typing.
- Use confirm for yes/no, continue/cancel, allow/deny questions; do not use input for these.
- If you can list 2-8 common answers, use select. Use select even when the list may not cover every case, because the system auto-appends an "Other" free-input option.
- If the user may need more than one answer, use multi_select with reasonable min/max limits.
- Only use input when the answer must be custom free text and no useful candidate options can be provided.
- Use input for exact custom values such as paths, filenames, project names, accounts, secrets, or natural-language requirements that the user must write precisely.
- When the user needs to answer a specific question, the question text is the question to answer and option elements are candidate answers to that question; do not put multiple different questions in option elements for the user to choose which question to answer.

Do NOT call when:
- A sensible default exists and the choice is a trivial preference
- The user already provided the information in this conversation
- You were invoked by another agent (use your best judgment or surface unresolved info in your result instead)
- The user message comes from an IM channel; these channels cannot render interactive questions — use your best judgment or state what information you need in your reply instead

XML format for the `questions` parameter:

```
<question type="confirm">Delete these 5 temporary files? (total 2.1 MB, workspace only)</question>

<question type="select">
Which output format do you prefer?
<option>PDF — best for sharing and printing</option>
<option>Markdown — easy to edit later</option>
</question>

<question type="input" placeholder="e.g. my-project">Project name?</question>

<question type="multi_select" min="1" max="3">
Features to enable:
<option>Auth</option>
<option>Database</option>
<option>API gateway</option>
</question>
```

Allowed types: confirm, input, select, multi_select.
For select/multi_select, the system auto-appends an "Other" free-input option.
When using timeout=60, every question must have a safe `default` attribute. Without timeout, do not rely on an automatic fallback.
"""

    user_tool_call_timeout: Optional[int] = None

    async def _prepare(self, tool_context: ToolContext) -> None:
        """准备完整问卷，保留同次解析身份及可恢复格式的修复报告。"""

        cached_preparation = tool_context.get_extension("ask_user_preparation")
        if isinstance(cached_preparation, _AskUserPreparation):
            cached_preparation.ready = False
        raw_xml = tool_context.arguments.get("questions", "")
        source = self._get_execution_source(tool_context)
        prepared_id = tool_context.arguments.get("prepared_tool_call_id")
        if prepared_id and is_ask_user_allowed_source(source):
            from app.service.prepared_operation_confirmation import PreparedOperationConfirmation

            confirmation = PreparedOperationConfirmation.from_tool(tool_context)
            prepared = await confirmation.read(str(prepared_id))
            raw_xml = f'<question type="confirm">{escape(prepared.question)}</question>'
            tool_context.arguments["questions"] = raw_xml
        arguments = tool_context.arguments
        fingerprint = hashlib.sha256(raw_xml.encode("utf-8")).hexdigest()
        preparation = tool_context.get_extension("ask_user_preparation")
        if not isinstance(preparation, _AskUserPreparation) or preparation.fingerprint != fingerprint:
            preparation = _AskUserPreparation(fingerprint=fingerprint, questions=[])
            try:
                parsed = parse_questions_xml_with_report(raw_xml)
                preparation.questions = parsed.questions
                preparation.repairs = parsed.repairs
                if not parsed.questions:
                    preparation.error_code = "missing_questions"
            except AskUserQuestionParseError as error:
                preparation.error_code = error.code
                logger.warning(f"ask_user 问卷无法完整解析: 类别={error.code}, 题序={error.question_index}")
            tool_context.register_extension("ask_user_preparation", preparation)
        arguments["parsed_questions"] = preparation.questions
        arguments["status"] = "pending" if preparation.questions else "error"
        if not preparation.questions:
            return

        policy_blocked = not is_ask_user_allowed_source(source)
        tool_context.arguments["ask_user_policy_blocked"] = policy_blocked
        tool_context.arguments["ask_user_policy_source"] = source.value

        if policy_blocked:
            preparation.ready = True
            tool_context.arguments["expires_at"] = int(time.time()) + ASK_USER_POLICY_SKIP_SECONDS
            return

        if prepared_id:
            parsed = tool_context.arguments["parsed_questions"]
            # 同次展示重读仍验证快照权限，但不能重复绑定已进入 waiting 的操作。
            if preparation.bound_preparation_id != str(prepared_id):
                await confirmation.bind(str(prepared_id), tool_context.tool_call_id, parsed[0]["sub_id"])
                preparation.bound_preparation_id = str(prepared_id)
            # 准备好的操作等待真人决定，不以超时答案代替确认。
            tool_context.arguments["expires_at"] = 0
            preparation.ready = True
            return

        preparation.ready = True
        # 默认一直等待；只有简单选择题才允许使用 60 秒。
        tool_context.arguments["expires_at"] = ASK_USER_NO_TIMEOUT
        raw_timeout = tool_context.arguments.get("timeout")
        if raw_timeout != ASK_USER_TIMEOUT_SECONDS:
            return

        if self._allows_short_timeout(tool_context.arguments["parsed_questions"]):
            tool_context.arguments["expires_at"] = int(time.time()) + ASK_USER_TIMEOUT_SECONDS
            return

        logger.warning(
            "ask_user timeout=60 ignored because questions require more than a quick choice; "
            "waiting indefinitely instead"
        )

    @staticmethod
    def _allows_short_timeout(parsed_questions: List[dict]) -> bool:
        """只允许简单选择题使用短等待，避免截断用户输入或重要决策。"""
        if not parsed_questions:
            return False
        for question in parsed_questions:
            interaction_type = question.get("interaction_type")
            default_value = question.get("default_value")
            if interaction_type not in {"confirm", "select"}:
                return False
            if not isinstance(default_value, str) or not default_value.strip():
                return False
            if interaction_type == "select" and default_value not in (question.get("options") or []):
                return False
        return True

    @staticmethod
    def _get_execution_source(tool_context: ToolContext) -> SuperMagicExecutionSource:
        try:
            from app.core.context.agent_context import AgentContext
            agent_context: AgentContext = tool_context.get_extension_typed("agent_context", AgentContext)
            return agent_context.get_execution_source()
        except Exception:
            return SuperMagicExecutionSource.UNKNOWN

    def build_tool_data(self, tool_context: ToolContext) -> dict:
        """提取需要持久化的结构化数据。

        将 _prepare 阶段解析好的问题列表打包，服务重启后可用此数据重建回调。
        """
        return {
            "parsed_questions": tool_context.arguments.get("parsed_questions", []),
            "prepared_tool_call_id": tool_context.arguments.get("prepared_tool_call_id"),
            "policy_blocked": bool(tool_context.arguments.get("ask_user_policy_blocked", False)),
            "policy_source": tool_context.arguments.get(
                "ask_user_policy_source",
                SuperMagicExecutionSource.UNKNOWN.value,
            ),
        }

    async def execute(
        self,
        tool_context: ToolContext,
        params: AskUserParams,
    ) -> ToolResult:
        """完整问卷才注册等待；修复通知不会改变已注册成功的业务结果。"""
        preparation = tool_context.get_extension("ask_user_preparation")
        if not isinstance(preparation, _AskUserPreparation) or not preparation.ready or not preparation.questions:
            if isinstance(preparation, _AskUserPreparation) and preparation.error_code:
                message = (
                    "The ask_user questions could not be fully parsed. No questionnaire was registered. "
                    "Retry with complete question blocks, non-empty question text, and complete options for choice questions."
                )
            else:
                message = (
                    "The ask_user questionnaire was not prepared. No questionnaire was registered. "
                    "Check the operation preparation and execution permissions before retrying."
                )
            return ToolResult.error(message, use_custom_remark=False)
        result = await super().execute(tool_context, params)
        if result.ok and not tool_context.arguments.get("ask_user_policy_blocked"):
            self._notify_question_repairs(tool_context)
        return result

    def _notify_question_repairs(self, tool_context: ToolContext) -> None:
        """将本次修复事实排入 Horizon，等待下一次正常上下文注入。"""
        arguments = tool_context.arguments
        preparation = tool_context.get_extension("ask_user_preparation")
        if not isinstance(preparation, _AskUserPreparation) or not preparation.repairs or preparation.repair_notified:
            return
        kinds = sorted({repair.kind.value for repair in preparation.repairs})
        descriptions = {
            "wrong_close": "incorrect question-closing tags",
            "missing_close": "missing question-closing tags",
            "stray_container_close": "an unpaired outer closing tag",
        }
        repair_summary = ", ".join(descriptions[kind] for kind in kinds)
        question_count = len(arguments["parsed_questions"])
        content = (
            f"Your ask_user call {tool_context.tool_call_id} contained formatting issues "
            f"({repair_summary}). The runtime repaired them and prepared all {question_count} questions. "
            "The normal user-response flow continues; do not retry this call because of the formatting issue. "
            "Next time, explicitly close each question with the question closing tag, not its type name, "
            "and keep any outer container tags paired."
        )
        try:
            self.get_horizon(tool_context).push_notification("ask_user", escape(content))
            preparation.repair_notified = True
            logger.info(f"ask_user 格式已修复: 调用={tool_context.tool_call_id}, 题数={question_count}, 类别={','.join(kinds)}")
        except Exception:
            # 用户已获得完整问卷，提示入队失败不能触发重复注册或工具失败。
            logger.warning("ask_user 修复提示入队失败，保留正常问卷等待状态")

    def build_result_builder(self, tool_data: dict) -> ResultBuilder:
        """返回将用户回答转为模型上下文的闭包。

        闭包捕获当前问题列表，将 response_status 和 answer_json 转换为
        自然语言段落（content）和前端展示数据（extra_info）。
        """
        return build_ask_user_result_builder(
            tool_data.get("parsed_questions", []),
            policy_blocked=bool(tool_data.get("policy_blocked", False)),
            policy_source=str(tool_data.get("policy_source") or SuperMagicExecutionSource.UNKNOWN.value),
        )

    def build_timeout_answer_builder(self, tool_data: dict) -> TimeoutAnswerBuilder:
        """返回超时时构造默认答案的闭包。

        闭包遍历问题列表，取各题的 default_value 组装成 {sub_id: default} 的 JSON 字符串，
        随后交由 result_builder 按 timeout 状态处理。
        """
        return build_ask_user_timeout_answer_builder(tool_data.get("parsed_questions", []))

    def build_pending_content(self, tool_call_id: str, tool_data: dict) -> str:
        """返回等待期间写入 ToolResult.content 的提示文本。

        此文本会进入模型上下文，告知模型当前正在等待用户回答；
        同时携带 tool_call_id 供日志追踪。
        """
        n = len(tool_data.get("parsed_questions", []))
        return f"[ASK_USER:{tool_call_id}] {n} question(s) sent to user, waiting for response."

    async def get_tool_detail(self, tool_context: ToolContext, result: ToolResult, arguments: dict = None) -> Optional[ToolDetail]:
        """将有效结果转为问卷详情，将不可恢复输入展示为本地化错误。"""
        preparation = tool_context.get_extension("ask_user_preparation") if tool_context else None
        if result and not result.ok and isinstance(preparation, _AskUserPreparation) and preparation.error_code:
            return ToolDetail(type=DisplayType.TEXT, data={
                "message": i18n.translate("ask_user.invalid_questions", category="tool.messages"),
            })
        if not result or not result.extra_info:
            return None
        extra_info = result.extra_info
        status = extra_info.get("status")
        answers = extra_info.get("answers", {})
        questions = extra_info.get("questions", [])
        if not status:
            return None
        question_id = tool_context.tool_call_id if tool_context else ""
        return ToolDetail(
            type=DisplayType.ASK_USER,
            data=AskUserResultContent(
                question_id=question_id,
                status=status,
                questions=questions,
                answers=answers,
                remark=extra_info.get("remark") or None,
            ),
        )

    async def get_before_tool_detail(self, tool_context: ToolContext, arguments: dict = None) -> Optional[ToolDetail]:
        """仅发布准备完成的正式问卷，不把空列表伪装成可答状态。"""
        parsed = (arguments or {}).get("parsed_questions", [])
        preparation = tool_context.get_extension("ask_user_preparation")
        if not isinstance(preparation, _AskUserPreparation) or not preparation.ready or not parsed:
            return None
        return ToolDetail(
            type=DisplayType.ASK_USER,
            data=AskUserQuestionContent(
                question_id=tool_context.tool_call_id,
                questions=parsed,
                expires_at=tool_context.arguments.get("expires_at", 0),
                status="pending",
            ),
        )


# ─── ask_user 专属：结果构建与人类可读转换 ────────────────────────────────────

def build_ask_user_result_builder(
    parsed_questions: List[dict],
    policy_blocked: bool = False,
    policy_source: str = SuperMagicExecutionSource.UNKNOWN.value,
):
    """返回 ask_user 专属的 result_builder 闭包。

    result_builder(response_status, answer_json, remark) -> (content, extra_info)
    """
    def result_builder(response_status: str, answer_json: str, remark: str = "") -> Tuple[str, Dict[str, Any]]:
        # 兼容直接调用 builder 的旧代码，并避免异常类型影响答案解析。
        normalized_remark = remark.strip() if isinstance(remark, str) else ""
        try:
            answers: dict = json.loads(answer_json) if answer_json else {}
        except (json.JSONDecodeError, TypeError):
            answers = {}
        answers = _normalize_answer_keys(parsed_questions, answers)
        if policy_blocked:
            content = _humanize_policy_blocked(policy_source)
        else:
            content = _humanize_batch(
                questions=parsed_questions,
                response_status=response_status,
                answers=answers,
                remark=normalized_remark,
            )
        if policy_blocked and normalized_remark:
            content = f"{content}\n<remark>{_xml_escape(normalized_remark)}</remark>"
        extra_info = {
            "status": response_status,
            "answers": answers,
            "questions": parsed_questions,
            "policy_blocked": policy_blocked,
            "policy_source": policy_source,
        }
        if normalized_remark:
            extra_info["remark"] = normalized_remark
        return content, extra_info

    return result_builder


def _normalize_answer_keys(parsed_questions: List[dict], answers: dict) -> dict:
    """将旧 sub_id 或重建后不匹配的答案按题目顺序归一到当前问题 ID。"""
    if not isinstance(answers, dict) or not answers or not parsed_questions:
        return answers

    current_ids = [q.get("sub_id", "") for q in parsed_questions]
    if any(sub_id and sub_id in answers for sub_id in current_ids):
        return answers

    if len(answers) != len(parsed_questions):
        return answers

    # q-2 可能先于 q-0 被填写；明确的位置键优先，不能依赖字典插入顺序。
    position_keys = [f"q-{index}" for index in range(len(parsed_questions))]
    if all(key in answers for key in position_keys):
        return {question["sub_id"]: answers[key] for question, key in zip(parsed_questions, position_keys)}

    normalized = {}
    for question, answer in zip(parsed_questions, answers.values()):
        sub_id = question.get("sub_id", "")
        if not sub_id:
            return answers
        normalized[sub_id] = answer
    return normalized


def _humanize_policy_blocked(policy_source: str) -> str:
    return (
        "Ask User is unavailable because the current execution source is not an "
        f"interactive human chat (source: {policy_source}). This question was "
        "automatically skipped by system policy; do not wait for a user answer. "
        "If there is a safe default, continue with that default. If key "
        "information is missing, or if the operation is irreversible or risky "
        "(deletion, overwrite, external sending, payment, or system configuration "
        "changes), stop that step and explain what the user needs to provide in "
        "an interactive human chat."
    )


def build_ask_user_timeout_answer_builder(parsed_questions: List[dict]):
    """返回 ask_user 专属的 timeout_answer_builder 闭包。

    timeout_answer_builder() -> answer_json
    """
    def timeout_answer_builder() -> str:
        timeout_answers = {}
        for q in parsed_questions:
            sub_id = q.get("sub_id", "")
            default = q.get("default_value") or q.get("default", "")
            timeout_answers[sub_id] = default
        return json.dumps(timeout_answers, ensure_ascii=False)

    return timeout_answer_builder


def _xml_escape(text: str) -> str:
    """转义 XML 特殊字符，确保用户输入不破坏标签结构。"""
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _humanize_batch(
    questions: List[dict],
    response_status: str,
    answers: dict,
    remark: str = "",
) -> str:
    """将用户回答转换为 XML 结构化文本，供模型推理。

    answer 标签按 question 原始顺序一一对应（与模型发出的 questions 位置匹配），
    不重复 question 文本和 type，模型通过上下文中的 questions 获取对应关系。

    answers 格式为 {sub_id: answer_str}。
    """
    if response_status in ("timeout", "skipped"):
        lines = [f'<ask_user_result status="{response_status}">']
        has_no_default = False
        for q in questions:
            dv = q.get("default_value") or q.get("default")
            if dv is not None:
                lines.append(f"<answer>{_xml_escape(str(dv))}</answer>")
            else:
                has_no_default = True
                lines.append('<answer missing="true"/>')
        if remark:
            lines.append(f"<remark>{_xml_escape(remark)}</remark>")
        lines.append("</ask_user_result>")
        if has_no_default:
            lines.append("Some answers are missing with no default value. Decide whether to abort the related operation.")
        return "\n".join(lines)

    # answered
    lines = ['<ask_user_result status="answered">']
    for i, q in enumerate(questions):
        itype = q.get("interaction_type", "input")
        sub_id = q.get("sub_id", "")
        default = [] if itype == "multi_select" else ""
        # 优先用 sub_id（UUID，新前端）查找；找不到时 fallback 到 q-{index}（旧前端兼容格式）
        ans = answers.get(sub_id)
        if ans is None:
            ans = answers.get(f"q-{i}", default)

        if itype == "multi_select" and isinstance(ans, list):
            items = ", ".join(_xml_escape(str(a)) for a in ans)
            lines.append(f"<answer>{items}</answer>")
        else:
            lines.append(f"<answer>{_xml_escape(str(ans))}</answer>")
    if remark:
        lines.append(f"<remark>{_xml_escape(remark)}</remark>")
    lines.append("</ask_user_result>")
    return "\n".join(lines)
