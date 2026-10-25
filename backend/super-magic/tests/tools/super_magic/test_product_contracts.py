"""Contracts for product requests, message cursors, and task receipts."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.infrastructure.sdk.magic_service.api.file_api import FileApi
from app.infrastructure.sdk.magic_service.api.message_api import MessageApi
from app.infrastructure.sdk.magic_service.api.project_api import ProjectApi
from app.infrastructure.sdk.magic_service.api.workspace_api import WorkspaceApi
from app.infrastructure.sdk.magic_service.kernel.magic_service_parameter import MagicServiceAuthConfig
from app.tools.super_magic.context import ProductContextError, current_product_context
from app.tools.super_magic.display import ProductTool, success
from app.tools.super_magic.files import _batch_present, _batch_result
from app.tools.super_magic.message_formatter import format_topic_messages
from app.tools.super_magic.models import FILE, PROJECT, projected, resource_id
from app.tools.super_magic.projects import ListTopics, ListTopicsParams
from app.tools.super_magic.tasks import _submit


@pytest.fixture
def auth() -> MagicServiceAuthConfig:
    return MagicServiceAuthConfig(user_id="123", organization_code="org", user_authorization="secret")


def test_product_context_requires_current_chat_identity(monkeypatch):
    agent = SimpleNamespace(
        get_user_context_auth=lambda: None,
        get_user_context_host=lambda: "https://service.example",
        is_user_context_config_loaded=lambda: True,
    )
    context = SimpleNamespace(get_extension_typed=lambda key, typ: agent)
    with pytest.raises(ProductContextError):
        current_product_context(context)


def test_product_context_binds_current_auth_and_host(monkeypatch, auth):
    agent = SimpleNamespace(
        get_user_context_auth=lambda: auth,
        get_user_context_host=lambda: "https://service.example",
        is_user_context_config_loaded=lambda: True,
    )
    context = SimpleNamespace(get_extension_typed=lambda key, typ: agent)
    seen = []
    monkeypatch.setattr("app.tools.super_magic.context.create_magic_service_sdk", lambda **kwargs: seen.append(kwargs) or object())
    resolved = current_product_context(context)
    assert resolved.auth is auth
    assert seen == [{"base_url": "https://service.example"}]


@pytest.mark.asyncio
async def test_message_api_uses_v2_post_and_exact_cursor(monkeypatch, auth):
    captured = []

    async def request(self, parameter, method, path):
        captured.append((method, path, parameter.to_options(method)))
        return {"list": [], "has_more": False, "next_cursor": None}

    monkeypatch.setattr(MessageApi, "request_by_parameter_async", request)
    api = object.__new__(MessageApi)
    await api.list_topic_async(auth, "987654321012345678", limit=20)
    await api.list_topic_async(auth, "987654321012345678", after_id="123456789012345678", limit=10)

    assert captured[0][0:2] == ("POST", "/api/v2/super-agent/topics/987654321012345678/messages")
    assert captured[0][2]["json"] == {"limit": 20}
    assert captured[1][2]["json"] == {"limit": 10, "after_id": "123456789012345678"}
    assert captured[1][2]["headers"]["user-authorization"] == "secret"
    assert "token" not in captured[1][2]["headers"]


@pytest.mark.asyncio
async def test_workspace_discovery_disables_auto_creation(monkeypatch, auth):
    captured = {}

    async def request(self, parameter, method, path):
        captured.update(method=method, path=path, options=parameter.to_options(method))
        return {"list": []}

    monkeypatch.setattr(WorkspaceApi, "request_by_parameter_async", request)
    await object.__new__(WorkspaceApi).list_async(auth)
    assert captured["options"]["params"]["auto_create"] == "false"


@pytest.mark.asyncio
async def test_participated_projects_use_distinct_endpoint(monkeypatch, auth):
    captured = {}

    async def request(self, parameter, method, path):
        captured.update(method=method, path=path, options=parameter.to_options(method))
        return {"list": []}

    monkeypatch.setattr(ProjectApi, "request_by_parameter_async", request)
    await object.__new__(ProjectApi).list_async(auth, scope="participated")
    assert captured["method"] == "POST"
    assert captured["path"].endswith("/projects/participated")
    assert captured["options"]["json"]["show_hidden"] == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("scope, method, parameter_key", [
    ("owned", "GET", "params"),
    ("participated", "POST", "json"),
])
async def test_project_list_filters_by_workspace(monkeypatch, auth, scope, method, parameter_key):
    captured = {}

    async def request(self, parameter, actual_method, path):
        captured.update(method=actual_method, path=path, options=parameter.to_options(actual_method))
        return {"list": []}

    monkeypatch.setattr(ProjectApi, "request_by_parameter_async", request)
    await object.__new__(ProjectApi).list_async(auth, scope=scope, workspace_id="987654321012345678")

    assert captured["method"] == method
    assert captured["options"][parameter_key]["workspace_id"] == "987654321012345678"


@pytest.mark.asyncio
async def test_owned_projects_forward_sort_without_changing_participated_order(monkeypatch, auth):
    captured = []

    async def request(self, parameter, method, path):
        captured.append((method, path, parameter.to_options(method)))
        return {"list": []}

    monkeypatch.setattr(ProjectApi, "request_by_parameter_async", request)
    api = object.__new__(ProjectApi)
    await api.list_async(auth, scope="owned", order_by="updated_at", sort="asc")
    await api.list_async(auth, scope="participated")
    assert captured[0][2]["params"]["order_by"] == "updated_at"
    assert captured[0][2]["params"]["sort"] == "asc"
    assert "order_by" not in captured[1][2]["json"]
    assert "sort" not in captured[1][2]["json"]


@pytest.mark.asyncio
async def test_topic_name_search_uses_existing_sidebar_route(monkeypatch, auth):
    captured = {}

    async def request(self, parameter, method, path):
        captured.update(method=method, path=path, options=parameter.to_options(method))
        return {"list": [], "total": 0}

    monkeypatch.setattr(ProjectApi, "request_by_parameter_async", request)
    await object.__new__(ProjectApi).search_topics_async(auth, "123", keyword="pricing", page=2, page_size=25)
    assert captured["method"] == "GET"
    assert captured["path"] == "/api/v1/super-agent/projects/123/sidebar-topics"
    assert captured["options"]["params"] == {"q": "pricing", "page": 2, "page_size": 25}


@pytest.mark.asyncio
async def test_list_topics_switches_only_when_search_or_recent_order_is_requested(monkeypatch):
    calls = []

    async def list_topics(_auth, _project_id, **kwargs):
        calls.append(("ordinary", kwargs))
        return {"list": [], "total": 0}

    async def search_topics(_auth, _project_id, **kwargs):
        calls.append(("sidebar", kwargs))
        return {"list": [], "total": 999}

    ctx = SimpleNamespace(auth=object(), sdk=SimpleNamespace(project=SimpleNamespace(
        list_topics_async=list_topics, search_topics_async=search_topics,
    )))

    async def run_product(self, _tool_context, action, operation, **kwargs):
        return success(action, await operation(ctx))

    monkeypatch.setattr(ProductTool, "run_product", run_product)
    tool = ListTopics()
    ordinary = await tool.execute(None, ListTopicsParams(project_id="123"))
    recent = await tool.execute(None, ListTopicsParams(project_id="123", order_by="updated_at", keyword="pricing"))
    assert calls[0][0] == "ordinary"
    assert calls[1] == ("sidebar", {"keyword": "pricing", "page": 1, "page_size": 20})
    assert ordinary.data["has_more"] is False
    assert recent.data["coverage_limit"] == 999
    assert "more may exist" in recent.content


def test_discovery_keeps_times_and_file_path_without_internal_fields():
    project = projected({"id": 123, "project_name": "Pricing", "last_active_at": "2026-10-08 09:30:00", "workspace_name": "Research", "work_dir": "/private/work", "user_id": "secret"}, PROJECT)
    file = projected({"id": 456, "file_name": "plan.pdf", "relative_file_path": "notes/plan.pdf", "file_key": "secret"}, FILE)
    assert project["last_active_at"] == "2026-10-08 09:30:00"
    assert file["relative_file_path"] == "notes/plan.pdf"
    assert "work_dir" not in project and "user_id" not in project and "file_key" not in file
    content = success("Project search", {"items": [project], "page": 1, "total": 1, "has_more": False}).content
    assert "last active: 2026-10-08 09:30:00 UTC+08:00" in content
    assert "workspace: Research" in content
    assert "secret" not in content


def test_capped_topic_search_does_not_claim_complete_coverage():
    content = success("Topic search", {"items": [], "page": 50, "total": 999, "has_more": False, "coverage_limit": 999}).content
    assert "more may exist" in content


def test_message_cursor_survives_filtered_page():
    raw = {
        "list": [{"id": 123, "role": "assistant", "content_type": "reasoning", "content": "private"}],
        "has_more": True,
        "next_cursor": "123",
    }
    result = format_topic_messages("98", raw)
    assert result.ok
    assert result.data["messages"] == []
    assert result.data["next_cursor"] == "123"
    assert "private" not in result.content


def test_message_page_preserves_source_and_reports_truncation():
    raw = {
        "list": [{"id": 123, "message_id": "msg-1", "role": "user", "content": "x" * 7000, "send_timestamp": 1_700_000_000_000}],
        "has_more": False,
        "next_cursor": None,
    }
    result = format_topic_messages("98", raw)
    assert result.data["messages"][0]["record_id"] == "123"
    assert result.data["messages"][0]["message_id"] == "msg-1"
    assert result.data["messages"][0]["truncated"] is True
    assert "UTC" in result.content


@pytest.mark.parametrize("invalid", ["0", "01", "-1", "1.0", "9223372036854775808", "abc"])
def test_product_ids_reject_ambiguous_or_out_of_range_values(invalid):
    with pytest.raises(ValueError):
        resource_id(invalid)


@pytest.mark.asyncio
async def test_project_file_query_uses_bounded_authenticated_route(monkeypatch, auth):
    captured = {}

    async def request(self, parameter, method, path):
        captured.update(method=method, path=path, options=parameter.to_options(method))
        return {"list": [], "next_parent_ids": [], "has_more": False}

    monkeypatch.setattr(FileApi, "request_by_parameter_async", request)
    await object.__new__(FileApi).list_project_async(auth, "123", {"page_size": 50, "next_parent_ids": []})
    assert captured["method"] == "POST"
    assert captured["path"] == "/api/v1/open-api/agent/projects/123/files/query"
    assert captured["options"]["json"] == {"page_size": 50, "next_parent_ids": []}
    assert captured["options"]["headers"]["user-authorization"] == "secret"


def test_synchronous_delete_and_async_batch_receipts_remain_distinct():
    deleted = _batch_result({"project_id": 10, "file_ids": [1, 2], "count": 2})
    assert deleted["status"] == "success"
    assert "File 1: success" in _batch_present(deleted).content

    accepted = _batch_result({"batch_key": "batch-1", "status": "processing", "files": {}})
    assert "Check batch status" in _batch_present(accepted).content
    assert "batch-1" in _batch_present(accepted).content


@pytest.mark.asyncio
async def test_busy_topic_returns_queue_id_without_invented_task(auth):
    calls = []

    async def get_topic(_auth, topic_id):
        return {"id": topic_id, "project_id": "10", "topic_mode": "general"}

    async def create_task(_auth, body):
        calls.append(body)
        return {"task_id": "", "queue_id": "765"}

    ctx = SimpleNamespace(auth=auth, agent=submitting_agent(), sdk=SimpleNamespace(
        topic=SimpleNamespace(get_async=get_topic),
        task=SimpleNamespace(create_async=create_task),
    ))
    receipt = await _submit(ctx, "10", "20", "Continue")
    assert receipt == {"kind": "queue", "topic_id": "20", "queue_id": "765", "status": "queued", "topic_name": ""}
    assert calls == [{"project_id": "10", "topic_id": "20", "content": "Continue", "agent_mode": "general", "model_id": "text-model", "force_interrupt": False}]


@pytest.mark.asyncio
async def test_custom_agent_mode_is_preserved(auth):
    sent = []

    async def get_topic(_auth, topic_id):
        return {"project_id": "10", "topic_mode": "custom_agent", "agent_code": "SMA-987"}

    async def create_task(_auth, body):
        sent.append(body)
        return {"task_id": "123"}

    ctx = SimpleNamespace(auth=auth, agent=submitting_agent(), sdk=SimpleNamespace(
        topic=SimpleNamespace(get_async=get_topic),
        task=SimpleNamespace(create_async=create_task),
    ))
    ctx.agent = submitting_agent("SMA-987")
    receipt = await _submit(ctx, "10", "20", "Continue")
    assert receipt["task_id"] == "123"
    assert sent[0]["agent_mode"] == "SMA-987"


@pytest.mark.asyncio
async def test_forced_submission_requests_interruption_and_keeps_task_id(auth):
    sent = []

    async def get_topic(_auth, topic_id):
        return {"project_id": "10", "topic_mode": "general"}

    async def create_task(_auth, body):
        sent.append(body)
        return {"task_id": "123"}

    ctx = SimpleNamespace(auth=auth, agent=submitting_agent(), sdk=SimpleNamespace(topic=SimpleNamespace(get_async=get_topic), task=SimpleNamespace(create_async=create_task)))
    receipt = await _submit(ctx, "10", "20", "Start now", force_interrupt=True)
    assert sent[0]["force_interrupt"] is True
    assert receipt["task_id"] == "123"
    assert receipt["force_interrupt"] is True


def submitting_agent(mode="general"):
    return SimpleNamespace(get_chat_client_message=lambda: SimpleNamespace(agent_mode=mode, model_id="text-model"), model_context=SimpleNamespace(configured_text_model_id="text-model"))


@pytest.mark.asyncio
@pytest.mark.parametrize("method,args,verb,path", [
    ("model_config_async", ["project_id_10"], "GET", "/api/v1/contact/users/setting/super-magic/topic-model/project_id_10"),
    ("execution_modes_async", [], "GET", "/api/v1/super-agents/featured"),
    ("mode_async", ["general"], "GET", "/api/v1/modes/general"),
    ("custom_models_async", [], "POST", "/api/v1/service-provider/models/queries"),
])
async def test_task_default_requests_use_current_user_authorization(monkeypatch, auth, method, args, verb, path):
    from app.infrastructure.sdk.magic_service.api.task_api import TaskApi
    captured = []

    async def request(self, parameter, actual_method, actual_path):
        captured.append((actual_method, actual_path, parameter.to_options(actual_method)))
        return {}

    monkeypatch.setattr(TaskApi, "request_by_parameter_async", request)
    await getattr(object.__new__(TaskApi), method)(auth, *args)
    assert captured[0][:2] == (verb, path)
    assert captured[0][2]["headers"]["user-authorization"] == "secret"
