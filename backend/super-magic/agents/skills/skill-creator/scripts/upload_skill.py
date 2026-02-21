#!/usr/bin/env python3
"""
将已生成的 .skill 文件上传到「我的技能库」（独立脚本，可与打包分步执行）。

接口文档
--------
上传端点：POST /api/v1/open-api/sandbox/skills/import-from-agent
鉴权方式：SandboxUserAuthMiddleware（SDK 自动注入）

multipart/form-data 字段：
  file          : .skill 文件（zip 格式）；上传时 SDK 内部自动创建临时 .zip 副本
  source        : 字符串枚举，固定为 "AGENT_CREATED"
  name_i18n     : （可选）JSON 字符串
  description_i18n: （可选）JSON 字符串

用法
----
python scripts/upload_skill.py <path-to.skill>
    [--name-zh 中文名称]
    [--name-en English Name]

示例
----
python scripts/upload_skill.py /path/to/my-skill-v1.0.0.skill
python scripts/upload_skill.py ./meeting-minutes-v1.0.0.skill --name-zh "会议纪要" --name-en "Meeting Notes"
"""

from __future__ import annotations

import argparse
import asyncio
import json
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Optional

import _skill_scripts_bootstrap  # noqa: F401


async def upload_skill_file(
    skill_file: Path,
    name_i18n: Optional[dict] = None,
    description_i18n: Optional[dict] = None,
) -> bool:
    """
    将 .skill 文件上传到「我的技能库」。

    API 要求上传文件后缀为 .zip；.skill 本身即 zip 格式，
    此函数在系统临时目录创建一个 .zip 副本后上传，完成后自动删除。
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
        with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as f:
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


async def _main() -> None:
    parser = argparse.ArgumentParser(
        description="将 .skill 文件上传到「我的技能库」",
    )
    parser.add_argument("skill_file", help="已打包的 .skill 文件路径")
    parser.add_argument("--name-zh", default=None, metavar="NAME",
                        help="上传时覆盖技能中文名称（可选）")
    parser.add_argument("--name-en", default=None, metavar="NAME",
                        help="上传时覆盖技能英文名称（可选）")
    args = parser.parse_args()

    skill_file = Path(args.skill_file).resolve()
    if not await asyncio.to_thread(skill_file.exists):
        print(f"Error: File not found: {skill_file}")
        sys.exit(1)
    if not await asyncio.to_thread(skill_file.is_file):
        print(f"Error: Not a file: {skill_file}")
        sys.exit(1)

    print(f"Uploading: {skill_file}\n")

    name_i18n: Optional[dict] = None
    if args.name_zh or args.name_en:
        name_i18n = {}
        if args.name_zh:
            name_i18n["zh_CN"] = args.name_zh
        if args.name_en:
            name_i18n["en_US"] = args.name_en

    ok = await upload_skill_file(skill_file, name_i18n=name_i18n)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    asyncio.run(_main())
