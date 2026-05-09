"""MagicMarket Provider：从 Magic 自有技能市场检索并安装 skill（SDK）"""
from __future__ import annotations

import asyncio
from pathlib import Path

from agentlang.logger import get_logger
from app.core.skill_utils.providers.base import (
    FetchedSkill,
    SkillCandidate,
    SkillProvider,
    SkillProviderId,
)

logger = get_logger(__name__)


class MagicMarketProvider(SkillProvider):
    """Magic 自有技能市场来源（通过 magic_service SDK 访问，原 market）"""

    id = SkillProviderId.MAGIC_MARKET

    async def search(self, keyword: str, limit: int = 10) -> list[SkillCandidate]:
        try:
            from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk_with_defaults
            from app.infrastructure.sdk.magic_service.parameter.query_skills_parameter import (
                QuerySkillsParameter,
            )

            sdk = create_magic_service_sdk_with_defaults()
            result = await asyncio.to_thread(
                sdk.skill.query_skill_market,
                QuerySkillsParameter(keyword=keyword, page=1, page_size=limit),
            )
            items = result.get_items()
            return [
                SkillCandidate(
                    provider=self.id,
                    id=item.code,
                    name=item.package_name or item.name or item.code,
                    description=item.description or "",
                    version=getattr(item, "version", None),
                    extra={
                        "file_url": getattr(item, "file_url", None),
                        "package_name": item.package_name or None,
                    },
                )
                for item in items
                if item.code
                and getattr(item, "publisher_type", None) != "OFFICIAL_BUILTIN"
            ]
        except Exception as e:
            logger.warning(f"[magic_market] search 失败: {e}")
            return []

    async def fetch(
        self,
        ref: SkillCandidate | str,
        *,
        version: str | None = None,
    ) -> FetchedSkill:
        skill_code = self._get_id(ref)

        if isinstance(ref, SkillCandidate) and ref.extra.get("file_url"):
            file_url = ref.extra["file_url"]
            install_name = ref.extra.get("package_name") or ref.name or skill_code
            item_version = ref.version or version
        else:
            file_url, install_name, item_version = await self._resolve_download_url(skill_code)
            item_version = item_version or version

        return await self._download_zip(file_url, install_name, skill_code, version=item_version)

    async def resolve_latest(self, ref: SkillCandidate | str) -> str | None:
        skill_code = self._get_id(ref)
        try:
            from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk_with_defaults
            from app.infrastructure.sdk.magic_service.parameter.query_skills_parameter import (
                QuerySkillsParameter,
            )

            sdk = create_magic_service_sdk_with_defaults()
            result = await asyncio.to_thread(
                sdk.skill.query_skill_market,
                QuerySkillsParameter(page=1, page_size=50, codes=[skill_code]),
            )
            items = result.get_items()
            item = next((i for i in items if i.code == skill_code), None)
            if item:
                return getattr(item, "version", None)
        except Exception as e:
            logger.warning(f"[magic_market] resolve_latest 失败: {e}")
        return None

    # ── 内部辅助 ──────────────────────────────────────────────────────────────

    async def _resolve_download_url(self, skill_code: str) -> tuple[str, str, str | None]:
        from app.infrastructure.sdk.magic_service.factory import create_magic_service_sdk_with_defaults
        from app.infrastructure.sdk.magic_service.parameter.query_skills_parameter import (
            QuerySkillsParameter,
        )

        sdk = create_magic_service_sdk_with_defaults()
        result = await asyncio.to_thread(
            sdk.skill.query_skill_market,
            QuerySkillsParameter(page=1, page_size=50, codes=[skill_code]),
        )
        items = result.get_items()
        item = next((i for i in items if i.code == skill_code), None)
        if item is None:
            raise FileNotFoundError(f"[magic_market] 技能市场未找到 code='{skill_code}' 的技能")
        if not item.file_url:
            raise ValueError(f"[magic_market] 技能 '{skill_code}' 暂无可用下载链接")

        install_name = item.package_name or item.name or item.code
        item_version = getattr(item, "version", None) or None
        return item.file_url, install_name, item_version

    async def _download_zip(self, file_url: str, install_name: str, skill_code: str, version: str | None = None) -> FetchedSkill:
        import tempfile
        from app.core.skill_utils.skillhub import _download_zip_and_install, _find_skill_root
        from app.utils.async_file_utils import async_copytree, async_rmtree

        tmp_dir = Path(tempfile.mkdtemp(prefix="skill_magic_market_"))
        install_dir = tmp_dir / install_name
        try:
            await asyncio.to_thread(_download_zip_and_install, file_url, install_dir)
            skill_root = _find_skill_root(install_dir) or install_dir
            persist_tmp = Path(tempfile.mkdtemp(prefix="skill_magic_market_persist_"))
            dest = persist_tmp / skill_root.name
            await async_copytree(skill_root, dest)
            return FetchedSkill(
                local_path=dest,
                version=version or "unknown",
                source_url=file_url.split("?")[0],
                install_name=install_name,
            )
        except Exception as e:
            if not isinstance(e, RuntimeError):
                raise RuntimeError(f"[magic_market] 下载安装失败 '{skill_code}': {e}") from e
            raise
        finally:
            await async_rmtree(tmp_dir)
