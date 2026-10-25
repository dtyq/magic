#!/usr/bin/env python3
"""
Package a skill directory as a .zip file; optionally call upload_skill.py after packaging.

Package only (default):
    python scripts/package_skill.py <skill-dir> [output-dir] [--version 1.0.0]

Package and upload (internally runs upload_skill.py):
    python scripts/package_skill.py <skill-dir> [output-dir] --version 1.0.0 --upload

Upload an already generated .zip later:
    python scripts/upload_skill.py <path-to.zip>

See upload_skill.py for upload API notes.
"""

from __future__ import annotations

import argparse
import asyncio
import fnmatch
import sys
import zipfile
from pathlib import Path
from typing import Optional

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from quick_validate import validate_skill

# ---------------------------------------------------------------------------
# Packaging config
# ---------------------------------------------------------------------------

# Exclude directories with these names at any depth.
EXCLUDE_DIRS = {"__pycache__", "node_modules"}
EXCLUDE_GLOBS = {"*.pyc"}
EXCLUDE_FILES = {".DS_Store"}
# Exclude these directories only at the skill root's first child level.
ROOT_EXCLUDE_DIRS = {"evals"}

# Package filename suffix; zip format matches the backend import contract.
PACKAGE_FILE_SUFFIX = ".zip"


def should_exclude(rel_path: Path) -> bool:
    """Return whether a relative path should be excluded from the package."""
    parts = rel_path.parts
    if any(part in EXCLUDE_DIRS for part in parts):
        return True
    # parts[0] is the skill folder name; parts[1] is its first child directory.
    if len(parts) > 1 and parts[1] in ROOT_EXCLUDE_DIRS:
        return True
    name = rel_path.name
    if name in EXCLUDE_FILES:
        return True
    return any(fnmatch.fnmatch(name, pat) for pat in EXCLUDE_GLOBS)


# ---------------------------------------------------------------------------
# Packaging
# ---------------------------------------------------------------------------

async def package_skill(
    skill_path,
    output_dir=None,
    version: Optional[str] = None,
) -> Optional[Path]:
    """
    Package a skill directory as a .zip file.

    Args:
        skill_path: Skill directory path.
        output_dir: Output directory; defaults to the current working directory.
        version: Version string such as "1.0.0"; when provided, filename becomes <name>-v<version>.zip.

    Returns:
        The .zip file path on success, otherwise None.
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
        # Default output sits next to the skill folder.
        output_path = skill_path.parent

    # Add -v<version> to the filename when a version is provided.
    filename_stem = f"{skill_name}-v{version}" if version else skill_name
    skill_filename = output_path / f"{filename_stem}{PACKAGE_FILE_SUFFIX}"

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
        print(f"Error creating package file: {e}")
        return None


# ---------------------------------------------------------------------------
# Invoke the standalone upload script after packaging when requested.
# ---------------------------------------------------------------------------

async def _run_upload_script(
    skill_file: Path,
    name_zh: Optional[str],
    name_en: Optional[str],
) -> int:
    """Run scripts/upload_skill.py as an async subprocess and return its exit code."""
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
# Entry point
# ---------------------------------------------------------------------------

async def _main():
    parser = argparse.ArgumentParser(
        description="Package a skill directory as a .zip file; add --upload to call upload_skill.py afterwards",
    )
    parser.add_argument("skill_path", help="Skill directory path")
    parser.add_argument("output_dir", nargs="?", default=None, help="Output directory; defaults to the current working directory")
    parser.add_argument("--version", default=None, metavar="VERSION",
                        help="Version such as 1.0.0; filename becomes <name>-v<version>.zip")
    parser.add_argument("--upload", dest="upload", action="store_true",
                        help="Call upload_skill.py after successful packaging")
    parser.add_argument("--no-upload", dest="upload", action="store_false",
                        help="Package only without upload; this is the default")
    parser.set_defaults(upload=False)
    parser.add_argument("--name-zh", default=None, metavar="NAME",
                        help="Forward to upload_skill.py to override the Chinese display name")
    parser.add_argument("--name-en", default=None, metavar="NAME",
                        help="Forward to upload_skill.py to override the English display name")
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
