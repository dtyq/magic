"""micro_app_plan 工具实现：向用户展示微应用开发计划并等待确认。"""

import json
import time
from typing import Any, Dict, List, Optional, Tuple, Union

from pydantic import BaseModel, Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.core.entity.message.server_message import DisplayType, PlanToolContent, ToolDetail
from app.tools.core.base_tool_params import BaseToolParams
from app.tools.core.base_user_tool_call_tool import BaseUserToolCallTool, ResultBuilder, TimeoutAnswerBuilder
from app.tools.core.tool_decorator import tool
from app.tools.micro_app_plan_normalizers import (
    normalize_data_model,
    normalize_files,
    normalize_string_list,
    normalize_text,
)

INTERNAL_TIMEOUT = 600

PLAN_STATUS_APPROVED = "approved"
PLAN_STATUS_REVISION_REQUESTED = "revision_requested"
PLAN_STATUS_CANCELLED = "cancelled"
PLAN_STATUS_TIMEOUT = "timeout"
PLAN_STATUS_PENDING = "pending"


class PlanFileItem(BaseModel):
    path: str = Field(
        description="""<!--zh: 计划中会创建或修改的文件路径，使用工作区内相对路径。-->
Workspace-relative path of a file that will be created or changed by this plan.""",
    )
    purpose: str = Field(
        description="""<!--zh: 这个文件在方案中的用途。-->
What this file is for in the plan.""",
    )


class PlanDataModelItem(BaseModel):
    table_name: str = Field(
        description="""<!--zh: 计划使用或创建的 MagicBase 表名。数据型微应用默认应填写；只有确实没有需要保存的数据时才为空。-->
MagicBase table name that this plan will use or create. Data-oriented micro-apps should include this by default; leave data_model empty only when there is truly no data to save.""",
    )
    purpose: str = Field(
        description="""<!--zh: 这张表服务的业务目的。-->
Business purpose of this table.""",
    )
    fields: Union[List[str], str] = Field(
        default_factory=list,
        description="""<!--zh: 计划中的字段列表，用自然语言或 field_name: type 格式简要描述。-->
Use a JSON array for planned fields, described briefly in natural language or as `field_name: type`.""",
    )


class MicroAppPlanParams(BaseToolParams):
    plan_title: str = Field(
        description="""<!--zh: 开发计划标题，短而具体。-->
Short, specific title for the implementation plan.""",
    )
    summary: str = Field(
        description="""<!--zh: 计划摘要，说明要做成什么，以及用户确认后会执行什么。-->
Brief summary of what will be built and what will happen after user approval.""",
    )
    app_type: str = Field(
        default="",
        description="""<!--zh: 微应用类型，例如 landing_page、survey、todo、crud_admin、dashboard、tool。-->
Micro-app type, such as `landing_page`, `survey`, `todo`, `crud_admin`, `dashboard`, or `tool`.""",
    )
    requirements: Union[List[str], str] = Field(
        default_factory=list,
        description="""<!--zh: 确认后的真实功能清单。短需求不能只复述用户原话，应包含基于通用产品维度补全后会实际实现的能力。-->
Use a JSON array for the real feature scope to be implemented. For short requests, do not merely repeat the user's words; include the useful product capabilities derived from general product dimensions.""",
    )
    implementation_steps: Union[List[str], str] = Field(
        default_factory=list,
        description="""<!--zh: 用户确认后将执行的开发步骤。-->
Use a JSON array for development steps that will be executed after user approval.""",
    )
    files: Union[List[PlanFileItem], str] = Field(
        default_factory=list,
        description="""<!--zh: 计划创建或修改的文件。简单单页应用通常只列 index.html。-->
Use a JSON array for files that will be created or changed. Each item should have `path` and `purpose`. For a simple single-page app, usually list only `index.html`.""",
    )
    data_model: Union[List[PlanDataModelItem], str] = Field(
        default_factory=list,
        description="""<!--zh: MagicBase 数据表计划。字段必须由计划中的完整功能反推，不能只建最小表；涉及当前用户、创建人、负责人或权限时，必须包含稳定 user_id 字段，并说明用户展示名来自 window.Magic.getContext()。涉及权限时，说明该规则是 enforceable_by_magicbase、ui_only_not_secure 还是 requires_backend；不要把状态流转、跨表关系、层级、阈值、时间窗口、配额、审批、支付、库存、财务、积分等后端业务规则伪装成纯前端可安全实现。只有纯展示、纯静态、纯计算器、没有用户数据或用户明确不要保存数据时才为空。-->
Use a JSON array for the MagicBase data model plan. Derive fields from the full planned feature loop, not from the smallest possible CRUD table. Include stable user_id fields when the app involves current users, creators, owners, assignees, or permissions, and state that user display names come from window.Magic.getContext(). For permissioned data, state whether the rule is enforceable_by_magicbase, ui_only_not_secure, or requires_backend; do not model complex backend-only permission rules as if front-end code can secure them. Leave it empty only for pure showcase/static/calculator apps, apps with no user data, or when the user explicitly says not to persist data.""",
    )
    acceptance_criteria: Union[List[str], str] = Field(
        default_factory=list,
        description="""<!--zh: 交付后可验证的验收标准。必须覆盖补全后的关键能力，而不只是用户原话里的基础能力。-->
Use a JSON array for verifiable acceptance criteria. Cover the key product capabilities added by reasonable expansion, not only the literal baseline request.""",
    )
    assumptions: Union[List[str], str] = Field(
        default_factory=list,
        description="""<!--zh: 为了推进计划而采用的具体默认假设。说明哪些能力是根据一句话需求合理补全的；涉及 MagicBase 或多用户权限时，必须包含 permission_feasibility，值为 enforceable_by_magicbase、ui_only_not_secure 或 requires_backend。若权限依赖状态流转、跨表关系、层级、阈值、时间窗口、配额、审批、支付、库存、财务、积分或其他后端业务逻辑，明确说明纯前端 + MagicBase 无法强制安全实现。不要写“简单易用”等空泛描述。-->
Use a JSON array for concrete defaults assumed to move the plan forward. State which capabilities were reasonably added from a short request. For MagicBase or multi-user permissions, include permission_feasibility with one of enforceable_by_magicbase, ui_only_not_secure, or requires_backend. If permission rules depend on state transitions, cross-table relationships, hierarchy, thresholds, time windows, quotas, approvals, payments, inventory, finance, points, or other backend business logic, explicitly say pure front-end + MagicBase cannot enforce them. Avoid vague assumptions such as "simple and easy to use".""",
    )
    timeout: int = Field(
        default=INTERNAL_TIMEOUT,
        description="""<!--zh: 等待用户确认计划的超时秒数（30~600）。-->
How many seconds to wait for user approval (30–600).""",
    )


@tool(name="micro_app_plan")
class MicroAppPlanTool(BaseUserToolCallTool[MicroAppPlanParams]):
    """<!--zh
    向用户展示开发计划并等待确认。用于在生成或修改 HTML 微应用前获得明确批准。
    只有主 Agent 可以调用；如果你是被其他 Agent 调用的，不要使用此工具。
    -->
    Present an implementation plan to the user and wait for approval. Use this before building or changing an HTML micro-app when the work will create files, modify files, or change MagicBase schema.
    Only the main agent can call this tool; if you were invoked by another agent, do not use it.
    """

    name = "micro_app_plan"
    user_tool_call_timeout = INTERNAL_TIMEOUT

    def get_prompt_hint(self) -> str:
        return """\
<!--zh
何时调用 micro_app_plan：
- 新建 HTML 微应用、较大改动、改动文件结构、或涉及 MagicBase 建表、改表权限、删表、加字段、改字段、删字段等 schema 变更时，必须先调用 micro_app_plan 并等待用户确认。
- 是否调用 ask_user 由你判断：只有缺少会显著改变产品方向的信息，且无法用合理默认值安全推进时才提问；短需求可以合理推断时，直接带明确假设进入 micro_app_plan。
- 用户确认 micro_app_plan 之前，不要写文件，不要建表、改表权限、删表、加字段、改字段、删字段，不要声称已开始开发。
- 若方案涉及 MagicBase 表结构变更，计划中要说明 MagicBase schema 工具会自动维护 `.magicbase/migrations.json`，并在成功后刷新 `MICRO-APP.md` 的最新表结构；agent 不需要单独编辑文件写 Pending/Success/Failed。
- 用户要求修改计划时，不要实现；根据用户意见调整方案后再次调用 micro_app_plan。
- 用户取消或超时时，不要继续实现。

不应调用：
- 用户明确要求直接做的非常小的文案、样式或局部修复。
- 只做非破坏性阅读、搜索、理解代码或查询已有表结构。
- 被其他 Agent 调用时。

Plan content must be concrete enough for the user to approve:
- Short requests must be expanded into a complete but lightweight product plan. Do not produce a minimal demo plan unless the user explicitly asks for a minimal or simplest version.
- Before filling plan fields, derive capabilities from general product dimensions rather than fixed scene templates:
  - Data: what object is managed, which attributes are needed, and whether status, category, notes, order, or archive fields are needed. For timestamps, prefer MagicBase system fields such as `created_at` and `updated_at` for display and sorting; only plan custom time fields when the app has a distinct business time such as due date, appointment time, publish time, or event date.
  - Operations: whether users need create, view, edit, delete, search, filter, sort, batch actions, or export.
  - State: whether records need active, completed, overdue, draft, archived, error, or similar lifecycle states.
  - Identity and permissions: whether records need creator, owner, assignee, collaborator, "my data versus all data", or per-user edit/delete visibility. Use `window.Magic.getContext()` to get the real current user profile before user-dependent operations. Use real `user_id` fields for permission checks; display names are not permission keys.
  - Feedback: which loading, empty, error, success, disabled, active, confirmation, and undo-like feedback states are needed.
  - Analysis: whether counts, progress, summaries, distributions, recent activity, or lightweight trends make the app more useful.
  - Experience: whether quick entry, inline editing, modal/drawer details, mobile alternatives, or keyboard actions are useful.
  - Persistence: which dynamic business fields must be stored in MagicBase and which are only temporary UI state. Do not list MagicBase system fields such as `id`, `record_id`, `created_at`, `updated_at`, `created_by`, `project_id`, `table_id`, or `organization_code` as writable data_model fields.
- Put the expanded, real feature scope into `requirements`, the derived persistent fields into `data_model`, and the expanded verifiable outcomes into `acceptance_criteria`.
- If the plan includes teamwork, ownership, creator/assignee fields, edit/delete permissions, or "my records" filtering, explicitly state that the HTML app must call `window.Magic.getContext()` first, which MagicBase fields store stable identity, which display fields come from context user information, and which operations are limited to the current user. Acceptance criteria must verify that non-owners do not see or cannot use edit/delete actions and that the app never writes fake users such as unknown, guest, visitor, or unnamed users.
- 明确 `app.json.anonymous` 的取值。涉及本人编辑、我的数据、创建人权限、用户/部门/组织隔离、团队协作时默认 `anonymous:false`；公开展示、匿名反馈、匿名表单类应用才可 `anonymous:true`。
- `assumptions` must name the concrete defaults used for product expansion. Do not use vague statements such as "simple and easy to use".
- State what will be built, the real files to create or change, and the useful data model needed by the approved product loop when persistence is needed.
- 数据型微应用默认优先使用 MagicBase：问卷、表单、待办、CRUD、小后台、dashboard、tracker 或任何用户提交/编辑/统计/查询/导出的数据，都应在 micro_app_plan 中包含 data_model；只有纯展示、纯静态、纯计算器、没有用户数据或用户明确不要保存数据时才为空。
- 新建或修改微应用时，`files` 应包含 `app.json`、`magic.project.js`、入口 HTML，以及任务结束前会通过 `update_html_app_memory` 创建或更新的 `MICRO-APP.md`，但不要在用户确认 micro_app_plan 前写入它。
- Do not list fake pages, speculative features, or files that will not actually be produced.
- Keep requirements and acceptance criteria short, concrete, and verifiable.
- Pass list fields as JSON arrays, not Markdown or YAML strings. `files` must be an array of objects with `path` and `purpose`. `data_model` must be an array of objects with `table_name`, `purpose`, and `fields`.
-->
When to call micro_app_plan:
- Before creating an HTML micro-app, making a substantial change, changing file structure, or creating/changing MagicBase tables or columns.
- Decide whether ask_user is needed. Call it only when missing information would significantly change the product direction and cannot be safely handled with reasonable defaults. If a short request is reasonably inferable, call micro_app_plan with explicit assumptions.
- Before the user approves the plan, do not write files, create tables, add columns, or claim development has started.
- If the plan involves MagicBase schema changes, state that MagicBase schema tools will automatically maintain `.magicbase/migrations.json` and refresh the latest data model in `MICRO-APP.md` after success. The agent does not need separate file edits for Pending/Success/Failed migration records.
- If the user requests plan changes, do not implement. Revise the plan and call micro_app_plan again.
- If the user cancels or approval times out, do not continue implementation.

Do not call when:
- The user explicitly asks you to directly perform a tiny copy, style, or local bug fix.
- You are only reading, searching, understanding code, or querying existing table structure without mutation.
- You were invoked by another agent.

Plan content must be concrete enough for user approval:
- Short requests must be expanded into a complete but lightweight product plan. Do not produce a minimal demo plan unless the user explicitly asks for a minimal or simplest version.
- Before filling plan fields, derive capabilities from general product dimensions rather than fixed scene templates:
  - Data: what object is managed, which attributes are needed, and whether status, category, notes, order, or archive fields are needed. For timestamps, prefer MagicBase system fields such as `created_at` and `updated_at` for display and sorting; only plan custom time fields when the app has a distinct business time such as due date, appointment time, publish time, or event date.
  - Operations: whether users need create, view, edit, delete, search, filter, sort, batch actions, or export.
  - State: whether records need active, completed, overdue, draft, archived, error, or similar lifecycle states.
  - Identity and permissions: whether records need creator, owner, assignee, collaborator, "my data versus all data", or per-user edit/delete visibility. Use `window.Magic.getContext()` to get the real current user profile before user-dependent operations. Use real `user_id` fields for permission checks; display names are not permission keys.
  - Feedback: which loading, empty, error, success, disabled, active, confirmation, and undo-like feedback states are needed.
  - Analysis: whether counts, progress, summaries, distributions, recent activity, or lightweight trends make the app more useful.
  - Experience: whether quick entry, inline editing, modal/drawer details, mobile alternatives, or keyboard actions are useful.
  - Persistence: which dynamic business fields must be stored in MagicBase and which are only temporary UI state. Do not list MagicBase system fields such as `id`, `record_id`, `created_at`, `updated_at`, `created_by`, `project_id`, `table_id`, or `organization_code` as writable data_model fields.
- Put the expanded, real feature scope into `requirements`, the derived persistent fields into `data_model`, and the expanded verifiable outcomes into `acceptance_criteria`.
- If the plan includes teamwork, ownership, creator/assignee fields, edit/delete permissions, or "my records" filtering, explicitly state that the HTML app must call `window.Magic.getContext()` first, which MagicBase fields store stable identity, which display fields come from context user information, and which operations are limited to the current user. Acceptance criteria must verify that non-owners do not see or cannot use edit/delete actions and that the app never writes fake users such as unknown, guest, visitor, or unnamed users.
- Explicitly state the `app.json.anonymous` value. Apps with owner-only editing, my data, creator permissions, user/department/organization isolation, or team collaboration default to `anonymous:false`; public showcases, anonymous feedback, and anonymous forms may use `anonymous:true`.
- `assumptions` must name the concrete defaults used for product expansion. Do not use vague statements such as "simple and easy to use".
- State what will be built, the real files to create or change, and the useful data model needed by the approved product loop when persistence is needed.
- Data-oriented micro-apps should use MagicBase by default. Surveys, forms, todos, CRUD apps, admin panels, dashboards, trackers, and any user-submitted/editable/analytical/searchable/exportable data should include data_model in the plan. Leave it empty only for pure showcase/static/calculator apps, apps with no user data, or explicit no-persistence requests.
- For new or modified micro-apps, `files` should include `app.json`, `magic.project.js`, the entry HTML, and the `MICRO-APP.md` that will be created or updated through `update_html_app_memory` before the task ends, but do not write it before user approval.
- Do not list fake pages, speculative features, or files that will not actually be produced.
- Keep requirements and acceptance criteria short, concrete, and verifiable.
- Pass list fields as JSON arrays, not Markdown or YAML strings. `files` must be an array of objects with `path` and `purpose`. `data_model` must be an array of objects with `table_name`, `purpose`, and `fields`.
"""

    async def _prepare(self, tool_context: ToolContext) -> None:
        raw_timeout = tool_context.arguments.get("timeout")
        if raw_timeout is not None:
            clamped = max(30, min(600, int(raw_timeout)))
            tool_context.arguments["expires_at"] = int(time.time()) + clamped

        tool_context.arguments["plan"] = build_plan_payload(tool_context.arguments)
        tool_context.arguments["status"] = PLAN_STATUS_PENDING

    def build_tool_data(self, tool_context: ToolContext) -> dict:
        return {
            "plan": tool_context.arguments.get("plan") or build_plan_payload(tool_context.arguments),
            "expires_at": tool_context.arguments.get("expires_at", 0),
        }

    def build_result_builder(self, tool_data: dict) -> ResultBuilder:
        return build_plan_result_builder(
            tool_data.get("plan", {}),
            tool_data.get("expires_at", 0),
        )

    def build_timeout_answer_builder(self, tool_data: dict) -> TimeoutAnswerBuilder:
        def timeout_answer_builder() -> str:
            return json.dumps({"comment": ""}, ensure_ascii=False)

        return timeout_answer_builder

    def build_pending_content(self, tool_call_id: str, tool_data: dict) -> str:
        title = (tool_data.get("plan") or {}).get("title", "Implementation plan")
        return f'[PLAN:{tool_call_id}] Implementation plan "{title}" sent to user, waiting for approval.'

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: dict = None
    ) -> Optional[ToolDetail]:
        if not result or not result.extra_info:
            return None

        plan = result.extra_info.get("plan", {})
        status = result.extra_info.get("status", PLAN_STATUS_PENDING)
        response = result.extra_info.get("response")
        return ToolDetail(
            type=DisplayType.PLAN,
            data=build_plan_content(
                plan=plan,
                plan_id=tool_context.tool_call_id if tool_context else None,
                status=status,
                response=response,
                expires_at=result.extra_info.get("expires_at", 0),
            ),
        )

    async def get_before_tool_detail(self, tool_context: ToolContext, arguments: dict = None) -> ToolDetail:
        raw_arguments = arguments or tool_context.arguments
        plan = raw_arguments.get("plan") or build_plan_payload(raw_arguments)
        return ToolDetail(
            type=DisplayType.PLAN,
            data=build_plan_content(
                plan=plan,
                plan_id=tool_context.tool_call_id,
                status=PLAN_STATUS_PENDING,
                response=None,
                expires_at=tool_context.arguments.get("expires_at", 0),
            ),
        )


def build_plan_result_builder(plan: Dict[str, Any], expires_at: int) -> ResultBuilder:
    def result_builder(response_status: str, answer_json: str, remark: str = "") -> Tuple[str, Dict[str, Any]]:
        """构造计划审批结果；remark 属于 ask_user，本工具保持忽略。"""
        status = normalize_plan_status(response_status)
        response = parse_plan_response(answer_json)
        title = plan.get("title") or "Implementation plan"

        if status == PLAN_STATUS_APPROVED:
            content = (
                f'The user approved the implementation plan "{title}". '
                "Proceed exactly according to the approved plan. Do not add unapproved scope. "
                f"Plan summary: {plan.get('summary', '')}"
            )
        elif status == PLAN_STATUS_REVISION_REQUESTED:
            content = (
                f'The user requested changes to the implementation plan "{title}". '
                "Do not implement yet. Revise the plan according to the user's feedback and call micro_app_plan again. "
                f"User feedback: {response or '(no details provided)'}"
            )
        elif status == PLAN_STATUS_CANCELLED:
            content = (
                f'The user cancelled the implementation plan "{title}". '
                "Do not implement this plan or perform any related file or database changes."
            )
        elif status == PLAN_STATUS_TIMEOUT:
            content = (
                f'Approval for the implementation plan "{title}" timed out. '
                "Do not implement until the user explicitly approves a plan."
            )
        else:
            content = (
                f'The implementation plan "{title}" returned status "{status}". '
                "Do not implement unless the status is approved."
            )

        extra_info = {
            "status": status,
            "plan": plan,
            "response": response,
            "expires_at": expires_at,
        }
        return content, extra_info

    return result_builder


def build_plan_payload(arguments: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "title": normalize_text(arguments.get("title") or arguments.get("plan_title")),
        "summary": normalize_text(arguments.get("summary")),
        "app_type": normalize_text(arguments.get("app_type")),
        "requirements": normalize_string_list(arguments.get("requirements")),
        "implementation_steps": normalize_string_list(arguments.get("implementation_steps")),
        "files": normalize_files(arguments.get("files")),
        "data_model": normalize_data_model(arguments.get("data_model")),
        "acceptance_criteria": normalize_string_list(arguments.get("acceptance_criteria")),
        "assumptions": normalize_string_list(arguments.get("assumptions")),
    }


def build_plan_content(
    plan: Dict[str, Any],
    plan_id: Optional[str],
    status: str,
    response: Optional[str],
    expires_at: int,
) -> PlanToolContent:
    return PlanToolContent(
        plan_id=plan_id,
        status=status,
        title=normalize_text(plan.get("title")),
        summary=normalize_text(plan.get("summary")),
        app_type=normalize_text(plan.get("app_type")),
        requirements=normalize_string_list(plan.get("requirements")),
        implementation_steps=normalize_string_list(plan.get("implementation_steps")),
        files=normalize_files(plan.get("files")),
        data_model=normalize_data_model(plan.get("data_model")),
        acceptance_criteria=normalize_string_list(plan.get("acceptance_criteria")),
        assumptions=normalize_string_list(plan.get("assumptions")),
        response=response,
        expires_at=expires_at,
    )


def normalize_plan_status(status: str) -> str:
    if status == PLAN_STATUS_APPROVED:
        return PLAN_STATUS_APPROVED
    if status == PLAN_STATUS_REVISION_REQUESTED:
        return PLAN_STATUS_REVISION_REQUESTED
    if status == PLAN_STATUS_CANCELLED:
        return PLAN_STATUS_CANCELLED
    if status == PLAN_STATUS_TIMEOUT:
        return PLAN_STATUS_TIMEOUT
    return status or PLAN_STATUS_CANCELLED


def parse_plan_response(answer_json: str) -> str:
    if not answer_json:
        return ""
    try:
        parsed = json.loads(answer_json)
    except (json.JSONDecodeError, TypeError):
        return str(answer_json)

    if isinstance(parsed, dict):
        comment = parsed.get("comment") or parsed.get("feedback") or parsed.get("answer")
        return normalize_text(comment)
    return normalize_text(parsed)
