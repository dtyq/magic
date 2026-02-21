#!/usr/bin/env python3
"""
将已生成的技能包（.zip，由 package_skill 产出）上传到「我的技能库」（独立脚本，可与打包分步执行）。

接口文档
--------
上传端点：POST /api/v1/open-api/sandbox/skills/import-from-agent
鉴权方式：SandboxUserAuthMiddleware（SDK 自动注入）

multipart/form-data 字段：
  file          : zip 包（扩展名一般为 .zip 或历史 .skill）；SDK 内部可复制为临时 .zip 再请求
  source        : 字符串枚举，固定为 "AGENT_CREATED"
  name_i18n     : （可选）JSON 字符串
  description_i18n: （可选）JSON 字符串

用法
----
python scripts/upload_skill.py <path-to.zip>
    [--name-zh 中文名称]
    [--name-en English Name]
    [--max-attempts N]
    [--retry-delay SECONDS]

示例
----
python scripts/upload_skill.py /path/to/my-skill-v1.0.0.zip
python scripts/upload_skill.py ./meeting-minutes-v1.0.0.zip --name-zh "会议纪要" --name-en "Meeting Notes"
python scripts/upload_skill.py ./x.zip --max-attempts 5 --retry-delay 2
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


async def _upload_one_attempt(
    skill_file: Path,
    name_i18n: Optional[dict],
    description_i18n: Optional[dict],
) -> tuple[bool, Optional[str]]:
    """
    单次上传尝试。成功时打印 ok JSON 并返回 (True, None)；失败返回 (False, error_message)。
    """
    try:
        from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk_with_defaults
        from app.infrastructure.sdk.magic_service.parameter.import_skill_from_agent_parameter import (
            ImportSkillFromAgentParameter,
        )
    except ImportError as e:
        return False, f"无法导入 SDK，请确认在项目环境中运行：{e}"

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
        return True, None

    except Exception as e:
        return False, str(e)
    finally:
        if tmp_zip and await asyncio.to_thread(tmp_zip.exists):
            await asyncio.to_thread(tmp_zip.unlink)


async def upload_skill_file(
    skill_file: Path,
    name_i18n: Optional[dict] = None,
    description_i18n: Optional[dict] = None,
    *,
    max_attempts: int = 3,
    retry_base_delay_sec: float = 1.0,
) -> bool:
    """
    将技能 zip 包上传到「我的技能库」，失败时按指数退避重试。

    后端接受 .zip / .skill 等 zip 包；本脚本每次尝试会复制到临时 .zip 再调用 SDK，完成后删除临时文件。
    """
    last_error: Optional[str] = None

    for attempt in range(1, max_attempts + 1):
        ok, err = await _upload_one_attempt(skill_file, name_i18n, description_i18n)
        if ok:
            return True
        last_error = err or "unknown error"

        # ImportError 等环境错误：第一次就失败，不重试
        if attempt == 1 and err and err.startswith("无法导入 SDK"):
            print(json.dumps({"status": "error", "error": last_error}, ensure_ascii=False))
            return False

        if attempt < max_attempts:
            delay = retry_base_delay_sec * (2 ** (attempt - 1))
            print(
                f"Upload attempt {attempt}/{max_attempts} failed: {last_error}. "
                f"Retrying in {delay:.1f}s...",
                file=sys.stderr,
            )
            await asyncio.sleep(delay)

    print(json.dumps({"status": "error", "error": last_error}, ensure_ascii=False))
    return False


async def _main() -> None:
    parser = argparse.ArgumentParser(
        description="将技能 zip 包上传到「我的技能库」",
    )
    parser.add_argument("skill_file", help="已打包的 .zip 文件路径（或与 zip 内容相同的历史 .skill）")
    parser.add_argument("--name-zh", default=None, metavar="NAME",
                        help="上传时覆盖技能中文名称（可选）")
    parser.add_argument("--name-en", default=None, metavar="NAME",
                        help="上传时覆盖技能英文名称（可选）")
    parser.add_argument(
        "--max-attempts",
        type=int,
        default=3,
        metavar="N",
        help="最大尝试次数（含首次），默认 3",
    )
    parser.add_argument(
        "--retry-delay",
        type=float,
        default=1.0,
        metavar="SECONDS",
        help="重试前等待时间的基数（秒），实际为指数退避：基数×2^(k-1)，默认 1.0",
    )
    args = parser.parse_args()

    if args.max_attempts < 1:
        print("Error: --max-attempts must be >= 1", file=sys.stderr)
        sys.exit(1)
    if args.retry_delay < 0:
        print("Error: --retry-delay must be >= 0", file=sys.stderr)
        sys.exit(1)

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

    ok = await upload_skill_file(
        skill_file,
        name_i18n=name_i18n,
        max_attempts=args.max_attempts,
        retry_base_delay_sec=args.retry_delay,
    )
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    asyncio.run(_main())
