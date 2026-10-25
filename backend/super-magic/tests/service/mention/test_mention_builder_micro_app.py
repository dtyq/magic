from unittest.mock import AsyncMock, patch

import pytest

from app.service.mention.builder import MentionContextBuilder
from app.service.mention.utils.micro_app_prompt import MULTI_MICRO_APP_SCOPE_TIP


@pytest.mark.asyncio
async def test_builder_binds_single_micro_app_scope_once():
    mentions = [{"type": "micro_app", "app_id": "app-1", "project_id": "project-1"}]
    with (
        patch(
            "app.service.mention.builder.sync_micro_app_scope_from_mentions",
            new=AsyncMock(
                return_value={"app-1": {"project_id": "project-1", "app_name": "app-1"}}
            ),
        ) as sync_mock,
        patch(
            "app.service.mention.handlers.micro_app_handler.has_bound_micro_app_project_scope",
            return_value=True,
        ),
        patch(
            "app.service.mention.handlers.micro_app_handler.get_micro_app_project_scopes",
            return_value={"app-1": {"project_id": "project-1", "app_name": "app-1"}},
        ),
        patch(
            "app.service.mention.handlers.micro_app_handler.get_mentioned_micro_app_ids",
            return_value=["app-1"],
        ),
    ):
        context = await MentionContextBuilder().build(mentions)

    sync_mock.assert_awaited_once_with(mentions)
    assert "micro-app://app-1" in context
    assert "use-magicbase" in context
    assert MULTI_MICRO_APP_SCOPE_TIP not in context


@pytest.mark.asyncio
async def test_builder_supports_multiple_micro_apps_with_app_id_guidance():
    mentions = [
        {"type": "micro_app", "app_id": "app-1", "project_id": "project-1", "app_name": "App One"},
        {"type": "micro_app", "app_id": "app-2", "project_id": "project-2", "app_name": "App Two"},
    ]
    scopes = {
        "app-1": {"project_id": "project-1", "app_name": "App One"},
        "app-2": {"project_id": "project-2", "app_name": "App Two"},
    }
    with (
        patch(
            "app.service.mention.builder.sync_micro_app_scope_from_mentions",
            new=AsyncMock(return_value=scopes),
        ) as sync_mock,
        patch(
            "app.service.mention.handlers.micro_app_handler.has_bound_micro_app_project_scope",
            return_value=True,
        ),
        patch(
            "app.service.mention.handlers.micro_app_handler.get_micro_app_project_scopes",
            return_value=scopes,
        ),
    ):
        context = await MentionContextBuilder().build(mentions)

    sync_mock.assert_awaited_once_with(mentions)
    assert MULTI_MICRO_APP_SCOPE_TIP in context
    assert "Pass app_id" in context
    assert "use-magicbase" in context


@pytest.mark.asyncio
async def test_builder_warns_when_some_micro_apps_are_unresolved():
    mentions = [
        {"type": "micro_app", "app_id": "app-1", "app_name": "App One"},
        {"type": "micro_app", "app_id": "app-2", "app_name": "App Two"},
    ]
    with (
        patch(
            "app.service.mention.builder.sync_micro_app_scope_from_mentions",
            new=AsyncMock(
                return_value={"app-1": {"project_id": "project-1", "app_name": "App One"}}
            ),
        ),
        patch(
            "app.service.mention.handlers.micro_app_handler.has_bound_micro_app_project_scope",
            return_value=True,
        ),
        patch(
            "app.service.mention.handlers.micro_app_handler.get_micro_app_project_scopes",
            return_value={"app-1": {"project_id": "project-1", "app_name": "App One"}},
        ),
        patch(
            "app.service.mention.handlers.micro_app_handler.get_mentioned_micro_app_ids",
            return_value=["app-1"],
        ),
    ):
        context = await MentionContextBuilder().build(mentions)

    assert "could not be resolved" in context
    assert "app-2" in context
    assert "Micro-app 'app-2' is explicitly referenced" not in context
    assert MULTI_MICRO_APP_SCOPE_TIP not in context


@pytest.mark.asyncio
async def test_builder_includes_previously_bound_micro_apps():
    mentions = [{"type": "micro_app", "app_id": "app-2", "app_name": "App Two"}]
    scopes = {
        "app-1": {"project_id": "project-1", "app_name": "App One"},
        "app-2": {"project_id": "project-2", "app_name": "App Two"},
    }
    with (
        patch(
            "app.service.mention.builder.sync_micro_app_scope_from_mentions",
            new=AsyncMock(return_value=scopes),
        ),
        patch(
            "app.service.mention.handlers.micro_app_handler.has_bound_micro_app_project_scope",
            return_value=True,
        ),
        patch(
            "app.service.mention.handlers.micro_app_handler.get_micro_app_project_scopes",
            return_value=scopes,
        ),
    ):
        context = await MentionContextBuilder().build(mentions)

    assert "[App One](micro-app://app-1)" in context
    assert "[App Two](micro-app://app-2)" in context
    assert MULTI_MICRO_APP_SCOPE_TIP in context


@pytest.mark.asyncio
async def test_builder_appends_bound_micro_apps_to_other_mentions():
    mentions = [{"type": "unknown_xyz", "id": "other"}]
    scopes = {"app-1": {"project_id": "project-1", "app_name": "App One"}}
    with (
        patch(
            "app.service.mention.builder.sync_micro_app_scope_from_mentions",
            new=AsyncMock(return_value=scopes),
        ),
        patch(
            "app.service.mention.handlers.micro_app_handler.has_bound_micro_app_project_scope",
            return_value=True,
        ),
        patch(
            "app.service.mention.handlers.micro_app_handler.get_micro_app_project_scopes",
            return_value=scopes,
        ),
        patch(
            "app.service.mention.handlers.micro_app_handler.get_mentioned_micro_app_ids",
            return_value=["app-1"],
        ),
    ):
        context = await MentionContextBuilder().build(mentions)

    assert "[App One](micro-app://app-1)" in context
    assert "use-magicbase" in context
    assert MULTI_MICRO_APP_SCOPE_TIP not in context
