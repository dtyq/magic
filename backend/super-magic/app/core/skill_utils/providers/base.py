"""Skill Provider 抽象基类

所有来源（my_library / market / skillhub / clawhub / npx / github）
均实现此接口；新增来源只需新建 provider 文件并注册到 registry.py。
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any


class SkillProviderId(str, Enum):
    """Provider 来源枚举——与 install_skills 工具的 provider 参数一一对应"""

    SYSTEM       = "system"        # 内置系统 skill（agents/skills/ 目录）
    MY_LIBRARY   = "my_library"    # 平台「我的技能库」（SDK）
    MAGIC_MARKET = "market"        # Magic 自有技能市场（SDK）
    SKILLHUB     = "skillhub"      # 外部社区 SkillHub（CLI 子进程）
    CLAWHUB      = "clawhub"       # ClawHub 生态（CLI 子进程）
    NPX          = "npx"           # npx skills（CLI 子进程）
    GITHUB       = "github"        # GitHub archive zip


@dataclass
class SkillCandidate:
    """检索结果条目——聚合层统一表示，不依赖具体 provider 结构"""

    provider: SkillProviderId
    id: str               # provider 内唯一标识：code / slug / GitHub URL / package name
    name: str             # SKILL.md 中的 name（无则取 package_name）
    description: str
    version: str | None   # 来源能拿到的版本号；GitHub 用 commit/tag 前 12 位
    score: float = 0.0    # 排序分（由 SearchAggregator 填充，provider 内无需设置）
    extra: dict = field(default_factory=dict)  # 来源特有字段（file_url、stars、author 等）


@dataclass
class FetchedSkill:
    """provider.fetch() 返回值——已下载/拉取到本地临时目录的 skill"""

    local_path: Path            # 解压/拉取后的临时目录（含 SKILL.md）
    version: str                # 实际版本号（SemVer 或 commit sha 前 12 位）
    source_url: str             # 用于写入 manifest，仅记录非签名 URL
    install_name: str | None = None  # 期望的安装目录名（由 provider 填充，优先级高于 SKILL.md name 字段）
    extra: dict = field(default_factory=dict)


class SkillProvider(ABC):
    """Provider 抽象基类

    各来源的具体实现须继承此类并实现全部抽象方法。
    enabled 属性由子类在 __init__ 时按配置+能力探测决定。
    """

    id: SkillProviderId
    enabled: bool = True

    @abstractmethod
    async def search(self, keyword: str, limit: int = 10) -> list[SkillCandidate]:
        """按关键词检索，返回候选列表；不支持搜索的 provider 返回 []。"""

    @abstractmethod
    async def fetch(
        self,
        ref: SkillCandidate | str,
        *,
        version: str | None = None,
    ) -> FetchedSkill:
        """下载/拉取 skill 到本地临时目录，返回 FetchedSkill；失败时抛异常。

        Args:
            ref: SkillCandidate 或 provider 内唯一 ID 字符串。
            version: 指定版本；None 表示最新。
        """

    async def fetch_many(
        self,
        ref: SkillCandidate | str,
        *,
        version: str | None = None,
    ) -> list[FetchedSkill]:
        """下载/拉取多个 skill，返回列表；默认实现委托给 fetch()，包装为列表。

        当一个 ref 对应多个 skill（如 GitHub 多 skill 仓库）时，子类可覆写此方法。
        """
        result = await self.fetch(ref, version=version)
        return [result]

    @abstractmethod
    async def resolve_latest(self, ref: SkillCandidate | str) -> str | None:
        """返回最新可用版本号；不可用/不支持时返回 None。供升级检测调用。"""

    # ── 便捷方法 ──────────────────────────────────────────────────────────────

    def _get_id(self, ref: SkillCandidate | str) -> str:
        """统一取出 id 字符串"""
        return ref.id if isinstance(ref, SkillCandidate) else ref
