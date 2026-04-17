from typing import Any, Dict, List, Optional

from pydantic import Field

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.tools.core import BaseTool, BaseToolParams, tool
from app.utils.init_client_message_util import InitClientMessageUtil


def _mask_phone(phone: str) -> str:
    """Mask a phone number for privacy. Works for any international format."""
    if not phone:
        return phone
    s = phone.strip()
    if len(s) <= 7:
        return "****"
    return s[:3] + "****" + s[-4:]


class GetUserInfoParams(BaseToolParams):
    include_sensitive_fields: List[str] = Field(
        default=[],
        description="""<!--zh
需要返回原始值的敏感字段列表，目前支持 "phone"。
默认情况下手机号会脱敏；使用此参数可获取完整原始值。
调用前必须已通过向用户明确询问并获得其同意，未经授权不得传入此参数。
-->
List of sensitive field names to return as plain text. Supported value: "phone".
By default phone is desensitized; pass ["phone"] here to get the full number.
You MUST have already asked the user for explicit consent before passing any value here. Never pass this without prior user approval."""
    )


@tool()
class GetUserInfo(BaseTool[GetUserInfoParams]):
    """<!--zh
    获取当前会话用户的个人信息。

    返回字段：nickname、real_name、position、work_number、email、phone（默认脱敏）、departments。
    手机号默认脱敏，如需完整号码需先获得用户明确授权并通过 include_sensitive_fields 参数请求。
    -->
    Get the current session user's profile.

    Returns: nickname, real_name, position, work_number, email, phone (desensitized by default), departments.
    Phone is masked by default. Pass include_sensitive_fields=["phone"] only after obtaining explicit user consent.
    """

    async def execute(self, tool_context: ToolContext, params: GetUserInfoParams) -> ToolResult:
        user = InitClientMessageUtil.get_user()
        if user is None:
            return ToolResult.error("User info is not available in the current session.")

        expose_sensitive = set(params.include_sensitive_fields)

        phone_raw = user.phone or ""
        phone_value = phone_raw if "phone" in expose_sensitive else _mask_phone(phone_raw)
        phone_note = "" if "phone" in expose_sensitive else " (desensitized)"

        departments = []
        if user.departments:
            for dept in user.departments:
                departments.append({
                    "id": dept.id,
                    "name": dept.name,
                    "path": dept.path,
                })

        data = {
            "id": user.id,
            "nickname": user.nickname,
            "real_name": user.real_name,
            "work_number": user.work_number,
            "position": user.position,
            "email": user.email,
            "phone": phone_value,
            "departments": departments,
        }

        dept_names = ", ".join(d["name"] for d in departments if d.get("name")) or "N/A"
        name = user.real_name or user.nickname or "Unknown"
        content_parts = [f"User: {name}"]
        if user.position:
            content_parts.append(f"Position: {user.position}")
        if user.work_number:
            content_parts.append(f"Work Number: {user.work_number}")
        if user.email:
            content_parts.append(f"Email: {user.email}")
        if phone_value:
            content_parts.append(f"Phone: {phone_value}{phone_note}")
        if dept_names != "N/A":
            content_parts.append(f"Departments: {dept_names}")

        content = ". ".join(content_parts) + "."

        return ToolResult(content=content, data=data)

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Optional[Dict[str, Any]] = None,
    ) -> Dict:
        action = i18n.translate("get_user_info", category="tool.actions")
        if not result.ok:
            return {
                "action": action,
                "remark": i18n.translate("get_user_info.error", category="tool.messages"),
            }
        return {
            "action": action,
            "remark": i18n.translate("get_user_info.success", category="tool.messages"),
        }
