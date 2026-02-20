#!/usr/bin/env python3
"""
将 skill 目录打包为 .skill 文件，并可选地上传到「我的技能库」。

接口文档
--------
上传端点：POST /api/v1/open-api/sandbox/skills/import-from-agent
鉴权方式：SandboxUserAuthMiddleware（SDK 自动注入）

multipart/form-data 字段：
  file          : .skill 文件（zip 格式）；上传时 SDK 内部自动创建临时 .zip 副本
  source        : 字符串枚举，固定为 "AGENT_CREATED"
  name_i18n     : （可选）JSON 字符串，如 '{"zh_CN":"旅行规划","en_US":"Travel Planner"}'
  description_i18n: （可选）JSON 字符串，同上

返回字段（JSON）：
  id        : 技能 ID
  code      : 技能 Code
  name      : 多语言名称（dict）
  is_create : true=新建，false=更新

用法
----
python -m scripts.package_skill <skill-dir> [output-dir]
    [--version 1.0.0]
    [--no-upload]
    [--name-zh 中文名称]
    [--name-en English Name]

示例
----
# 打包并上传（默认行为）
python -m scripts.package_skill skills/travel-planner --version 1.0.0

# 只打包，不上传
python -m scripts.package_skill skills/travel-planner --no-upload

# 打包、上传并指定多语言名称
python -m scripts.package_skill skills/travel-planner \\
    --version 1.0.0 \\
    --name-zh "旅行规划助手" \\
    --name-en "Travel Planner"
"""

import argparse
import asyncio
import fnmatch
import json
import shutil
import sys
import tempfile
import zipfile
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# 项目根目录探测（参照 using-cron/_context.py）
# 必须在 import app.* 之前执行
# ---------------------------------------------------------------------------

def _setup_project_root() -> Path:
    """
    向上查找项目根目录，加入 sys.path 并返回根目录路径。
    支持标志文件：setup.py（本地开发）或 script_runner（PyInstaller 生产环境）。
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


_PROJECT_ROOT = _setup_project_root()

# 确保 PathManager 以正确的根目录初始化（PyInstaller 生产环境下 cwd 可能不是项目根）
try:
    from app.paths import PathManager as _PathManager
    if not _PathManager._initialized:
        _PathManager.set_project_root(_PROJECT_ROOT)
except Exception:
    pass

# 屏蔽 agentlang 初始化时产生的冗余日志
try:
    import io as _io
    _old_stderr = sys.stderr
    sys.stderr = _io.StringIO()
    try:
        import agentlang.config.config  # noqa: F401
        import agentlang.logger          # noqa: F401
    finally:
        sys.stderr = _old_stderr
    from loguru import logger as _loguru_logger
    _loguru_logger.remove()
    _loguru_logger.add(sys.stderr, level="WARNING")
except Exception:
    pass

# ---------------------------------------------------------------------------
# 导入 SDK（项目根已在 sys.path 中）
# ---------------------------------------------------------------------------
from quick_validate import validate_skill  # noqa: E402

# ---------------------------------------------------------------------------
# 打包配置
# ---------------------------------------------------------------------------

# 排除所有层级中包含这些名称的目录
EXCLUDE_DIRS = {"__pycache__", "node_modules"}
EXCLUDE_GLOBS = {"*.pyc"}
EXCLUDE_FILES = {".DS_Store"}
# 仅在 skill 根目录第一层排除的目录
ROOT_EXCLUDE_DIRS = {"evals"}


def should_exclude(rel_path: Path) -> bool:
    """判断路径是否应在打包时排除。"""
    parts = rel_path.parts
    if any(part in EXCLUDE_DIRS for part in parts):
        return True
    # parts[0] = skill 文件夹名，parts[1] = 第一级子目录
    if len(parts) > 1 and parts[1] in ROOT_EXCLUDE_DIRS:
        return True
    name = rel_path.name
    if name in EXCLUDE_FILES:
        return True
    return any(fnmatch.fnmatch(name, pat) for pat in EXCLUDE_GLOBS)


# ---------------------------------------------------------------------------
# 打包
# ---------------------------------------------------------------------------

async def package_skill(
    skill_path,
    output_dir=None,
    version: Optional[str] = None,
) -> Optional[Path]:
    """
    将 skill 目录打包为 .skill 文件。

    Args:
        skill_path: skill 目录路径
        output_dir: 输出目录（默认为当前工作目录）
        version:    版本号字符串，如 "1.0.0"；若提供则文件名为 <name>-v<version>.skill

    Returns:
        打包成功返回 .skill 文件路径，否则返回 None
    """
    skill_path = Path(skill_path).resolve()

    if not await asyncio.to_thread(skill_path.exists):
        print(f"Error: Skill folder not found: {skill_path}")
        return None

    if not await asyncio.to_thread(skill_path.is_dir):
        print(f"Error: Path is not a directory: {skill_path}")
        return None

    skill_md = skill_path / "SKILL.md"
    if not await asyncio.to_thread(skill_md.exists):
        print(f"Error: SKILL.md not found in {skill_path}")
        return None

    print("Validating skill...")
    valid, message = await validate_skill(skill_path)
    if not valid:
        print(f"Validation failed: {message}")
        print("   Please fix the validation errors before packaging.")
        return None
    print(f"{message}\n")

    skill_name = skill_path.name
    if output_dir:
        output_path = Path(output_dir).resolve()
        await asyncio.to_thread(output_path.mkdir, parents=True, exist_ok=True)
    else:
        # 默认输出到 skill 自身目录（工作区内），避免输出到脚本的 cwd
        output_path = skill_path

    # 带版本号时文件名加 -v<version> 后缀
    filename_stem = f"{skill_name}-v{version}" if version else skill_name
    skill_filename = output_path / f"{filename_stem}.skill"

    all_files = await asyncio.to_thread(lambda: list(skill_path.rglob('*')))

    def _create_zip():
        with zipfile.ZipFile(skill_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in all_files:
                if not file_path.is_file():
                    continue
                arcname = file_path.relative_to(skill_path.parent)
                if should_exclude(arcname):
                    print(f"  Skipped: {arcname}")
                    continue
                zipf.write(file_path, arcname)
                print(f"  Added: {arcname}")

    try:
        await asyncio.to_thread(_create_zip)
        print(f"\nSuccessfully packaged skill to: {skill_filename}")
        return skill_filename
    except Exception as e:
        print(f"Error creating .skill file: {e}")
        return None


# ---------------------------------------------------------------------------
# 上传
# ---------------------------------------------------------------------------

async def upload_skill(
    skill_file: Path,
    name_i18n: Optional[dict] = None,
    description_i18n: Optional[dict] = None,
) -> bool:
    """
    将 .skill 文件上传到「我的技能库」。

    API 要求上传文件后缀为 .zip；.skill 本身即 zip 格式，
    此函数在系统临时目录创建一个 .zip 副本后上传，完成后自动删除。

    Args:
        skill_file:       待上传的 .skill 文件路径
        name_i18n:        多语言名称，如 {"zh_CN": "旅行规划", "en_US": "Travel Planner"}
        description_i18n: 多语言描述（可选）

    Returns:
        上传成功返回 True，否则返回 False
    """
    try:
        from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk_with_defaults
        from app.infrastructure.sdk.magic_service.parameter.import_skill_from_agent_parameter import (
            ImportSkillFromAgentParameter,
        )
    except ImportError as e:
        print(f"Error: 无法导入 SDK，请确认在项目环境中运行：{e}")
        return False

    tmp_zip: Optional[Path] = None
    try:
        # 创建临时 .zip 副本（API 校验文件后缀为 .zip）
        with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as f:
            tmp_zip = Path(f.name)
        await asyncio.to_thread(shutil.copy2, skill_file, tmp_zip)

        sdk = create_magic_service_sdk_with_defaults()
        parameter = ImportSkillFromAgentParameter(
            file_path=str(tmp_zip),
            source="AGENT_CREATED",
            name_i18n=name_i18n,
            description_i18n=description_i18n,
        )

        result = await asyncio.to_thread(sdk.skill.import_skill_from_agent, parameter)

        action = "created" if result.is_newly_created() else "updated"
        print(json.dumps({
            "status": "ok",
            "action": action,
            "id": result.get_id(),
            "code": result.get_code(),
            "name": result.get_name(),
        }, ensure_ascii=False))
        return True

    except Exception as e:
        print(json.dumps({"status": "error", "error": str(e)}, ensure_ascii=False))
        return False
    finally:
        if tmp_zip and await asyncio.to_thread(tmp_zip.exists):
            await asyncio.to_thread(tmp_zip.unlink)


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------

async def _main():
    parser = argparse.ArgumentParser(
        description="将 skill 目录打包为 .skill 文件，并可选地上传到「我的技能库」",
    )
    parser.add_argument("skill_path", help="skill 目录路径")
    parser.add_argument("output_dir", nargs="?", default=None, help="输出目录（默认为当前工作目录）")
    parser.add_argument("--version", default=None, metavar="VERSION",
                        help="版本号，如 1.0.0；文件名将变为 <name>-v<version>.skill")
    parser.add_argument("--upload", dest="upload", action="store_true", default=True,
                        help="打包后上传到「我的技能库」（默认启用）")
    parser.add_argument("--no-upload", dest="upload", action="store_false",
                        help="只打包，不上传")
    parser.add_argument("--name-zh", default=None, metavar="NAME",
                        help="上传时覆盖技能中文名称（可选）")
    parser.add_argument("--name-en", default=None, metavar="NAME",
                        help="上传时覆盖技能英文名称（可选）")
    args = parser.parse_args()

    print(f"Packaging skill: {args.skill_path}")
    if args.output_dir:
        print(f"   Output directory: {args.output_dir}")
    if args.version:
        print(f"   Version: {args.version}")
    print()

    skill_file = await package_skill(args.skill_path, args.output_dir, version=args.version)
    if not skill_file:
        sys.exit(1)

    if not args.upload:
        sys.exit(0)

    # 构建可选的多语言名称
    name_i18n: Optional[dict] = None
    if args.name_zh or args.name_en:
        name_i18n = {}
        if args.name_zh:
            name_i18n["zh_CN"] = args.name_zh
        if args.name_en:
            name_i18n["en_US"] = args.name_en

    print("\nUploading to skill library...")
    success = await upload_skill(skill_file, name_i18n=name_i18n)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(_main())
