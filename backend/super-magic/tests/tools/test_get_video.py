import pytest
from pathlib import Path

from agentlang.context.tool_context import ToolContext
from app.i18n import i18n
from app.tools.get_video import GetVideo, GetVideoParams


class _ToolContext:
    tool_call_id = "call-1"

    def get_extension(self, name):
        return None


class _AgentContext:
    def __init__(self):
        self.events = []
        self.activity_updates = 0

    def update_activity_time(self):
        self.activity_updates += 1

    async def dispatch_event(self, event_type, event_data):
        self.events.append((event_type, event_data))


@pytest.mark.asyncio
async def test_once_queries_once_and_returns_pending_status(tmp_path):
    tool = GetVideo(base_dir=tmp_path)
    calls = []

    class FakeClient:
        async def get_video_operation(self, operation_id, request_id=""):
            calls.append(operation_id)
            return {"id": operation_id, "status": "processing"}

    tool._magic_service_client = FakeClient()

    result = await tool.execute_purely(
        None,
        GetVideoParams(operation_id="op-1", wait_mode="once"),
    )

    assert calls == ["op-1"]
    assert result.ok is True
    assert result.data["operation_id"] == "op-1"
    assert result.data["status"] == "processing"
    assert "call get_video again" in result.content.lower()


@pytest.mark.asyncio
async def test_until_complete_polls_and_downloads_video(monkeypatch, tmp_path):
    tool = GetVideo(base_dir=tmp_path)
    statuses = iter(["queued", "processing", "succeeded"])
    calls = []

    class FakeClient:
        async def get_video_operation(self, operation_id, request_id=""):
            calls.append(operation_id)
            status = next(statuses)
            result = {"id": operation_id, "status": status}
            if status == "succeeded":
                result["output"] = {"video_url": "https://cdn/video.mp4"}
            return result

    async def fake_sleep(seconds):
        assert seconds == 10

    async def fake_download(_context, url, output_path, video_name, override):
        assert url == "https://cdn/video.mp4"
        return str(tmp_path / "videos/cat.mp4"), "videos/cat.mp4"

    tool._magic_service_client = FakeClient()
    monkeypatch.setattr("app.tools.get_video.asyncio.sleep", fake_sleep)
    monkeypatch.setattr(tool, "_download_video", fake_download)

    result = await tool.execute_purely(
        _ToolContext(),
        GetVideoParams(operation_id="op-1", video_name="cat"),
    )

    assert calls == ["op-1", "op-1", "op-1"]
    assert result.ok is True
    assert result.videos == [str(tmp_path / "videos/cat.mp4")]
    assert result.data["status"] == "succeeded"


def test_wait_mode_defaults_to_until_complete():
    assert GetVideoParams(operation_id="op-1").wait_mode == "until_complete"


@pytest.mark.asyncio
async def test_tool_name_is_get_video_in_ui_events():
    tool = GetVideo()
    try:
        i18n.set_language("zh_CN")
        zh_detail = await tool.get_before_tool_call_friendly_action_and_remark(
            "get_video", None, {}
        )
        i18n.set_language("en_US")
        en_detail = await tool.get_before_tool_call_friendly_action_and_remark(
            "get_video", None, {}
        )

        assert tool.name == "get_video"
        assert zh_detail["action"] == "获取视频"
        assert zh_detail["tool_name"] == "get_video"
        assert en_detail["action"] == "Get video"
    finally:
        i18n.reset_language()


def test_prompt_hint_explains_create_then_reuse_workflow():
    hint = GetVideo().get_prompt_hint()

    assert "调用流程" in hint
    assert "1. 调用 generate_video 创建视频任务" in hint
    assert "2. 将返回的 operation_id 传给 get_video" in hint
    assert "持续等待结果" in hint
    assert 'wait_mode="once"' in hint
    assert "只查询一次" in hint
    assert "不要重复创建任务" in hint
    assert "Usage" in hint
    assert "Call generate_video to create a video task" in hint
    assert "Pass its operation_id to get_video" in hint
    assert "wait and poll until completion" in hint
    assert "query the current status once" in hint
    assert "Do not create a duplicate task" in hint


@pytest.mark.asyncio
async def test_until_complete_dispatches_video_progress(monkeypatch, tmp_path):
    tool = GetVideo(base_dir=tmp_path)
    statuses = iter(["queued", "succeeded"])
    agent_context = _AgentContext()

    class FakeClient:
        async def get_video_operation(self, operation_id, request_id=""):
            status = next(statuses)
            result = {"id": operation_id, "status": status}
            if status == "succeeded":
                result["output"] = {"video_url": "https://cdn/video.mp4"}
            return result

    async def fake_download(*_args):
        return str(tmp_path / "videos/video.mp4"), "videos/video.mp4"

    tool._magic_service_client = FakeClient()
    monkeypatch.setattr("app.tools.get_video.asyncio.sleep", lambda _seconds: _done())
    monkeypatch.setattr(tool, "_download_video", fake_download)
    tool_context = ToolContext(tool_call_id="call-progress", tool_name="get_video")
    tool_context.register_extension("agent_context", agent_context)

    await tool.execute_purely(
        tool_context,
        GetVideoParams(operation_id="op-progress"),
    )

    assert agent_context.activity_updates == 1
    assert len(agent_context.events) == 1
    event_type, event_data = agent_context.events[0]
    assert event_type.value == "pending_tool_call"
    assert event_data.tool_name == "get_video"
    assert event_data.arguments["name"] == "get_video"
    assert event_data.arguments["detail"]["data"]["operation_id"] == "op-progress"
    assert event_data.arguments["detail"]["data"]["status"] == "queued"


@pytest.mark.asyncio
async def test_until_complete_stops_waiting_after_1800_seconds(monkeypatch, tmp_path):
    tool = GetVideo(base_dir=tmp_path)
    calls = []

    class FakeClient:
        async def get_video_operation(self, operation_id, request_id=""):
            calls.append(operation_id)
            return {"id": operation_id, "status": "processing"}

    tool._magic_service_client = FakeClient()
    assert tool.MAX_WAIT_SECONDS == 1800
    monkeypatch.setattr(tool, "MAX_WAIT_SECONDS", 0)

    result = await tool.execute_purely(
        None,
        GetVideoParams(operation_id="op-timeout"),
    )

    assert calls == ["op-timeout"]
    assert result.ok is True
    assert result.data["timed_out"] is True
    assert result.extra_info["timed_out"] is True
    assert "Call get_video again later" in result.content


def test_get_video_is_registered_only_for_general_agent():
    root = Path(__file__).parents[2]

    assert "from app.tools.get_video import GetVideo" in (
        root / "app/tools/__init__.py"
    ).read_text()
    assert "- get_video" in (root / "agents/magic.agent").read_text()
    assert "- get_video" not in (root / "agents/design.agent").read_text()


async def _done():
    return None
