"""Contact search through Magic Service using the active chat identity."""

from __future__ import annotations

from typing import Any

from pydantic import Field, field_validator

from agentlang.context.tool_context import ToolContext
from agentlang.tools.tool_result import ToolResult
from app.tools.core import tool

from .display import ProductTool
from .models import ProductParams


class ContactSearchParams(ProductParams):
    query: str = Field(..., description="A name, nickname, exact phone number, or department name to search.")

    @field_validator("query")
    @classmethod
    def valid_query(cls, value: str) -> str:
        value = value.strip()
        if not value or len(value) > 100:
            raise ValueError("Search query must contain 1–100 characters.")
        return value


class SearchUsersParams(ContactSearchParams):
    page_token: str = Field("", description="Exact page_token from the previous user search page; empty starts a new search.")

    @field_validator("page_token")
    @classmethod
    def valid_page_token(cls, value: str) -> str:
        if value and (not value.isascii() or not value.isdecimal() or len(value) > 6 or int(value) > 100000):
            raise ValueError("page_token must be the offset returned by the previous page.")
        return value


def _page(raw: Any, kind: str) -> dict[str, Any]:
    if not isinstance(raw, dict) or not isinstance(raw.get("items"), list):
        raise ValueError("The contact service returned an invalid page.")
    fields = ("user_id", "nickname", "real_name") if kind == "user" else ("department_id", "name", "parent_department_id")
    items = []
    for item in raw["items"]:
        if not isinstance(item, dict) or any(not isinstance(item.get(field), str) for field in fields):
            raise ValueError("The contact service returned an invalid item.")
        projected = {field: item[field] for field in fields}
        if kind == "user":
            title = item.get("job_title", "")
            departments = item.get("departments", [])
            if not isinstance(title, str) or not isinstance(departments, list):
                raise ValueError("The contact service returned invalid user details.")
            projected["job_title"] = title
            projected["departments"] = []
            for department in departments:
                if not isinstance(department, dict) or not isinstance(department.get("department_id"), str) or not isinstance(department.get("name"), str):
                    raise ValueError("The contact service returned invalid user departments.")
                path_names = _path_names(department.get("path_names", []))
                projected["departments"].append({
                    "department_id": department["department_id"],
                    "name": department["name"],
                    "path_names": path_names,
                })
        else:
            projected["path_names"] = _path_names(item.get("path_names", []))
        items.append(projected)
    if kind == "department":
        if raw.get("coverage") != "bounded" or len(items) > 100:
            raise ValueError("The contact service returned invalid department coverage.")
        return {"items": items, "coverage": "bounded"}

    token = raw.get("page_token")
    more = raw.get("has_more")
    if not isinstance(more, bool) or not isinstance(token, str) or (more and not token) or len(items) > 20:
        raise ValueError("The contact service returned an invalid user search cursor.")
    return {"items": items, "has_more": more, "page_token": token}


def _display_name(value: str) -> str:
    return " ".join(value.split())[:120]


def _path_names(value: Any) -> list[str]:
    if not isinstance(value, list) or any(not isinstance(name, str) for name in value):
        raise ValueError("The contact service returned an invalid department path.")
    return value


def _present(data: dict[str, Any], kind: str) -> ToolResult:
    items = data["items"]
    lines = [f"{len(items)} {kind} result(s) returned for the current user."]
    for item in items[:20]:
        if kind == "user":
            name = _display_name(item["nickname"] or item["real_name"])
            details = [f"user_id: {item['user_id']}", f"real name: {_display_name(item['real_name'])}"]
            if item["job_title"]:
                details.append(f"job title: {_display_name(item['job_title'])}")
            if item["departments"]:
                paths = [
                    "/".join(_display_name(part) for part in department["path_names"]) or _display_name(department["name"])
                    for department in item["departments"][:3]
                ]
                details.append("departments: " + ", ".join(paths))
                if len(item["departments"]) > 3:
                    details.append(f"{len(item['departments']) - 3} more departments in result.data")
            lines.append(f"- {name} ({'; '.join(details)})")
        else:
            path = "/".join(_display_name(part) for part in item["path_names"])
            lines.append(f"- {_display_name(item['name'])} (department_id: {item['department_id']}; parent_department_id: {item['parent_department_id']}; path: {path or 'unavailable'})")
    if kind == "user":
        if data["has_more"]:
            lines.append(f"More user results are available. Continue with page_token: {data['page_token']}.")
        else:
            lines.append("No further user results are reported for this query.")
    else:
        if len(items) > 20:
            lines.append(f"Showing the first 20 of {len(items)} returned departments. Use result.data for bounded filtering.")
        lines.append("Department search checks at most 100 matches. Use a narrower query if the result may be incomplete.")
    return ToolResult(content="\n".join(lines), data=data)


# Code Mode usage: agents/skills/super-magic/references/contacts.md.
@tool(name="search_users", code_mode_only=True)
class SearchUsers(ProductTool[SearchUsersParams]):
    """Search people in the current chat user's organization."""

    name = "search_users"

    async def execute(self, tool_context: ToolContext, params: SearchUsersParams) -> ToolResult:
        async def operation(ctx):
            return _page(await ctx.sdk.contact.search_users_async(ctx.auth, params.query, params.page_token), "user")

        return await self.run_product(tool_context, "User search", operation, format_result=lambda data: _present(data, "user"))


# Code Mode usage: agents/skills/super-magic/references/contacts.md.
@tool(name="search_departments", code_mode_only=True)
class SearchDepartments(ProductTool[ContactSearchParams]):
    """Search departments in the current chat user's organization."""

    name = "search_departments"

    async def execute(self, tool_context: ToolContext, params: ContactSearchParams) -> ToolResult:
        async def operation(ctx):
            return _page(await ctx.sdk.contact.search_departments_async(ctx.auth, params.query), "department")

        return await self.run_product(tool_context, "Department search", operation, format_result=lambda data: _present(data, "department"))
