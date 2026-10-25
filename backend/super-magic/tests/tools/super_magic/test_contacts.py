"""Contact search stays bound to the current identity and exposes only allowed fields."""

from types import SimpleNamespace

import pytest

from agentlang.tools.tool_result import ToolResult
from app.i18n import i18n
from app.infrastructure.sdk.magic_service.api.contact_api import ContactApi
from app.infrastructure.sdk.magic_service.kernel.magic_service_parameter import MagicServiceAuthConfig
from app.tools.super_magic.contacts import (
    ContactSearchParams,
    SearchDepartments,
    SearchUsers,
    SearchUsersParams,
    _page,
)
from app.tools.super_magic.display import ProductTool, product_detail


@pytest.fixture
def auth():
    return MagicServiceAuthConfig(user_id="123", organization_code="org", user_authorization="secret")


@pytest.mark.asyncio
async def test_contact_api_uses_current_auth_and_exact_routes(monkeypatch, auth):
    requests = []

    async def request(self, parameter, method, path):
        requests.append((method, path, parameter.to_options(method)))
        return {"items": []}

    monkeypatch.setattr(ContactApi, "request_by_parameter_async", request)
    api = object.__new__(ContactApi)
    await api.search_users_async(auth, "Alice", "20")
    await api.search_departments_async(auth, "Sales")

    assert [request[:2] for request in requests] == [
        ("GET", "/api/v1/open-api/sandbox/contact/users/search"),
        ("GET", "/api/v1/open-api/sandbox/contact/departments/search"),
    ]
    assert requests[0][2]["params"] == {"query": "Alice", "page_token": "20"}
    assert requests[1][2]["params"] == {"query": "Sales"}
    assert all(request[2]["headers"]["user-authorization"] == "secret" for request in requests)
    assert all(request[2]["headers"]["user-id"] == "123" for request in requests)
    assert all("organization_code" not in request[2]["params"] for request in requests)


@pytest.mark.asyncio
async def test_user_tool_projects_results_and_forwards_same_auth(monkeypatch, auth):
    calls = []

    async def search_users(received_auth, query, page_token):
        calls.append((received_auth, query, page_token))
        return {
            "items": [{
                "user_id": "456", "nickname": "Alice", "real_name": "Alice Lee", "job_title": "Engineer",
                "departments": [{"department_id": "10", "name": "Platform", "path_names": ["Organization", "Platform"], "internal": "private"}],
                "phone": "private",
            }],
            "has_more": True,
            "page_token": "20",
            "secret": "private",
        }

    context = SimpleNamespace(auth=auth, sdk=SimpleNamespace(contact=SimpleNamespace(search_users_async=search_users)))

    async def run_product(self, _tool_context, _action, operation, *, format_result, **_kwargs):
        return format_result(await operation(context))

    monkeypatch.setattr(ProductTool, "run_product", run_product)
    result = await SearchUsers().execute(None, SearchUsersParams(query=" Alice ", page_token="0"))
    assert calls == [(auth, "Alice", "0")]
    assert result.ok and result.data == {
        "items": [{
            "user_id": "456", "nickname": "Alice", "real_name": "Alice Lee", "job_title": "Engineer",
            "departments": [{"department_id": "10", "name": "Platform", "path_names": ["Organization", "Platform"]}],
        }],
        "has_more": True,
        "page_token": "20",
    }
    assert "private" not in result.content
    assert "Engineer" in result.content and "Organization/Platform" in result.content
    assert "page_token: 20" in result.content


@pytest.mark.asyncio
async def test_department_tool_reports_bounded_coverage(monkeypatch, auth):
    async def search_departments(received_auth, query):
        assert received_auth is auth and query == "Sales"
        return {"items": [{"department_id": "10", "name": "Sales", "parent_department_id": "1", "path_names": ["Organization", "Sales"], "internal": "private"}], "coverage": "bounded"}

    context = SimpleNamespace(auth=auth, sdk=SimpleNamespace(contact=SimpleNamespace(search_departments_async=search_departments)))

    async def run_product(self, _tool_context, _action, operation, *, format_result, **_kwargs):
        return format_result(await operation(context))

    monkeypatch.setattr(ProductTool, "run_product", run_product)
    result = await SearchDepartments().execute(None, ContactSearchParams(query="Sales"))
    assert result.data == {"items": [{"department_id": "10", "name": "Sales", "parent_department_id": "1", "path_names": ["Organization", "Sales"]}], "coverage": "bounded"}
    assert "at most 100" in result.content and "Organization/Sales" in result.content and "private" not in result.content


def test_reject_invalid_search_pages_and_cursors():
    with pytest.raises(ValueError):
        SearchUsersParams(query="   ")
    with pytest.raises(ValueError):
        SearchUsersParams(query="Alice", page_token="100001")
    with pytest.raises(ValueError):
        _page({"items": [{"user_id": "1", "nickname": "A", "real_name": "A"}], "has_more": True, "page_token": ""}, "user")
    with pytest.raises(ValueError):
        _page({"items": [], "coverage": "complete"}, "department")
    with pytest.raises(ValueError):
        _page({"items": [{"department_id": "1", "name": "Sales", "parent_department_id": "-1", "path_names": ["Organization", 4]}], "coverage": "bounded"}, "department")


def test_contact_user_detail_shows_name_without_identifiers():
    i18n.set_language("en_US")
    try:
        result = ToolResult(content="", data={"items": [{
            "user_id": "123", "nickname": "Alice", "real_name": "Alice Lee", "job_title": "Engineer",
            "departments": [{"department_id": "30", "name": "Platform", "path_names": ["Organization", "Platform"]}],
        }], "has_more": False, "page_token": ""})
        detail = product_detail("search_users", result).data.content
        assert "Alice" in detail and "123" not in detail and "No more records" in detail
        assert "Engineer" in detail and "Organization/Platform" in detail and "30" not in detail
        department = ToolResult(content="", data={"items": [{"department_id": "20", "name": "Sales", "parent_department_id": "1", "path_names": ["Organization", "Sales"]}], "coverage": "bounded"})
        department_detail = product_detail("search_departments", department).data.content
        assert "Sales" in department_detail and "20" not in department_detail
        assert "Organization/Sales" in department_detail
        assert "at most 100 matches" in department_detail
    finally:
        i18n.reset_language()
