import asyncio
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import pytest

from agentlang.context.tool_context import ToolContext
from app.service.asr.asr_audio_preparation import AudioPreparationMode, AudioProbe, PreparedAudio
from app.tools.audio_understanding import AudioUnderstanding, AudioUnderstandingError, AudioUnderstandingParams


@pytest.fixture
def tool(tmp_path, monkeypatch):
    instance = AudioUnderstanding(base_dir=str(tmp_path))
    instance.api_base_url = "https://asr.example.test"
    instance.PROGRESS_REPORT_INTERVAL = 0.001
    instance.max_query_failures = 3
    instance.config = SimpleNamespace(
        get=lambda key, default=None: instance.max_query_failures
        if key == "audio_understanding.max_consecutive_query_failures"
        else default
    )
    instance.asr_events = []
    monkeypatch.setattr(
        instance, "_log_asr_event", lambda level, event, **fields: instance.asr_events.append((level, event, fields))
    )

    @asynccontextmanager
    async def prepare_audio(path, forced_mode=None):
        probe = AudioProbe(path=path, container="ogg", codec="opus", sample_rate=48000, channels=1,
                           bits_per_sample=None, sample_format=None, duration_seconds=1)
        yield PreparedAudio(source=probe, upload=probe, mode=forced_mode or AudioPreparationMode.PRESERVE, temporary=False)

    monkeypatch.setattr(instance.audio_preparer, "prepare_audio", prepare_audio)
    monkeypatch.setattr(instance, "_build_api_headers", lambda: {})
    monkeypatch.setattr(instance, "_dispatch_transcription_progress_event", AsyncMock())
    return instance


def install_transport(monkeypatch, handler):
    original = httpx.AsyncClient
    monkeypatch.setattr("app.tools.audio_understanding.httpx.AsyncClient",
                        lambda: original(transport=httpx.MockTransport(handler)))


def success_response(request):
    return httpx.Response(200, request=request, headers={"X-Volcengine-Status-Code": "20000000"},
                          json={"audio_info": {"duration": 1000, "utterances": [
                              {"text": "Actual meeting speech", "start_time": 0, "speaker": "1"}]}})


async def test_connect_timeout_retries_same_task_then_succeeds(tool, monkeypatch):
    paths = []

    def handler(request):
        paths.append(request.url.path)
        if len(paths) == 1:
            raise httpx.ConnectTimeout("", request=request)
        return success_response(request)

    install_transport(monkeypatch, handler)
    result = await tool._poll_transcription_result("existing-task", 1, "correlation")
    assert "Actual meeting speech" in result.text
    assert paths == ["/speech/large-model/query/existing-task"] * 2
    assert any(
        event == "audio.asr.query.retry" and fields["error_type"] == "ConnectTimeout"
        for _, event, fields in tool.asr_events
    )
    assert all(call.args[3] < 100 for call in tool._dispatch_transcription_progress_event.call_args_list)


async def test_persistent_read_timeout_is_bounded_and_keeps_task_id(tool, monkeypatch):
    requests = []

    def handler(request):
        requests.append(request)
        raise httpx.ReadTimeout("", request=request)

    install_transport(monkeypatch, handler)
    with pytest.raises(AudioUnderstandingError) as caught:
        await tool._poll_transcription_result("existing-task", 1, "correlation")
    assert len(requests) == tool.max_query_failures
    assert caught.value.error_code == "QUERY_RESULT_UNKNOWN"
    assert caught.value.task_id == "existing-task"
    assert "ReadTimeout" in caught.value.message
    assert "resubmitting" in caught.value.message


async def test_deadline_bounds_in_flight_request(tool, monkeypatch):
    cancelled = asyncio.Event()

    async def handler(request):
        try:
            await asyncio.sleep(10)
        finally:
            cancelled.set()
        return success_response(request)

    install_transport(monkeypatch, handler)
    with pytest.raises(AudioUnderstandingError, match="unknown|Unable to confirm"):
        await asyncio.wait_for(tool._poll_transcription_result("existing-task", 0.03, "correlation"), 0.5)
    assert cancelled.is_set()


@pytest.mark.parametrize("status, error_code", [(403, "AUTHENTICATION_FAILED"), (404, "QUERY_HTTP_ERROR")])
async def test_non_transient_http_error_is_not_retried(tool, monkeypatch, status, error_code):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(status, request=request, json={"message": "failure"})

    install_transport(monkeypatch, handler)
    with pytest.raises(AudioUnderstandingError, match=f"HTTP {status}") as caught:
        await tool._poll_transcription_result("existing-task", 1, "correlation")
    assert len(calls) == 1
    assert caught.value.error_code == error_code
    assert caught.value.task_id == "existing-task"


async def test_transient_http_status_retries_same_task_then_reports_unknown(tool, monkeypatch):
    calls = []

    def handler(request):
        calls.append(request.url.path)
        return httpx.Response(503, request=request, json={"message": "unavailable"})

    install_transport(monkeypatch, handler)
    with pytest.raises(AudioUnderstandingError, match="HTTP 503") as caught:
        await tool._poll_transcription_result("existing-task", 1, "correlation")
    assert calls == ["/speech/large-model/query/existing-task"] * tool.max_query_failures
    assert caught.value.error_code == "QUERY_RESULT_UNKNOWN"
    assert caught.value.task_id == "existing-task"


@pytest.mark.parametrize("status", ["45000006", "20000003", "55000031", "unknown"])
async def test_asr_business_error_never_becomes_transcript(tool, monkeypatch, status):
    install_transport(monkeypatch, lambda request: httpx.Response(
        200, request=request, headers={"X-Volcengine-Status-Code": status}, json={"audio_info": {"duration": 1000}}))
    with pytest.raises(AudioUnderstandingError):
        await tool._poll_transcription_result("existing-task", 1, "correlation")
    assert all(call.args[3] < 100 for call in tool._dispatch_transcription_progress_event.call_args_list)


@pytest.mark.parametrize("payload", [{"audio_info": {"duration": 1000}},
                                       {"audio_info": {"utterances": [{"text": "   "}]}},
                                       {"result": {"utterances": [{"text": "hello", "speaker": {}}]}}])
def test_empty_or_invalid_content_raises(tool, payload):
    with pytest.raises(AudioUnderstandingError):
        tool._extract_transcribed_text(payload)


async def test_submit_timeout_is_not_retried(tool, monkeypatch):
    calls = []

    def handler(request):
        calls.append(request)
        raise httpx.ReadTimeout("", request=request)

    install_transport(monkeypatch, handler)
    with pytest.raises(AudioUnderstandingError) as caught:
        await tool._submit_transcription_task("https://private.invalid/signed?secret=hidden", "ogg")
    assert len(calls) == 1
    assert caught.value.error_code == "SUBMIT_RESULT_UNKNOWN"
    assert "secret" not in caught.value.message


async def test_failure_does_not_overwrite_existing_transcript(tool, monkeypatch, tmp_path):
    audio = tmp_path / "recording.ogg"
    audio.write_bytes(b"audio")
    transcript = tmp_path / "transcript.md"
    transcript.write_text("Existing valid transcript")
    monkeypatch.setattr(tool, "_initialize_service", lambda: None)
    monkeypatch.setattr(tool, "_get_audio_duration", AsyncMock(return_value=1))
    monkeypatch.setattr("app.tools.audio_understanding.FileService.get_workspace_file_url", AsyncMock(return_value="https://audio.test"))
    monkeypatch.setattr(tool, "_submit_transcription_task", AsyncMock(return_value="existing-task"))
    install_transport(monkeypatch, lambda request: httpx.Response(403, request=request))
    result = await tool.execute(ToolContext(), AudioUnderstandingParams(audio_path="recording.ogg", transcript_filename="transcript.md"))
    assert not result.ok
    assert result.extra_info["asr_task_id"] == "existing-task"
    assert "HTTP 403" in result.content
    assert transcript.read_text() == "Existing valid transcript"
    assert not any(call.args[3] == 100 for call in tool._dispatch_transcription_progress_event.call_args_list)


async def test_completed_progress_only_after_write(tool, monkeypatch, tmp_path):
    (tmp_path / "recording.ogg").write_bytes(b"audio")
    monkeypatch.setattr(tool, "_initialize_service", lambda: None)
    monkeypatch.setattr(tool, "_get_audio_duration", AsyncMock(return_value=1))
    monkeypatch.setattr(tool, "_get_recording_start_time", AsyncMock(return_value="unknown"))
    monkeypatch.setattr("app.tools.audio_understanding.FileService.get_workspace_file_url", AsyncMock(return_value="https://audio.test"))
    monkeypatch.setattr(tool, "_submit_transcription_task", AsyncMock(return_value="existing-task"))
    install_transport(monkeypatch, success_response)
    original = tool._dispatch_transcription_progress_event

    async def progress(*args):
        if args[3] == 100:
            assert "Actual meeting speech" in (tmp_path / "transcript.md").read_text()
        await original(*args)

    monkeypatch.setattr(tool, "_dispatch_transcription_progress_event", progress)
    result = await tool.execute(ToolContext(), AudioUnderstandingParams(audio_path="recording.ogg", transcript_filename="transcript.md"))
    assert result.ok
    assert "Audio transcription completed" in result.content
    assert original.call_args.args[3] == 100


@pytest.mark.parametrize("stage", ["request", "backoff"])
async def test_cancel_stops_request_wait_and_keepalive(tool, monkeypatch, stage):
    interrupt = asyncio.Event()
    entered = asyncio.Event()
    cancelled = asyncio.Event()
    # Keep retrying until the interrupt arrives, so the cancel lands in a request or a retry wait.
    tool.max_query_failures = 1000

    async def handler(request):
        entered.set()
        if stage == "backoff":
            raise httpx.ConnectTimeout("", request=request)
        try:
            await asyncio.sleep(10)
        finally:
            cancelled.set()
        return success_response(request)

    install_transport(monkeypatch, handler)
    context = ToolContext()
    context.register_extension("agent_context", SimpleNamespace(get_interruption_event=lambda: interrupt,
                                                          update_activity_time=lambda: None))
    monkeypatch.setattr(tool, "_initialize_service", lambda: None)
    monkeypatch.setattr(tool, "_run", lambda params, correlation_id: tool._poll_transcription_result("task", 30, correlation_id))
    keepalive = asyncio.create_task(asyncio.sleep(30))
    monkeypatch.setattr("app.tools.audio_understanding.start_tool_keep_alive", lambda ctx: keepalive)
    pending = asyncio.create_task(tool.execute(context, AudioUnderstandingParams(audio_path="recording.ogg", transcript_filename="transcript.md")))
    await entered.wait()
    await asyncio.sleep(0.01)
    interrupt.set()
    with pytest.raises(asyncio.CancelledError):
        await asyncio.wait_for(pending, 0.5)
    await asyncio.sleep(0)
    assert keepalive.cancelled()
    assert not hasattr(tool, "_current_tool_context")
    if stage == "request":
        assert cancelled.is_set()


async def test_processing_until_deadline_returns_unknown(tool, monkeypatch):
    install_transport(monkeypatch, lambda request: httpx.Response(
        200, request=request, headers={"X-Volcengine-Status-Code": "20000001"}, json={}))
    with pytest.raises(AudioUnderstandingError) as caught:
        await asyncio.wait_for(tool._poll_transcription_result("existing-task", 0.02, "correlation"), 0.5)
    assert caught.value.error_code == "QUERY_RESULT_UNKNOWN"
    assert caught.value.task_id == "existing-task"
    assert all(call.args[3] < 100 for call in tool._dispatch_transcription_progress_event.call_args_list)


async def test_rejected_submission_with_request_id_is_failure(tool, monkeypatch):
    install_transport(monkeypatch, lambda request: httpx.Response(
        200, request=request, headers={"X-Volcengine-Status-Code": "45000001"}, json={"request_id": "request-id"}))
    with pytest.raises(AudioUnderstandingError, match="45000001"):
        await tool._submit_transcription_task("https://audio.test", "ogg")


async def test_failure_detail_does_not_expose_internal_error(tool):
    from agentlang.tools.tool_result import ToolResult

    result = ToolResult(ok=False, content="HTTP 403 at internal.example.test with task private-id",
                        extra_info={"error_code": "AUTHENTICATION_FAILED"})
    detail = await tool.get_tool_detail(ToolContext(), result)
    assert detail is not None
    assert detail.data["message"]
    assert "403" not in detail.data["message"]
    assert "internal.example.test" not in detail.data["message"]
    remark = await tool.get_after_tool_call_friendly_action_and_remark("audio_understanding", ToolContext(), result, 0)
    assert remark["remark"] == detail.data["message"]


async def test_write_failure_does_not_send_completed_progress(tool, monkeypatch, tmp_path):
    (tmp_path / "recording.ogg").write_bytes(b"audio")
    monkeypatch.setattr(tool, "_initialize_service", lambda: None)
    monkeypatch.setattr(tool, "_get_audio_duration", AsyncMock(return_value=1))
    monkeypatch.setattr("app.tools.audio_understanding.FileService.get_workspace_file_url", AsyncMock(return_value="https://audio.test"))
    monkeypatch.setattr(tool, "_submit_transcription_task", AsyncMock(return_value="existing-task"))
    monkeypatch.setattr("app.tools.audio_understanding.async_write_text", AsyncMock(side_effect=PermissionError("write denied")))
    install_transport(monkeypatch, success_response)
    result = await tool.execute(ToolContext(), AudioUnderstandingParams(audio_path="recording.ogg", transcript_filename="transcript.md"))
    assert not result.ok
    assert not (tmp_path / "transcript.md").exists()
    assert all(call.args[3] < 100 for call in tool._dispatch_transcription_progress_event.call_args_list)


async def test_invalid_protocol_is_not_retried(tool, monkeypatch):
    calls = []

    def handler(request):
        calls.append(request)
        raise httpx.UnsupportedProtocol("unsupported", request=request)

    install_transport(monkeypatch, handler)
    with pytest.raises(AudioUnderstandingError, match="UnsupportedProtocol"):
        await tool._poll_transcription_result("existing-task", 1, "correlation")
    assert len(calls) == 1


def test_valid_speech_without_duration_is_usable(tool):
    result = tool._extract_transcribed_text({"audio_info": {"duration": None, "utterances": [
        {"text": "Actual speech", "start_time": 0, "speaker": "1"}]}})
    assert "Actual speech" in result.text


@pytest.mark.parametrize("error_code", ["QUERY_RESULT_UNKNOWN", "AUTHENTICATION_FAILED", "SUBMIT_RESULT_UNKNOWN", "ASR_ERROR", "FORMAT_NOT_SUPPORTED"])
async def test_temporary_upload_cleanup_respects_task_outcome(tool, monkeypatch, tmp_path, error_code):
    probe = AudioProbe(path=tmp_path / "converted.wav", container="wav", codec="pcm_s16le", sample_rate=16000,
                       channels=1, bits_per_sample=16, sample_format="s16", duration_seconds=1)
    prepared = PreparedAudio(source=probe, upload=probe, mode=AudioPreparationMode.CANONICAL, temporary=True)
    monkeypatch.setattr(tool, "_resolve_upload_url", AsyncMock(return_value=("https://audio.test", {"object_key": "temporary-object", "platform": "test"})))
    monkeypatch.setattr(tool, "_submit_transcription_task", AsyncMock(return_value="task"))
    monkeypatch.setattr(tool, "_poll_transcription_result", AsyncMock(side_effect=AudioUnderstandingError("failure", error_code, "task")))
    delete = AsyncMock()
    monkeypatch.setattr("app.tools.audio_understanding.FileService.delete_uploaded_object", delete)
    with pytest.raises(AudioUnderstandingError):
        await tool._transcribe_prepared_audio(prepared, 1, "correlation")
    assert delete.await_count == (1 if error_code in {"ASR_ERROR", "FORMAT_NOT_SUPPORTED"} else 0)


async def test_temporary_upload_cleanup_after_success(tool, monkeypatch, tmp_path):
    probe = AudioProbe(path=tmp_path / "converted.wav", container="wav", codec="pcm_s16le", sample_rate=16000,
                       channels=1, bits_per_sample=16, sample_format="s16", duration_seconds=1)
    prepared = PreparedAudio(source=probe, upload=probe, mode=AudioPreparationMode.CANONICAL, temporary=True)
    monkeypatch.setattr(tool, "_resolve_upload_url", AsyncMock(return_value=("https://audio.test", {"object_key": "temporary-object", "platform": "test"})))
    monkeypatch.setattr(tool, "_submit_transcription_task", AsyncMock(return_value="task"))
    transcription = tool._extract_transcribed_text(success_response(httpx.Request("POST", "https://audio.test")).json())
    monkeypatch.setattr(tool, "_poll_transcription_result", AsyncMock(return_value=transcription))
    delete = AsyncMock()
    monkeypatch.setattr("app.tools.audio_understanding.FileService.delete_uploaded_object", delete)
    assert await tool._transcribe_prepared_audio(prepared, 1, "correlation") is transcription
    delete.assert_awaited_once_with("temporary-object", "test")


async def test_canonical_fallback_is_preserved(tool, monkeypatch, tmp_path):
    (tmp_path / "recording.ogg").write_bytes(b"audio")
    monkeypatch.setattr(tool, "_initialize_service", lambda: None)
    monkeypatch.setattr(tool, "_get_audio_duration", AsyncMock(return_value=1))
    monkeypatch.setattr(tool, "_get_recording_start_time", AsyncMock(return_value="unknown"))
    monkeypatch.setattr("app.tools.audio_understanding.FileService.get_workspace_file_url", AsyncMock(return_value="https://audio.test"))
    monkeypatch.setattr(tool, "_submit_transcription_task", AsyncMock(side_effect=["first-task", "second-task"]))
    requests = []

    def handler(request):
        requests.append(request.url.path)
        if len(requests) == 1:
            return httpx.Response(200, headers={"X-Volcengine-Status-Code": "45000151"}, json={}, request=request)
        return success_response(request)

    install_transport(monkeypatch, handler)
    result = await tool.execute(ToolContext(), AudioUnderstandingParams(audio_path="recording.ogg", transcript_filename="transcript.md"))
    assert result.ok
    assert result.extra_info["canonical_fallback_used"]
    assert requests == ["/speech/large-model/query/first-task", "/speech/large-model/query/second-task"]
    assert "Actual meeting speech" in (tmp_path / "transcript.md").read_text()


async def test_timeline_trim_is_preserved_before_completed_progress(tool, monkeypatch, tmp_path):
    (tmp_path / "recording.ogg").write_bytes(b"audio")
    monkeypatch.setattr(tool, "_initialize_service", lambda: None)
    monkeypatch.setattr(tool, "_get_audio_duration", AsyncMock(return_value=1))
    monkeypatch.setattr(tool, "_get_recording_start_time", AsyncMock(return_value="unknown"))
    monkeypatch.setattr("app.tools.audio_understanding.FileService.get_workspace_file_url", AsyncMock(return_value="https://audio.test"))
    monkeypatch.setattr(tool, "_submit_transcription_task", AsyncMock(return_value="task"))
    install_transport(monkeypatch, lambda request: httpx.Response(200, request=request,
        headers={"X-Volcengine-Status-Code": "20000000"}, json={"audio_info": {"duration": 1000, "utterances": [
            {"text": "Valid speech", "start_time": 0, "speaker": "1"},
            {"text": "Invalid tail", "start_time": 100000, "speaker": "1"}]}}))
    result = await tool.execute(ToolContext(), AudioUnderstandingParams(audio_path="recording.ogg", transcript_filename="transcript.md"))
    assert result.ok
    assert result.extra_info["dropped_utterance_count"] == 1
    assert "Invalid tail" not in (tmp_path / "transcript.md").read_text()
    assert "Valid speech" in (tmp_path / "transcript.md").read_text()
    assert tool._dispatch_transcription_progress_event.call_args.args[3] == 100
