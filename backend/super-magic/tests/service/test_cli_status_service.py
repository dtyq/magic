import asyncio

import pytest

from app.service.cli_status.providers.dws import DWS_HORIZON_TEXT, DwsCliStatusProbe
from app.service.cli_status.factory import CliStatusFactory
from app.service.cli_status.common import CliCommandResult, CliStatusProbe, CliStatusSnapshot
from app.service.cli_status.common.redaction import sanitize_text
from app.service.cli_status.providers.lark import LARK_HORIZON_TEXT, LarkCliStatusProbe


class FakeRunner:
    def __init__(self, responses):
        self.responses = responses
        self.calls = []

    async def __call__(self, argv, timeout):
        self.calls.append(tuple(argv))
        return self.responses.get(tuple(argv), CliCommandResult(tuple(argv), exit_code=127))


def test_sanitize_text_redacts_json_identity_fields():
    raw = (
        '{"appId":"mock-app","corp_id":"mock-corp","authenticated":true,'
        '"identities":{"user":{"openId":"mock-open","userName":"Mock User",'
        '"tokenStatus":"expired","status":"missing"}}}'
    )

    sanitized = sanitize_text(raw)

    assert "mock-app" not in sanitized
    assert "mock-corp" not in sanitized
    assert "mock-open" not in sanitized
    assert "Mock User" not in sanitized
    assert "expired" not in sanitized
    assert '"authenticated": true' in sanitized
    assert '"status": "missing"' in sanitized


@pytest.mark.asyncio
async def test_dws_probe_returns_empty_horizon_when_not_authenticated():
    runner = FakeRunner({
        ("dws", "auth", "status"): CliCommandResult(
            ("dws", "auth", "status"),
            0,
            stdout='{"success": true, "authenticated": false, "message": "未登录", "userName": "Mock User", "openId": "mock-open"}',
        ),
    })
    probe = DwsCliStatusProbe(runner=runner)

    status = await probe.detect()

    assert status.cli == "dws"
    assert status.horizon == ""
    assert status.has_horizon is False
    assert runner.calls == [("dws", "auth", "status")]


@pytest.mark.asyncio
async def test_dws_probe_summarizes_authenticated_without_raw_identity_fields():
    runner = FakeRunner({
        ("dws", "auth", "status"): CliCommandResult(
            ("dws", "auth", "status"),
            0,
            stdout='{"success": true, "authenticated": true, "refresh_token_valid": true, "corp_id": "mock-corp", "userName": "Mock User", "open_id": "mock-open"}',
        ),
    })
    probe = DwsCliStatusProbe(runner=runner)

    status = await probe.detect()

    assert status.cli == "dws"
    assert status.horizon == DWS_HORIZON_TEXT
    assert status.has_horizon is True
    assert "DingTalk/钉钉" in status.horizon
    assert "read_skills(['dingtalk-cli'])" in status.horizon
    assert runner.calls == [("dws", "auth", "status")]


@pytest.mark.asyncio
async def test_dws_probe_timeout_is_unknown():
    runner = FakeRunner({
        ("dws", "auth", "status"): CliCommandResult(
            ("dws", "auth", "status"),
            -1,
            timed_out=True,
        ),
    })
    probe = DwsCliStatusProbe(runner=runner)

    status = await probe.detect()

    assert status.cli == "dws"
    assert status.horizon == ""
    assert status.has_horizon is False
    assert runner.calls == [("dws", "auth", "status")]


@pytest.mark.asyncio
async def test_lark_probe_summarizes_not_configured_status_command():
    runner = FakeRunner({
        ("lark-cli", "auth", "status"): CliCommandResult(
            ("lark-cli", "auth", "status"),
            0,
            stdout='{"ok": false, "error": {"type": "config", "subtype": "not_configured", "message": "not configured", "hint": "run `lark-cli config init --new`"}}',
        ),
    })
    probe = LarkCliStatusProbe(runner=runner)

    status = await probe.detect()

    assert status.cli == "lark-cli"
    assert status.horizon == ""
    assert status.has_horizon is False
    assert runner.calls == [("lark-cli", "auth", "status")]


@pytest.mark.asyncio
async def test_lark_probe_authenticated_summary_uses_identity_state_only():
    runner = FakeRunner({
        ("lark-cli", "auth", "status"): CliCommandResult(
            ("lark-cli", "auth", "status"),
            0,
            stdout=(
                '{"appId":"mock-app","brand":"feishu","defaultAs":"auto",'
                '"identities":{"bot":{"status":"ready","available":true,"message":"Bot identity: ready"},'
                '"user":{"status":"missing","available":false,"message":"User identity: missing",'
                '"openId":"mock-open","userName":"Mock User","tokenStatus":"expired","scope":"mock-scope"}},'
                '"identity":"bot","note":"User identity is missing; bot identity is ready"}'
            ),
        ),
    })
    probe = LarkCliStatusProbe(runner=runner)

    status = await probe.detect()

    assert status.cli == "lark-cli"
    assert status.horizon == LARK_HORIZON_TEXT
    assert status.has_horizon is True
    assert "Lark/Feishu/飞书" in status.horizon
    assert "read_skills(['lark-cli'])" in status.horizon
    assert "mock-app" not in status.horizon
    assert "mock-open" not in status.horizon
    assert "Mock User" not in status.horizon
    assert "mock-scope" not in status.horizon
    assert "token" not in status.horizon.lower()
    assert runner.calls == [("lark-cli", "auth", "status")]


class FakeHorizon:
    def __init__(self):
        self.cli_status = ""

    async def set_cli_status(self, content):
        self.cli_status = content


class FakeAgentContext:
    def __init__(self):
        self.horizon = FakeHorizon()


class SlowProbe(CliStatusProbe):
    cli_name = "mock-cli"

    async def detect(self):
        await asyncio.sleep(0.03)
        return CliStatusSnapshot(
            cli="mock-cli",
            horizon="authenticated",
        )


class FastProbe(CliStatusProbe):
    cli_name = "fast-cli"

    async def detect(self):
        return CliStatusSnapshot(cli="fast-cli")


class FailingProbe(CliStatusProbe):
    cli_name = "failing-cli"

    async def detect(self):
        raise RuntimeError("mock failure")


class CustomHorizonProbe(CliStatusProbe):
    cli_name = "custom-cli"

    async def detect(self):
        return CliStatusSnapshot(
            cli="custom-cli",
            horizon="<custom_status>authenticated</custom_status>",
        )


@pytest.mark.asyncio
async def test_factory_ignores_empty_horizon_and_failed_probe():
    CliStatusFactory.configure_for_tests(lambda: [FastProbe(), FailingProbe()])
    try:
        entries = await CliStatusFactory.build_horizon_entries()

        assert entries == ()
    finally:
        CliStatusFactory.reset_for_tests()


@pytest.mark.asyncio
async def test_factory_wraps_custom_horizon_content():
    CliStatusFactory.configure_for_tests(lambda: [CustomHorizonProbe()])
    try:
        entries = await CliStatusFactory.build_horizon_entries()
        status = CliStatusFactory.format_horizon_text(entries)

        assert entries == (
            CliStatusSnapshot(cli="custom-cli", horizon="<custom_status>authenticated</custom_status>"),
        )
        assert status == (
            '<cli name="custom-cli"><custom_status>authenticated</custom_status></cli>'
        )
    finally:
        CliStatusFactory.reset_for_tests()


@pytest.mark.asyncio
async def test_factory_initial_wait_does_not_block_when_detection_is_not_ready():
    context = FakeAgentContext()
    CliStatusFactory.configure_for_tests(lambda: [SlowProbe()])
    try:
        CliStatusFactory.schedule_initial_detection(context)
        task = CliStatusFactory.get_initial_detection_task_for_tests(context)

        await CliStatusFactory.wait_initial(context, timeout=0.001)

        assert context.horizon.cli_status == ""
        assert task is not None
        await task
        assert '<cli name="mock-cli">authenticated</cli>' in context.horizon.cli_status
        assert "installed=yes" not in context.horizon.cli_status
        assert "detail=" not in context.horizon.cli_status
        assert "capabilities=" not in context.horizon.cli_status
    finally:
        CliStatusFactory.reset_for_tests()
