"""ClawHub Provider：clawhub CLI

clawhub 命令特点：
- search <query>   纯文本输出（格式：slug  Name  (score)），不支持 --json
- install <slug>   --dir 是全局选项，需放在子命令前
- inspect <slug>   获取 skill 元数据，尝试 --json 取版本
- 非交互式需加 --no-input
"""
from __future__ import annotations

import asyncio
import os
import re
import tempfile
from pathlib import Path

from agentlang.logger import get_logger
from app.core.skill_utils.providers._cli_base import CliProvider
from app.core.skill_utils.providers.base import (
    FetchedSkill,
    SkillCandidate,
    SkillProviderId,
)
from app.utils.async_file_utils import async_copytree, async_rmtree

logger = get_logger(__name__)


def _clawhub_env() -> dict:
    """clawhub 运行时环境变量。
    沙箱中 /home/node 可能不存在，将 HOME 指向系统临时目录，
    避免 clawhub（Node.js）尝试在不可写路径创建目录而失败。
    """
    env = os.environ.copy()
    if not Path(env.get("HOME", "")).is_dir():
        env["HOME"] = tempfile.gettempdir()
    return env


class ClawHubProvider(CliProvider):
    """ClawHub 来源

    依赖 clawhub CLI，探测不到时自动 disabled。
    search 解析纯文本；install 使用全局 --dir 选项。
    """

    id = SkillProviderId.CLAWHUB
    cli = ["clawhub"]
    fetch_subcmd = ["install"]
    info_subcmd = ["inspect"]
    json_flag = "--json"

    # ── search：clawhub search 输出纯文本，覆盖父类实现 ──────────────────────

    async def search(self, keyword: str, limit: int | None = 10) -> list[SkillCandidate]:
        self._ensure_enabled()
        cmd = self.cli + ["--no-input", "search", keyword]
        logger.debug(f"[clawhub] 执行: {' '.join(cmd)}")
        try:
            proc = await asyncio.wait_for(
                asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=_clawhub_env(),
                ),
                timeout=5,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
        except asyncio.TimeoutError:
            logger.warning("[clawhub] search 超时")
            return []
        except Exception as e:
            logger.warning(f"[clawhub] search 执行失败: {e}")
            return []

        text = stdout.decode(errors="replace")
        return _parse_search_text(text, limit, self.id)

    # ── resolve_latest：clawhub inspect 输出纯文本，覆盖父类实现 ─────────────

    async def resolve_latest(self, ref: SkillCandidate | str) -> str | None:
        self._ensure_enabled()
        skill_id = self._get_id(ref)
        cmd = self.cli + ["--no-input", "inspect", skill_id]
        logger.debug(f"[clawhub] 执行: {' '.join(cmd)}")
        try:
            proc = await asyncio.wait_for(
                asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=_clawhub_env(),
                ),
                timeout=5,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=15)
        except asyncio.TimeoutError:
            logger.warning("[clawhub] inspect 超时")
            return None
        except Exception as e:
            logger.warning(f"[clawhub] inspect 执行失败: {e}")
            return None

        text = stdout.decode(errors="replace")
        # 输出格式：Latest: 1.0.0
        m = re.search(r'^Latest:\s*(\S+)', text, re.MULTILINE)
        if m:
            return m.group(1)
        logger.warning(f"[clawhub] inspect 未找到版本号: {text[:200]!r}")
        return None

    # ── fetch：--dir 是全局选项，需放在子命令前 ─────────────────────────────

    async def _fetch_to_dir(self, skill_id: str, *, version: str | None) -> FetchedSkill:
        tmp_root = Path(tempfile.mkdtemp(prefix="skill_clawhub_"))
        try:
            # clawhub --no-input --workdir <tmpdir> --dir <tmpdir> install <slug>
            # 显式指定 --workdir，避免 fallback 到 ~/.openclaw/openclaw.json 中
            # agents.defaults.workspace（在容器里常被设为 /home/node/...，
            # 在 macOS / 非容器宿主机上根本不可创建，导致 mkdir '/home/node' 失败）。
            cmd = self.cli + [
                "--no-input",
                "--workdir", str(tmp_root),
                "--dir", str(tmp_root),
                "install", "--force", skill_id,
            ]
            if version:
                cmd += ["--version", version]
            logger.info(f"[clawhub] fetch: {' '.join(cmd)}")

            try:
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=_clawhub_env(),
                )
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
            except asyncio.TimeoutError:
                raise RuntimeError("[clawhub] fetch 命令超时")
            except Exception as e:
                raise RuntimeError(f"[clawhub] fetch 命令执行失败: {e}")

            if proc.returncode != 0:
                raise RuntimeError(
                    f"[clawhub] fetch 失败 (exit {proc.returncode}): "
                    f"{stderr.decode(errors='replace')[:500]}"
                )

            # clawhub install 到 <tmpdir>/<slug>/，找 SKILL.md
            skill_root = _find_skill_root(tmp_root)
            if skill_root is None:
                raise FileNotFoundError(
                    f"[clawhub] fetch 后未找到 SKILL.md（目录: {tmp_root}）"
                )

            persist_tmp = Path(tempfile.mkdtemp(prefix="skill_clawhub_"))
            dest = persist_tmp / skill_root.name
            await async_copytree(skill_root, dest)

            resolved_version = version or await self.resolve_latest(skill_id) or "unknown"
            return FetchedSkill(
                local_path=dest,
                version=resolved_version,
                source_url=f"clawhub://{skill_id}",
            )
        except Exception:
            await async_rmtree(tmp_root)
            raise
        else:
            await async_rmtree(tmp_root)


# ── 辅助函数 ──────────────────────────────────────────────────────────────────


def _parse_search_text(text: str, limit: int, provider_id: SkillProviderId) -> list[SkillCandidate]:
    """解析 clawhub search 纯文本输出。

    每行格式：<slug>  <name>  (<score>)
    例：weather  Weather  (4.552)
    """
    items: list[SkillCandidate] = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.match(r'^(\S+)\s{2,}(.*?)\s+\(\d+\.\d+\)\s*$', line)
        if m:
            slug = m.group(1)
            name = m.group(2).strip()
        else:
            # 降级：取第一个 token 作为 slug
            parts = line.split()
            slug = parts[0]
            name = slug
        # 从 name/description 文本中提取版本号（如 v1.0.0）
        version: str | None = None
        vm = re.search(r'\bv(\d+\.\d+(?:\.\d+)*)\b', name)
        if vm:
            version = vm.group(1)
        items.append(SkillCandidate(
            provider=provider_id,
            id=slug,
            name=name,
            description="",
            version=version,
        ))
        if len(items) >= limit:
            break
    return items


def _find_skill_root(base: Path) -> Path | None:
    """在 base 下查找第一个含 SKILL.md 的目录"""
    if not base.exists():
        return None
    for child in base.iterdir():
        if child.is_dir() and (child / "SKILL.md").exists():
            return child
    for skill_md in base.rglob("SKILL.md"):
        return skill_md.parent
    return None
