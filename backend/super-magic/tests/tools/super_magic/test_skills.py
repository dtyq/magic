"""真人确认、固定快照、重试和跨用户隔离回归。"""
import asyncio
import hashlib
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

from agentlang.context.tool_context import ToolContext

import pytest

from app.core.context.execution_source import SuperMagicExecutionSource
from app.i18n import i18n
from app.infrastructure.sdk.base.exceptions import HttpRequestError
from app.infrastructure.sdk.magic_service.api.skill_api import SkillApi
from app.infrastructure.sdk.magic_service.kernel.magic_service_parameter import MagicServiceAuthConfig
from app.path_manager import PathManager
from app.service.prepared_operation_confirmation import PreparedOperationConfirmation, PreparedOperationError
from app.service.user_tool_call_service import PendingToolCall, UserToolCallService
from app.tools.ask_user import AskUserTool, build_ask_user_result_builder
from app.tools.canvas.application.operation_confirmation import CanvasOperationConfirmation
from app.tools.canvas.domain.errors import CanvasDomainError
from app.tools.super_magic.context import ProductContext
from app.tools.super_magic.skills import (
    GetSkillParams,
    PrepareSkillPublish,
    PrepareSkillPublishParams,
    PublishSkill,
    PublishSkillParams,
    interruptible,
    materialize_snapshot,
    skill_result,
)


@pytest.fixture
def context(tmp_path, monkeypatch):
    monkeypatch.setattr(PathManager, 'get_runtime_dir', lambda: tmp_path / '.runtime')
    auth = MagicServiceAuthConfig(user_id='123', organization_code='org', user_authorization='secret')
    event = asyncio.Event()
    agent = SimpleNamespace(
        get_metadata=lambda: {'topic_id': '456'}, get_workspace_dir=lambda: str(tmp_path / 'workspace'),
        get_user_context_auth=lambda: auth, is_interactive_main_agent_context=lambda: True,
        get_interruption_event=lambda: event, is_interruption_requested=lambda: event.is_set(), update_activity_time=lambda: None,
    )
    sdk = SimpleNamespace(skill=SimpleNamespace(publish_prepared_async=AsyncMock(return_value={
        'skill_code': 'skill-code', 'project_id': '789', 'version': '1.0.0', 'status': 'published',
    })))
    product = ProductContext(sdk=sdk, auth=auth, agent=agent)
    monkeypatch.setattr('app.tools.super_magic.display.current_product_context', lambda _: product)
    tool = SimpleNamespace(get_extension_typed=lambda *_: agent, get_extension=lambda _: agent, tool_call_id='publish-call')
    return product, tool


async def prepared(context):
    service = PreparedOperationConfirmation(context[0].agent)
    await service.prepare('prepare-call', 'skill_publish', {'skill_code': 'skill-code', 'prepare_token': 'token'}, 'hash', 'Publish this version?')
    await service.bind('prepare-call', 'human-call', 'q-1')
    return service


@pytest.mark.asyncio
@pytest.mark.parametrize('answers,approved', [
    ({'q-0': '是'}, True), ({'bound-question': '是'}, True),
    ({'q-0': ''}, False), ({'q-0': '否'}, False),
    ({'old-question': '是'}, False), ({'q-1': '是'}, False),
    ({'q-0': '是', 'bound-question': '是'}, False),
    (['是'], False),
])
async def test_raw_confirmation_accepts_only_bound_question_or_single_frontend_position(context, answers, approved):
    service = PreparedOperationConfirmation(context[0].agent)
    await service.prepare('prepare-call', 'skill_publish', {}, 'hash', 'Publish?')
    await service.bind('prepare-call', 'human-call', 'bound-question')
    await service.answer('prepare-call', 'human-call', 'answered', answers)
    if approved:
        assert (await service.read('prepare-call')).state == 'approved'
    else:
        with pytest.raises(PreparedOperationError):
            await service.read('prepare-call')


@pytest.mark.asyncio
@pytest.mark.parametrize('status,answers,remark,approved', [
    ('answered', {'q-0': '是'}, '', True),
    ('answered', {'bound-question-uuid': '是'}, '', True),
    ('answered', {'old-question': '是'}, '', False),
    ('answered', {'q-0': ''}, '', False),
    ('answered', {'q-0': '是'}, 'Change the name first', False),
    ('timeout', {'q-0': '是'}, '', False),
    ('cancelled', {'q-0': '是'}, '', False),
])
async def test_publish_confirmation_through_frontend_callback(context, monkeypatch, status, answers, remark, approved):
    confirmation = PreparedOperationConfirmation(context[0].agent)
    await confirmation.prepare('prepare-call', 'skill_publish', {'skill_code': 'skill-code', 'prepare_token': 'token'}, 'hash', 'Publish?')
    await confirmation.bind('prepare-call', 'human-call', 'bound-question-uuid')
    agent = context[0].agent
    agent.clear_user_tool_call_pending = lambda: None
    agent.chat_history = SimpleNamespace(append_tool_message=AsyncMock())
    pending = PendingToolCall(
        tool_call_id='human-call', tool_name='ask_user', agent_context=agent, timeout_task=None,
        tool_data={'prepared_tool_call_id': 'prepare-call'},
        result_builder=build_ask_user_result_builder([{'sub_id': 'bound-question-uuid', 'interaction_type': 'confirm', 'title': 'Publish?'}]),
    )
    service = UserToolCallService()
    monkeypatch.setattr(service, '_emit_after_tool_call', AsyncMock())
    monkeypatch.setattr(service, '_delete_pending_file', AsyncMock())
    monkeypatch.setattr(service, '_resume_agent', AsyncMock())
    monkeypatch.setattr('app.service.user_tool_call_service.ToolCallEventManager.create_tool_context', lambda *_: context[1])
    monkeypatch.setattr('app.service.user_tool_call_service.tool_result_content_manager.prepare', AsyncMock(side_effect=lambda result, **_: result))
    await service.resume_after_user_tool_call(pending, status, json.dumps(answers), remark)
    if approved:
        assert (await confirmation.read('prepare-call')).state == 'approved'
    else:
        with pytest.raises(PreparedOperationError):
            await confirmation.read('prepare-call')
    result = await PublishSkill().execute(context[1], PublishSkillParams(prepared_tool_call_id='prepare-call'))
    assert result.ok is approved
    assert context[0].sdk.skill.publish_prepared_async.await_count == int(approved)


@pytest.mark.asyncio
async def test_publish_uses_stored_human_confirmation_without_model_supplied_id(context):
    service = await prepared(context)
    params = PublishSkillParams(prepared_tool_call_id='prepare-call')
    assert not (await PublishSkill().execute(context[1], params)).ok
    await service.answer('prepare-call', 'human-call', 'answered', {'q-0': '是'})
    first = await PublishSkill().execute(context[1], params)
    second = await PublishSkill().execute(context[1], params)
    assert first.ok and second.ok and first.data == second.data
    context[0].sdk.skill.publish_prepared_async.assert_awaited_once()


@pytest.mark.asyncio
async def test_confirmation_failure_has_specific_user_error(context):
    result = await PublishSkill().execute(context[1], PublishSkillParams(
        prepared_tool_call_id='missing', confirmation_tool_call_id='human-call',
    ))
    assert result.data['code'] == 'confirmation_required'
    i18n.set_language('zh_CN')
    try:
        detail = await PublishSkill().get_tool_detail(None, result)
        assert '确认' in detail.data.content
        assert '操作参数或返回内容不符合要求' not in detail.data.content
    finally:
        i18n.reset_language()


@pytest.mark.asyncio
@pytest.mark.parametrize('status,answers,remark', [
    ('cancelled', {'q-1': '是'}, ''), ('timeout', {'q-1': '是'}, ''),
    ('answered', {'q-1': '否'}, ''), ('answered', {'q-1': '是'}, 'Change it to private first'),
    ('answered', {'other': '是'}, ''), ('answered', {'q-1': '是', 'q-2': '是'}, ''),
])
async def test_non_approval_never_publishes(context, status, answers, remark):
    service = await prepared(context)
    await service.answer('prepare-call', 'human-call', status, answers, remark)
    result = await PublishSkill().execute(context[1], PublishSkillParams(prepared_tool_call_id='prepare-call', confirmation_tool_call_id='human-call'))
    assert not result.ok
    context[0].sdk.skill.publish_prepared_async.assert_not_awaited()


@pytest.mark.asyncio
async def test_confirmation_required_and_completed_retry_is_read_only(context):
    service = await prepared(context)
    params = PublishSkillParams(prepared_tool_call_id='prepare-call', confirmation_tool_call_id='human-call')
    assert not (await PublishSkill().execute(context[1], params)).ok
    await service.answer('prepare-call', 'human-call', 'answered', {'q-1': '是'})
    mismatch = await PublishSkill().execute(context[1], params.model_copy(update={'confirmation_tool_call_id': 'invented'}))
    assert not mismatch.ok and mismatch.data['code'] == 'confirmation_mismatch'
    assert 'do not ask the user again' in mismatch.content
    first = await PublishSkill().execute(context[1], params)
    second = await PublishSkill().execute(context[1], params)
    assert first.ok and second.ok and first.data == second.data
    context[0].sdk.skill.publish_prepared_async.assert_awaited_once_with(context[0].auth, 'skill-code', 'token')


@pytest.mark.asyncio
async def test_uncertain_submission_retries_same_token(context):
    service = await prepared(context)
    await service.answer('prepare-call', 'human-call', 'answered', {'q-1': '是'})
    context[0].sdk.skill.publish_prepared_async.side_effect = [HttpRequestError('response lost'), {'status': 'under_review', 'skill_code': 'skill-code'}]
    params = PublishSkillParams(prepared_tool_call_id='prepare-call', confirmation_tool_call_id='human-call')
    first = await PublishSkill().execute(context[1], params)
    assert not first.ok and first.data['code'] == 'outcome_unknown'
    assert (await service.read('prepare-call')).state == 'executing'
    second = await PublishSkill().execute(context[1], params)
    assert second.ok and 'not yet published' in second.content
    assert all(call.args[-1] == 'token' for call in context[0].sdk.skill.publish_prepared_async.await_args_list)


@pytest.mark.asyncio
async def test_cross_user_and_expired_confirmations_rejected(context):
    service = await prepared(context)
    context[0].agent.get_user_context_auth = lambda: MagicServiceAuthConfig(user_id='different', organization_code='org', user_authorization='different')
    with pytest.raises(PreparedOperationError, match='another user'):
        await service.read('prepare-call')
    context[0].agent.get_user_context_auth = lambda: context[0].auth
    record = await service.read('prepare-call')
    record.created_at -= 86401
    await service.save(record)
    with pytest.raises(PreparedOperationError, match='again'):
        await service.read('prepare-call')


@pytest.mark.asyncio
async def test_canvas_compatibility(context):
    service = CanvasOperationConfirmation(context[0].agent)
    await service.prepare('canvas', 'delete', {}, 'original', 'Delete?')
    generic = PreparedOperationConfirmation(context[0].agent)
    await generic.bind('canvas', 'ask-canvas', 'q')
    await generic.answer('canvas', 'ask-canvas', 'answered', {'q': '是'})
    with pytest.raises(CanvasDomainError, match='changed'):
        await service.consume('canvas', 'ask-canvas', 'delete', 'changed')
    await service.consume('canvas', 'ask-canvas', 'delete', 'original')
    with pytest.raises(CanvasDomainError):
        await service.consume('canvas', 'ask-canvas', 'delete', 'original')


@pytest.mark.asyncio
async def test_ask_user_uses_bound_snapshot_question_without_default_approval(context, monkeypatch):
    service = PreparedOperationConfirmation(context[0].agent)
    await service.prepare('prepare-call', 'skill_publish', {}, 'hash', 'Publish <Demo> to private?')
    question_context = ToolContext(tool_call_id='real-question', tool_name='ask_user')
    monkeypatch.setattr(question_context, 'get_extension_typed', lambda *_: context[0].agent)
    question_context.arguments = {
        'prepared_tool_call_id': 'prepare-call',
        'questions': '<question type="confirm" default="是">Publish something else?</question>',
        'timeout': 60,
    }
    monkeypatch.setattr(AskUserTool, '_get_execution_source', staticmethod(lambda _: SuperMagicExecutionSource.HUMAN_CHAT))
    ask_user = AskUserTool()
    await ask_user._prepare(question_context)
    first_id = question_context.arguments['parsed_questions'][0]['sub_id']
    await ask_user._prepare(question_context)
    assert question_context.arguments['parsed_questions'][0]['sub_id'] == first_id
    assert question_context.arguments['questions'] == '<question type="confirm">Publish &lt;Demo&gt; to private?</question>'
    assert question_context.arguments['expires_at'] == 0
    record = await service.read('prepare-call')
    assert record.state == 'waiting'
    assert record.confirmation_tool_call_id == 'real-question'
    assert record.question_id == question_context.arguments['parsed_questions'][0]['sub_id']


@pytest.mark.asyncio
async def test_snapshot_rejects_changes_and_keeps_old_bytes(context, tmp_path, monkeypatch):
    mounts = tmp_path / 'mounts'
    monkeypatch.setenv('AGENT_REFERENCED_PROJECT_MOUNT_BASE_PATH', str(mounts))
    source = mounts / '789/.magic/skills/demo/SKILL.md'
    source.parent.mkdir(parents=True)
    source.write_bytes(b'original')
    record = {'project_id': '789', 'skill_dir': 'demo', 'prepare_token': 'a' * 64, 'manifest': {'SKILL.md': hashlib.sha256(b'original').hexdigest()}}
    snapshot = await materialize_snapshot(record, context[0].agent)
    source.write_bytes(b'edited')
    assert (snapshot / 'SKILL.md').read_bytes() == b'original'
    with pytest.raises(ValueError, match='changed'):
        await materialize_snapshot(record, context[0].agent)
    record['manifest'] = {'../outside': 'hash'}
    with pytest.raises(ValueError, match='invalid path'):
        await materialize_snapshot(record, context[0].agent)


def ready_preparation():
    return {
        'status': 'ready', 'skill_code': 'skill-code', 'project_id': '789',
        'skill_dir': 'demo', 'prepare_token': 'a' * 64, 'publish_task_id': 'a' * 64,
        'name': 'Demo', 'description': 'Reusable workflow', 'version': '1.0.0',
        'publish_target_type': 'PRIVATE', 'package_sha256': 'package-hash',
        'manifest': {'SKILL.md': hashlib.sha256(b'original').hexdigest()},
    }


@pytest.mark.asyncio
@pytest.mark.parametrize('explicit_base', [None, '', '   ', 'custom'])
async def test_prepare_reviews_real_snapshot_using_runtime_mount_root(context, tmp_path, monkeypatch, explicit_base):
    fuse_root = tmp_path / 'agfs-vol/agfs'
    monkeypatch.setenv('AGFS_FUSE_MOUNT_PATH', str(fuse_root))
    if explicit_base is None:
        monkeypatch.delenv('AGENT_REFERENCED_PROJECT_MOUNT_BASE_PATH', raising=False)
    else:
        monkeypatch.setenv('AGENT_REFERENCED_PROJECT_MOUNT_BASE_PATH', str(tmp_path / 'custom') if explicit_base == 'custom' else explicit_base)
    mount = tmp_path / 'custom' if explicit_base == 'custom' else fuse_root / 'magicfs/referenced-projects'
    source = mount / '789/.magic/skills/demo/SKILL.md'
    source.parent.mkdir(parents=True)
    source.write_bytes(b'original')
    context[0].sdk.skill.prepare_publish_async = AsyncMock(return_value=ready_preparation())
    result = await PrepareSkillPublish().execute(context[1], PrepareSkillPublishParams(code='skill-code'))
    assert result.ok, result.content
    assert result.data['status'] == 'ready'
    assert (tmp_path / '.runtime/skill-publish' / ('a' * 64) / 'SKILL.md').read_bytes() == b'original'
    record = await PreparedOperationConfirmation(context[0].agent).read(context[1].tool_call_id)
    assert record.state == 'prepared'
    assert record.payload['project_id'] == '789'
    assert record.payload['snapshot_path'] == result.data['snapshot_path']
    context[0].sdk.skill.publish_prepared_async.assert_not_awaited()


@pytest.mark.asyncio
async def test_missing_source_reports_recovery_without_reexporting(context, tmp_path, monkeypatch):
    monkeypatch.delenv('AGENT_REFERENCED_PROJECT_MOUNT_BASE_PATH', raising=False)
    monkeypatch.setenv('AGFS_FUSE_MOUNT_PATH', str(tmp_path / 'unavailable-mount'))
    context[0].sdk.skill.check_preparation_async = AsyncMock(return_value=ready_preparation())
    result = await PrepareSkillPublish().execute(context[1], PrepareSkillPublishParams(code='skill-code', publish_task_id='a' * 64))
    assert not result.ok
    assert result.data['code'] == 'resource_files_unavailable'
    assert result.data['publish_task_id'] == 'a' * 64
    assert 'mount' in result.content and 'permissions' in result.content
    assert 'Do not keep polling or create another export' in result.content
    context[0].sdk.skill.check_preparation_async.assert_awaited_once()
    context[0].sdk.skill.publish_prepared_async.assert_not_awaited()
    assert not PreparedOperationConfirmation(context[0].agent)._path(context[1].tool_call_id).exists()
    i18n.set_language('zh_CN')
    try:
        detail = await PrepareSkillPublish().get_tool_detail(None, result)
        assert '无法读取所需的项目文件' in detail.data.content
        assert str(tmp_path) not in detail.data.content
    finally:
        i18n.reset_language()


@pytest.mark.asyncio
async def test_interrupt_cancels_http_work(context):
    cancelled = asyncio.Event()
    async def work():
        try:
            await asyncio.sleep(60)
        finally:
            cancelled.set()
    task = asyncio.create_task(interruptible(context[0], work()))
    await asyncio.sleep(0)
    context[0].agent.get_interruption_event().set()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert cancelled.is_set()


@pytest.mark.asyncio
async def test_sdk_uses_current_auth_and_project_lookup(context, monkeypatch):
    captured = []
    async def request(self, parameter, method, path):
        captured.append((method, path, parameter.to_options(method)))
        return {}
    monkeypatch.setattr(SkillApi, 'request_by_parameter_async', request)
    api = object.__new__(SkillApi)
    await api.get_draft_async(context[0].auth, project_id='789')
    await api.publish_prepared_async(context[0].auth, 'skill-code', 'token')
    assert captured[0][1].endswith('/skills/by-project/789')
    assert captured[1][2]['json'] == {'prepare_token': 'token'}
    assert captured[1][2]['headers']['user-authorization'] == 'secret'


@pytest.mark.parametrize('args', [{}, {'code': 'code', 'project_id': '789'}, {'project_id': '../wrong'}])
def test_exact_identity_validation(args):
    with pytest.raises(ValueError):
        GetSkillParams(**args)


def test_ready_and_review_are_not_published():
    assert 'Not published' in skill_result({'status': 'ready'}).content
    assert 'not yet published' in skill_result({'status': 'under_review'}).content
