"""SkillHub Provider：外部社区 SkillHub（CLI 子进程）

skillhub 命令特点：
- --dir 是全局选项，须放在子命令前：skillhub --dir <dir> install <slug>
- search <query>   JSON 输出
- info <slug>      JSON 输出，含版本信息
"""
from __future__ import annotations

import asyncio
import json
import tempfile
from pathlib import Path

from agentlang.logger import get_logger
from app.core.skill_utils.providers._cli_base import CliProvider
from app.core.skill_utils.providers.base import FetchedSkill, SkillProviderId
from app.utils.async_file_utils import async_copytree, async_rmtree

logger = get_logger(__name__)


class SkillHubProvider(CliProvider):
    """SkillHub 外部社区来源（作为 Provider 接入，不再是内部实现入口）

    依赖 skillhub CLI，探测不到时自动 disabled。
    --dir 为全局选项，须放在子命令前。
    """

    id = SkillProviderId.SKILLHUB
    cli = ["skillhub"]
    search_subcmd = ["search"]
    fetch_subcmd = ["install"]
    info_subcmd = ["info"]
    json_flag = "--json"
    dir_flag = "--dir"

    # ── fetch：--dir 是全局选项，需放在子命令前 ─────────────────────────────

    async def _fetch_to_dir(self, skill_id: str, *, version: str | None) -> FetchedSkill:
        tmp_root = Path(tempfile.mkdtemp(prefix="skill_skillhub_"))
        try:
            # skillhub --dir <tmpdir> install <slug>
            cmd = self.cli + ["--dir", str(tmp_root)] + list(self.fetch_subcmd) + [skill_id]
            if version:
                cmd += ["--version", version]
            logger.info(f"[skillhub] fetch: {' '.join(cmd)}")

            try:
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
            except asyncio.TimeoutError:
                raise RuntimeError("[skillhub] fetch 命令超时")
            except Exception as e:
                raise RuntimeError(f"[skillhub] fetch 命令执行失败: {e}")

            if proc.returncode != 0:
                raise RuntimeError(
                    f"[skillhub] fetch 失败 (exit {proc.returncode}): "
                    f"{stderr.decode(errors='replace')[:500]}"
                )

            from app.core.skill_utils.skillhub import _find_skill_root
            skill_root = _find_skill_root(tmp_root)
            if skill_root is None:
                raise FileNotFoundError(
                    f"[skillhub] fetch 后未找到 SKILL.md（目录: {tmp_root}）"
                )

            persist_tmp = Path(tempfile.mkdtemp(prefix="skill_skillhub_"))
            dest = persist_tmp / skill_root.name
            await async_copytree(skill_root, dest)

            # 从安装产物 _meta.json 读取真实版本号
            resolved_version = version or _read_meta_version(dest) or "unknown"
            return FetchedSkill(
                local_path=dest,
                version=resolved_version,
                source_url=f"skillhub://{skill_id}",
            )
        except Exception:
            await async_rmtree(tmp_root)
            raise
        else:
            await async_rmtree(tmp_root)


def _read_meta_version(skill_dir: Path) -> str | None:
    """从 skillhub 安装产物的 _meta.json 读取版本号"""
    meta_file = skill_dir / "_meta.json"
    if not meta_file.exists():
        return None
    try:
        data = json.loads(meta_file.read_text(encoding="utf-8"))
        return data.get("version") or None
    except Exception:
        return None
