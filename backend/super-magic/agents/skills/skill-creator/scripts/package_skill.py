#!/usr/bin/env python3
"""
将 skill 目录打包为 .skill 文件；可选在打包结束后调用 upload_skill.py 上传。

只打包（默认）：
    python scripts/package_skill.py <skill-dir> [output-dir] [--version 1.0.0]

打包并上传（内部会再执行一次 upload_skill.py）：
    python scripts/package_skill.py <skill-dir> [output-dir] --version 1.0.0 --upload

稍后单独上传已生成的 .skill：
    python scripts/upload_skill.py <path-to.skill>

上传接口说明见 upload_skill.py 文档字符串。
"""

from __future__ import annotations

import argparse
import asyncio
import fnmatch
import sys
import zipfile
from pathlib import Path
from typing import Optional

import _skill_scripts_bootstrap  # noqa: F401

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
# 调用独立上传脚本（打包并上传时分步执行）
# ---------------------------------------------------------------------------

async def _run_upload_script(
    skill_file: Path,
    name_zh: Optional[str],
    name_en: Optional[str],
) -> int:
    """异步子进程执行 scripts/upload_skill.py，返回进程退出码。"""
    upload_script = Path(__file__).resolve().parent / "upload_skill.py"
    cmd = [sys.executable, str(upload_script), str(skill_file)]
    if name_zh:
        cmd.extend(["--name-zh", name_zh])
    if name_en:
        cmd.extend(["--name-en", name_en])
    skill_creator_root = Path(__file__).resolve().parent.parent
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=str(skill_creator_root),
    )
    return await proc.wait()


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------

async def _main():
    parser = argparse.ArgumentParser(
        description="将 skill 目录打包为 .skill 文件；加 --upload 时再调用 upload_skill.py 上传",
    )
    parser.add_argument("skill_path", help="skill 目录路径")
    parser.add_argument("output_dir", nargs="?", default=None, help="输出目录（默认为当前工作目录）")
    parser.add_argument("--version", default=None, metavar="VERSION",
                        help="版本号，如 1.0.0；文件名将变为 <name>-v<version>.skill")
    parser.add_argument("--upload", dest="upload", action="store_true",
                        help="打包成功后调用 upload_skill.py 上传到「我的技能库」（默认不调用）")
    parser.add_argument("--no-upload", dest="upload", action="store_false",
                        help="只打包，不上传（默认行为）")
    parser.set_defaults(upload=False)
    parser.add_argument("--name-zh", default=None, metavar="NAME",
                        help="随 --upload 传给 upload_skill.py，覆盖技能中文名称（可选）")
    parser.add_argument("--name-en", default=None, metavar="NAME",
                        help="随 --upload 传给 upload_skill.py，覆盖技能英文名称（可选）")
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

    print("\nInvoking upload_skill.py ...")
    code = await _run_upload_script(skill_file, args.name_zh, args.name_en)
    sys.exit(0 if code == 0 else 1)


if __name__ == "__main__":
    asyncio.run(_main())
