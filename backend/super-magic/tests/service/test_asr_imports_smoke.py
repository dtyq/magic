"""ASR 改动模块导入冒烟测试（绕过 app.api.routes 包级 __init__ 的重依赖链）"""
import importlib.util
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def test_service_modules_import():
    import app.service.asr.asr_local_proxy
    import app.service.asr.asr_merge_service
    import app.service.asr.asr_merge_task_manager
    import app.service.asr.asr_opus_merge_operations
    import app.service.asr.asr_task_finalizer  # noqa: F401
    import app.service.asr.asr_wav_merge_operations  # noqa: F401


def test_routes_asr_module_imports():
    module_path = PROJECT_ROOT / "app" / "api" / "routes" / "asr.py"
    spec = importlib.util.spec_from_file_location("asr_routes_under_test", module_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert hasattr(mod, "create_asr_task")
    assert hasattr(mod, "finish_asr_task")
