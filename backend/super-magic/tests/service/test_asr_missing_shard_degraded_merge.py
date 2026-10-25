import importlib.util
import json
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

from app.service.asr.asr_merge_task_manager import (
    AsrMergeTaskManager,
    AsrTaskStatus,
    classify_missing_for_silence_fill,
)
from app.service.asr.asr_opus_finish_processor import AsrOpusFinishProcessor
from app.service.asr.asr_opus_merge_operations import (
    AsrOpusMergeOperations,
    SilenceFillParams,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def test_single_middle_gap_is_approved_for_short_recording():
    accepted, missing, reason = classify_missing_for_silence_fill(
        [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11], 12, 3, 0.05
    )

    assert (accepted, missing, reason) == (True, [3], "silence_fill")


def test_single_tail_gap_is_approved():
    accepted, missing, reason = classify_missing_for_silence_fill(
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 12, 3, 0.05
    )

    assert (accepted, missing, reason) == (True, [11], "silence_fill")


def test_multi_tail_gap_within_ratio_is_approved():
    accepted, missing, reason = classify_missing_for_silence_fill(
        list(range(98)), 100, 3, 0.05
    )

    assert (accepted, missing, reason) == (True, [98, 99], "silence_fill")


def test_mixed_middle_and_tail_gap_share_one_budget():
    accepted, missing, reason = classify_missing_for_silence_fill(
        [index for index in range(100) if index not in {50, 99}], 100, 3, 0.05
    )

    assert (accepted, missing, reason) == (True, [50, 99], "silence_fill")


def test_multi_gap_over_ratio_is_rejected():
    accepted, missing, reason = classify_missing_for_silence_fill(
        [0, 1, 2, 4, 5, 6, 7, 8, 9, 11], 12, 3, 0.05
    )

    assert (accepted, missing, reason) == (False, [3, 10], "missing_ratio_exceeded")


def test_too_many_missing_shards_is_rejected():
    accepted, missing, reason = classify_missing_for_silence_fill(
        [index for index in range(100) if index not in {1, 2, 3, 4}], 100, 3, 0.05
    )

    assert (accepted, missing, reason) == (False, [1, 2, 3, 4], "too_many_missing")


async def test_plain_finish_does_not_retry_failed_task(monkeypatch):
    module_path = PROJECT_ROOT / "app" / "api" / "routes" / "asr.py"
    spec = importlib.util.spec_from_file_location("asr_routes_no_automatic_retry", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    task = AsrMergeTaskManager._create_task_result(
        task_key="failed-task",
        source_dir="/tmp/source",
        status=AsrTaskStatus.ERROR,
    ).model_copy(update={"error_message": "finish 等待分片超时"})

    class FakeManager:
        retry_requested = False

        async def get_task(self, task_key):
            return task

        async def request_retry(self, *args, **kwargs):
            self.retry_requested = True
            return True, 1, 10

    manager = FakeManager()
    monkeypatch.setattr(
        module.AsrMergeTaskManager,
        "instance",
        classmethod(lambda cls: manager),
    )

    error_response, existing_task = await module._get_task_and_check_completed_or_error(
        "failed-task", allow_error_retry=True, force_reset=False
    )

    assert error_response is not None
    assert existing_task is None
    assert manager.retry_requested is False


def _use_tmp_state_dir(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(
        AsrMergeTaskManager,
        "get_state_file_path",
        staticmethod(lambda task_key: tmp_path / f"{task_key}.json"),
    )


async def _create_finished_opus_task(
    manager: AsrMergeTaskManager,
    task_key: str,
    source_dir: Path,
    declared_count: int,
) -> None:
    await manager.create_task(task_key=task_key, source_dir=str(source_dir))
    await manager.set_audio_format(task_key, "opus")
    await manager.mark_upload_completed(task_key, declared_count)


async def test_middle_gap_is_approved_only_after_finish_deadline(monkeypatch, tmp_path):
    _use_tmp_state_dir(monkeypatch, tmp_path)
    manager = AsrMergeTaskManager()
    source_dir = tmp_path / "recording"
    source_dir.mkdir()
    files = []
    for index in (*range(50), *range(51, 101)):
        shard = source_dir / f"{index}.opus"
        shard.write_bytes(b"opus")
        files.append((index, shard))

    await _create_finished_opus_task(manager, "middle-gap", source_dir, 101)

    ready, terminal_failed = await manager.update_finish_shard_stability("middle-gap", files)

    assert (ready, terminal_failed) == (False, False)

    await manager._atomic_update_state(
        "middle-gap",
        lambda state: manager._apply_state_updates(
            state,
            progress_updates={"completion_deadline_at": datetime.now().timestamp() - 1},
        ),
        "expire deadline",
    )

    ready, terminal_failed = await manager.update_finish_shard_stability("middle-gap", files)

    assert (ready, terminal_failed) == (True, False)
    progress = await manager.get_progress("middle-gap")
    assert progress.finish_completion_mode == "silence_fill"
    assert progress.accepted_missing_shard_indices == [50]


async def test_tail_gap_is_filled_with_silence_after_finish_deadline(monkeypatch, tmp_path):
    _use_tmp_state_dir(monkeypatch, tmp_path)
    manager = AsrMergeTaskManager()
    source_dir = tmp_path / "recording-tail"
    source_dir.mkdir()
    files = []
    for index in range(11):
        shard = source_dir / f"{index}.opus"
        shard.write_bytes(b"opus")
        files.append((index, shard))

    await _create_finished_opus_task(manager, "tail-gap", source_dir, 12)
    await manager._atomic_update_state(
        "tail-gap",
        lambda state: manager._apply_state_updates(
            state,
            progress_updates={"completion_deadline_at": datetime.now().timestamp() - 1},
        ),
        "expire deadline",
    )

    ready, terminal_failed = await manager.update_finish_shard_stability("tail-gap", files)

    assert (ready, terminal_failed) == (True, False)
    progress = await manager.get_progress("tail-gap")
    assert progress.finish_completion_mode == "silence_fill"
    assert progress.accepted_missing_shard_indices == [11]


async def test_wav_task_keeps_tail_truncation_convergence(monkeypatch, tmp_path):
    _use_tmp_state_dir(monkeypatch, tmp_path)
    manager = AsrMergeTaskManager()
    source_dir = tmp_path / "recording-wav"
    source_dir.mkdir()
    files = []
    for index in range(10):
        shard = source_dir / f"{index}.wav"
        shard.write_bytes(b"wav")
        files.append((index, shard))

    await manager.create_task(task_key="wav-tail", source_dir=str(source_dir))
    await manager.set_audio_format("wav-tail", "wav")
    await manager.mark_upload_completed("wav-tail", 12)
    await manager._atomic_update_state(
        "wav-tail",
        lambda state: manager._apply_state_updates(
            state,
            progress_updates={"completion_deadline_at": datetime.now().timestamp() - 1},
        ),
        "expire deadline",
    )

    ready, terminal_failed = await manager.update_finish_shard_stability("wav-tail", files)

    assert (ready, terminal_failed) == (True, False)
    progress = await manager.get_progress("wav-tail")
    assert progress.finish_completion_mode == "tail_missing_convergence"
    assert progress.accepted_missing_shard_indices == [10, 11]


async def test_opus_gap_over_ratio_fails_terminally(monkeypatch, tmp_path):
    _use_tmp_state_dir(monkeypatch, tmp_path)
    manager = AsrMergeTaskManager()
    source_dir = tmp_path / "recording-over-ratio"
    source_dir.mkdir()
    files = []
    for index in (0, 1, 2, 4, 5, 6, 7, 8, 9, 11):
        shard = source_dir / f"{index}.opus"
        shard.write_bytes(b"opus")
        files.append((index, shard))

    await _create_finished_opus_task(manager, "over-ratio", source_dir, 12)
    await manager._atomic_update_state(
        "over-ratio",
        lambda state: manager._apply_state_updates(
            state,
            progress_updates={"completion_deadline_at": datetime.now().timestamp() - 1},
        ),
        "expire deadline",
    )

    ready, terminal_failed = await manager.update_finish_shard_stability("over-ratio", files)

    assert (ready, terminal_failed) == (False, True)
    task = await manager.get_task("over-ratio")
    assert task.status == AsrTaskStatus.ERROR.value
    assert "missing_ratio_exceeded" in task.error_message


async def test_legacy_task_does_not_guess_middle_gap_range(monkeypatch, tmp_path):
    _use_tmp_state_dir(monkeypatch, tmp_path)
    manager = AsrMergeTaskManager()
    source_dir = tmp_path / "legacy-recording"
    source_dir.mkdir()
    files = []
    for index in (*range(50), *range(51, 101)):
        shard = source_dir / f"{index}.opus"
        shard.write_bytes(b"opus")
        files.append((index, shard))

    await manager.create_task(task_key="legacy-middle-gap", source_dir=str(source_dir))
    await manager.set_audio_format("legacy-middle-gap", "opus")
    await manager.mark_upload_completed("legacy-middle-gap")
    await manager._atomic_update_state(
        "legacy-middle-gap",
        lambda state: manager._apply_state_updates(
            state,
            progress_updates={"completion_deadline_at": datetime.now().timestamp() - 1},
        ),
        "expire deadline",
    )

    ready, terminal_failed = await manager.update_finish_shard_stability(
        "legacy-middle-gap", files
    )

    assert (ready, terminal_failed) == (False, True)
    progress = await manager.get_progress("legacy-middle-gap")
    assert progress.finish_completion_mode is None
    assert progress.accepted_missing_shard_indices == []


def test_task_response_exposes_degraded_merge_result():
    module_path = PROJECT_ROOT / "app" / "api" / "routes" / "asr.py"
    spec = importlib.util.spec_from_file_location("asr_routes_degraded_response", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    now = datetime.now()
    task = AsrMergeTaskManager._create_task_result(
        task_key="degraded-response",
        source_dir="/tmp/source",
        status=AsrTaskStatus.COMPLETED,
    ).model_copy(
        update={
            "degraded": True,
            "completion_mode": "silence_fill",
            "missing_shard_indices": [2],
            "created_at": now,
            "updated_at": now,
        }
    )

    response = module._build_task_response(task)

    assert response.degraded is True
    assert response.completion_mode == "silence_fill"
    assert response.missing_shard_indices == [2]


async def test_build_merge_inputs_inserts_silence_using_neighbor_median(monkeypatch, tmp_path):
    operations = AsrOpusMergeOperations(file_detector=object())
    local_files = {
        0: tmp_path / "0.opus",
        1: tmp_path / "1.opus",
        3: tmp_path / "3.opus",
        4: tmp_path / "4.opus",
    }
    durations = {0: 4.8, 1: 5.0, 3: 5.2, 4: 9.0}

    async def fake_duration(path: Path) -> float:
        return durations[int(path.stem)]

    generated: list[tuple[Path, float]] = []

    async def fake_generate(path: Path, duration: float, params=None) -> None:
        generated.append((path, duration))

    monkeypatch.setattr(operations, "_get_audio_duration", fake_duration)
    monkeypatch.setattr(operations, "_generate_silence_opus", fake_generate)

    inputs, synthetic = await operations._build_merge_inputs(
        task_key="merge-plan",
        local_files=local_files,
        expected_shard_count=5,
        missing_indices=[2],
        synthetic_dir=tmp_path,
        attempt_id="attempt",
    )

    assert [item.index for item in inputs] == [0, 1, 2, 3, 4]
    assert [item.synthetic for item in inputs] == [False, False, True, False, False]
    assert inputs[2].duration_ms == 5100
    assert generated == [(tmp_path / ".synthetic_attempt_2.opus", 5.1)]
    assert synthetic == [tmp_path / ".synthetic_attempt_2.opus"]


async def test_finish_processor_passes_approved_middle_gap_to_merge(monkeypatch, tmp_path):
    progress = SimpleNamespace(
        upload_completed=True,
        opus_merge_status="pending",
        opus_merge_attempt_id="attempt-1",
        finish_completion_mode="silence_fill",
        accepted_missing_shard_indices=[2],
        file_shard_count=5,
        completion_deadline_at=datetime.now().timestamp() - 1,
    )

    class FakeManager:
        async def get_progress(self, task_key):
            return progress

        async def update_finish_shard_stability(self, task_key, all_files):
            return True, False

        async def claim_opus_merge(self, task_key):
            return True

        async def set_opus_merge_status(self, *args, **kwargs):
            captured.setdefault("status_sequence", []).append(args[1] if len(args) > 1 else kwargs.get("status"))
            return True

        async def check_should_complete_opus(self, *args, **kwargs):
            return True

        async def set_degraded_merge_info(self, task_key, completion_mode, missing_indices):
            captured["degraded_result"] = (task_key, completion_mode, missing_indices)
            captured.setdefault("status_sequence", []).append("degraded")
            return True

    captured = {}

    class FakeOperations:
        async def merge_opus_on_finish(self, *args, **kwargs):
            captured.update(kwargs)

    class FakeFinalizer:
        async def complete_task(self, task_key, source_dir):
            return None

    manager = FakeManager()
    monkeypatch.setattr(
        AsrMergeTaskManager,
        "instance",
        classmethod(lambda cls: manager),
    )
    processor = AsrOpusFinishProcessor(FakeOperations(), FakeFinalizer())
    task = SimpleNamespace(task_key="processor", source_dir=tmp_path)

    completed = await processor.process(
        task,
        [(0, tmp_path / "0.opus"), (1, tmp_path / "1.opus"), (3, tmp_path / "3.opus"), (4, tmp_path / "4.opus")],
    )

    assert completed is True
    assert captured["expected_shard_count"] == 5
    assert captured["missing_indices"] == [2]
    assert captured["degraded_result"] == (
        "processor",
        "silence_fill",
        [2],
    )
    assert captured["status_sequence"] == ["degraded", "completed"]


async def test_finish_processor_does_not_complete_when_degraded_result_cannot_be_saved(
    monkeypatch, tmp_path
):
    progress = SimpleNamespace(
        upload_completed=True,
        opus_merge_status="pending",
        opus_merge_attempt_id="attempt-2",
        finish_completion_mode="middle_gap_silence_fill",
        accepted_missing_shard_indices=[2],
        file_shard_count=5,
        completion_deadline_at=datetime.now().timestamp() - 1,
    )
    completed_statuses = []
    finalized = False

    class FakeManager:
        async def get_progress(self, task_key):
            return progress

        async def update_finish_shard_stability(self, task_key, all_files):
            return True, False

        async def claim_opus_merge(self, task_key):
            return True

        async def set_opus_merge_status(self, task_key, status, *args, **kwargs):
            completed_statuses.append(status)
            return True

        async def check_should_complete_opus(self, *args, **kwargs):
            return True

        async def set_degraded_merge_info(self, task_key, completion_mode, missing_indices):
            return False

    class FakeOperations:
        async def merge_opus_on_finish(self, *args, **kwargs):
            return True

    class FakeFinalizer:
        async def complete_task(self, task_key, source_dir):
            nonlocal finalized
            finalized = True

    monkeypatch.setattr(
        AsrMergeTaskManager,
        "instance",
        classmethod(lambda cls: FakeManager()),
    )
    processor = AsrOpusFinishProcessor(FakeOperations(), FakeFinalizer())

    completed = await processor.process(
        SimpleNamespace(task_key="processor-save-failure", source_dir=tmp_path),
        [(0, tmp_path / "0.opus"), (1, tmp_path / "1.opus"), (3, tmp_path / "3.opus"), (4, tmp_path / "4.opus")],
    )

    assert completed is False
    assert "completed" not in completed_statuses
    assert finalized is False


async def test_legacy_middle_gap_counts_synthetic_shard_when_completing(monkeypatch, tmp_path):
    _use_tmp_state_dir(monkeypatch, tmp_path)
    manager = AsrMergeTaskManager()
    source_dir = tmp_path / "legacy"
    source_dir.mkdir()
    await manager.create_task(task_key="legacy-gap", source_dir=str(source_dir))
    await manager.set_audio_format("legacy-gap", "opus")
    await manager.mark_upload_completed("legacy-gap")
    await manager._atomic_update_state(
        "legacy-gap",
        lambda state: manager._apply_state_updates(
            state,
            progress_updates={
                "finish_completion_mode": "middle_gap_silence_fill",
                "accepted_missing_shard_indices": [50],
                "opus_merge_status": "completed",
                "opus_merge_attempt_id": "attempt-legacy",
                "file_count": 101,
                "max_processed_index": 100,
            },
        ),
        "prepare degraded completion",
    )
    (source_dir / "merged.opus").write_bytes(b"o" * 101)
    (source_dir / "merged_metadata.json").write_text(
        json.dumps(
            {
                "audio_format": "opus",
                "merge_attempt_id": "attempt-legacy",
                "source_shard_count": 100,
                "source_last_index": 100,
                "expected_shard_count": 101,
                "degraded": True,
                "completion_mode": "middle_gap_silence_fill",
                "missing_shard_indices": [50],
            }
        )
    )

    assert await manager.check_should_complete_opus("legacy-gap", source_dir, 100) is True


async def test_tail_silence_fill_counts_synthetic_shard_when_completing(monkeypatch, tmp_path):
    _use_tmp_state_dir(monkeypatch, tmp_path)
    manager = AsrMergeTaskManager()
    source_dir = tmp_path / "tail-fill"
    source_dir.mkdir()
    await manager.create_task(task_key="tail-fill", source_dir=str(source_dir))
    await manager.set_audio_format("tail-fill", "opus")
    await manager.mark_upload_completed("tail-fill", 12)
    await manager._atomic_update_state(
        "tail-fill",
        lambda state: manager._apply_state_updates(
            state,
            progress_updates={
                "finish_completion_mode": "silence_fill",
                "accepted_missing_shard_indices": [11],
                "opus_merge_status": "completed",
                "opus_merge_attempt_id": "attempt-tail",
                "file_count": 12,
                "max_processed_index": 11,
            },
        ),
        "prepare tail fill completion",
    )
    (source_dir / "merged.opus").write_bytes(b"o" * 101)
    (source_dir / "merged_metadata.json").write_text(
        json.dumps(
            {
                "audio_format": "opus",
                "merge_attempt_id": "attempt-tail",
                "source_shard_count": 11,
                "source_last_index": 11,
                "expected_shard_count": 12,
                "degraded": True,
                "completion_mode": "silence_fill",
                "missing_shard_indices": [11],
            }
        )
    )

    assert await manager.check_should_complete_opus("tail-fill", source_dir, 11) is True


async def test_probe_neighbor_fill_params_prefers_previous_shard(tmp_path):
    probed: list[Path] = []

    class FakeDetector:
        async def probe_audio_file(self, path: Path) -> dict:
            probed.append(path)
            return {
                "codec_name": "opus",
                "sample_rate": 48000,
                "channels": 1,
                "bit_rate": 64000,
            }

    operations = AsrOpusMergeOperations(file_detector=FakeDetector())
    local_files = {index: tmp_path / f"{index}.opus" for index in (0, 1, 3, 4)}

    params = await operations._probe_neighbor_fill_params("task", local_files, 2, 5)

    assert probed == [tmp_path / "1.opus"]
    assert params == SilenceFillParams(sample_rate=48000, channels=1, bitrate="64k")


async def test_probe_neighbor_fill_params_falls_back_when_probe_fails(tmp_path):
    class FailingDetector:
        async def probe_audio_file(self, path: Path) -> dict:
            raise ValueError("ffprobe failed")

    operations = AsrOpusMergeOperations(file_detector=FailingDetector())
    local_files = {0: tmp_path / "0.opus", 2: tmp_path / "2.opus"}

    params = await operations._probe_neighbor_fill_params("task", local_files, 1, 3)

    assert params == SilenceFillParams()
    assert params.effective_bitrate()


async def test_generate_silence_opus_uses_probed_params(monkeypatch, tmp_path):
    operations = AsrOpusMergeOperations(file_detector=object())
    captured: list[list[str]] = []

    async def fake_run_ffmpeg(cmd: list[str]) -> None:
        captured.append(cmd)

    async def fake_chmod(path, mode) -> None:
        return None

    monkeypatch.setattr(operations, "_run_ffmpeg", fake_run_ffmpeg)
    monkeypatch.setattr(
        "app.service.asr.asr_opus_merge_operations.async_chmod", fake_chmod
    )

    output = tmp_path / ".synthetic_attempt_2.opus"
    await operations._generate_silence_opus(
        output, 5.0, SilenceFillParams(sample_rate=48000, channels=1, bitrate="64k")
    )

    cmd = captured[0]
    assert "anullsrc=r=48000:cl=mono" in cmd
    assert cmd[cmd.index("-b:a") + 1] == "64k"


async def test_generate_silence_opus_defaults_without_params(monkeypatch, tmp_path):
    operations = AsrOpusMergeOperations(file_detector=object())
    captured: list[list[str]] = []

    async def fake_run_ffmpeg(cmd: list[str]) -> None:
        captured.append(cmd)

    async def fake_chmod(path, mode) -> None:
        return None

    monkeypatch.setattr(operations, "_run_ffmpeg", fake_run_ffmpeg)
    monkeypatch.setattr(
        "app.service.asr.asr_opus_merge_operations.async_chmod", fake_chmod
    )

    await operations._generate_silence_opus(tmp_path / "s.opus", 5.0)

    cmd = captured[0]
    assert "anullsrc=r=16000:cl=mono" in cmd
