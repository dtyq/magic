#!/usr/bin/env python3
"""
持久化环境变量管理

用法：
  python scripts/env.py set KEY VALUE
  python scripts/env.py unset KEY
  python scripts/env.py list
"""
import sys
import json
import re
from pathlib import Path


def _setup_project_root() -> Path:
    """
    向上查找项目根目录，加入 sys.path 并返回根目录路径。
    与 agents/skills/using-cron/scripts/_context.py 保持一致。
    支持标志文件：setup.py（本地开发）、script_runner（PyInstaller 生产）。
    """
    current = Path(__file__).resolve().parent
    markers = {"setup.py", "script_runner"}
    for _ in range(10):
        if any((current / marker).exists() for marker in markers):
            root = str(current)
            if root not in sys.path:
                sys.path.insert(0, root)
            return current
        current = current.parent
    raise RuntimeError("无法定位项目根目录（未找到 setup.py 或 script_runner）")


def get_env_file() -> Path:
    root = _setup_project_root()
    try:
        from app.paths import PathManager as _PM
        if not getattr(_PM, "_initialized", False):
            _PM.set_project_root(root)
    except Exception:
        pass
    from app.paths import PathManager
    return PathManager.get_workspace_dir() / ".magic" / "skills" / ".env"


def cmd_set(key: str, value: str) -> None:
    if not key:
        print(json.dumps({"ok": False, "error": "KEY 不能为空"}, ensure_ascii=False))
        sys.exit(1)

    if not re.match(r'^[A-Za-z_][A-Za-z0-9_]*$', key):
        print(json.dumps({"ok": False, "error": f"KEY 格式不合法: {key}"}, ensure_ascii=False))
        sys.exit(1)

    from dotenv import set_key
    env_file = get_env_file()
    env_file.parent.mkdir(parents=True, exist_ok=True)
    if not env_file.exists():
        env_file.touch()

    set_key(str(env_file), key, value)
    print(json.dumps({"ok": True, "key": key}, ensure_ascii=False))


def cmd_unset(key: str) -> None:
    if not key:
        print(json.dumps({"ok": False, "error": "KEY 不能为空"}, ensure_ascii=False))
        sys.exit(1)

    from dotenv import unset_key, dotenv_values
    env_file = get_env_file()

    if not env_file.exists() or key not in dotenv_values(str(env_file)):
        print(json.dumps({"ok": False, "error": f"KEY 不存在: {key}"}, ensure_ascii=False))
        sys.exit(1)

    unset_key(str(env_file), key)
    print(json.dumps({"ok": True, "key": key}, ensure_ascii=False))


def cmd_list() -> None:
    from dotenv import dotenv_values
    env_file = get_env_file()

    if not env_file.exists():
        print(json.dumps({"ok": True, "keys": []}, ensure_ascii=False))
        return

    def mask(v: str) -> str:
        return v[:4] + "*" * (len(v) - 8) + v[-4:] if len(v) > 8 else "*" * len(v)

    keys = [{"key": k, "value": mask(v) if v else ""} for k, v in dotenv_values(str(env_file)).items()]
    print(json.dumps({"ok": True, "keys": keys}, ensure_ascii=False, indent=2))


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "用法: env.py set KEY VALUE | unset KEY | list"}, ensure_ascii=False))
        sys.exit(1)

    command = sys.argv[1]

    if command == "set":
        if len(sys.argv) != 4:
            print(json.dumps({"ok": False, "error": "用法: env.py set KEY VALUE"}, ensure_ascii=False))
            sys.exit(1)
        cmd_set(sys.argv[2].strip(), sys.argv[3])

    elif command == "unset":
        if len(sys.argv) != 3:
            print(json.dumps({"ok": False, "error": "用法: env.py unset KEY"}, ensure_ascii=False))
            sys.exit(1)
        cmd_unset(sys.argv[2].strip())

    elif command == "list":
        cmd_list()

    else:
        print(json.dumps({"ok": False, "error": f"未知命令: {command}"}, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
