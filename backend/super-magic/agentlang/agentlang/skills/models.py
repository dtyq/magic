"""Skill 元数据模型"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from pathlib import Path
import asyncio


@dataclass
class SkillMetadata:
    """Skill 元数据模型

    包含 Skill 的所有元信息，包括名称、描述、版本、依赖等，
    以及辅助方法用于访问 Skill 的各种资源。
    """

    # 必需字段
    name: str                           # Skill 名称
    description: str                    # Skill 描述

    # 可选字段
    version: str = "1.0.0"             # 版本号
    author: Optional[str] = None        # 作者
    license: Optional[str] = None       # 许可证
    dependencies: List[str] = field(default_factory=list)  # 依赖
    tags: List[str] = field(default_factory=list)          # 标签
    enabled: bool = True                # 是否启用
    allowed_tools: Optional[List[str]] = None  # 允许使用的工具列表，None 表示不限制

    # 路径信息
    skill_dir: Optional[Path] = None    # Skill 目录路径
    skill_file: Optional[Path] = None   # SKILL.md 文件路径

    # 内容信息
    content: str = ""                   # Markdown 内容
    raw_metadata: Dict[str, Any] = field(default_factory=dict)  # 原始元数据

    async def has_scripts(self) -> bool:
        """检查是否包含脚本目录（异步）

        Returns:
            bool: 如果存在 scripts 目录返回 True
        """
        if self.skill_dir:
            scripts_path = self.skill_dir / "scripts"
            return await asyncio.to_thread(scripts_path.exists)
        return False

    async def has_reference(self) -> bool:
        """检查是否包含参考文档目录（异步）

        同时兼容 references（复数）和 reference（单数）两种目录命名。

        Returns:
            bool: 如果存在 references 或 reference 目录返回 True
        """
        if self.skill_dir:
            for dirname in ("references", "reference"):
                path = self.skill_dir / dirname
                if await asyncio.to_thread(path.exists):
                    return True
        return False

    async def has_resources(self) -> bool:
        """检查是否包含资源目录（异步）

        Returns:
            bool: 如果存在 resources 目录返回 True
        """
        if self.skill_dir:
            resources_path = self.skill_dir / "resources"
            return await asyncio.to_thread(resources_path.exists)
        return False

    async def get_scripts_dir(self) -> Optional[Path]:
        """获取脚本目录路径（异步）

        Returns:
            Optional[Path]: 脚本目录路径，如果不存在返回 None
        """
        if await self.has_scripts():
            return self.skill_dir / "scripts"
        return None

    async def get_reference_dir(self) -> Optional[Path]:
        """获取参考文档目录路径（异步）

        同时兼容 references（复数）和 reference（单数）两种目录命名。

        Returns:
            Optional[Path]: 参考文档目录路径，如果不存在返回 None
        """
        if self.skill_dir:
            for dirname in ("references", "reference"):
                path = self.skill_dir / dirname
                if await asyncio.to_thread(path.exists):
                    return path
        return None

    async def get_resources_dir(self) -> Optional[Path]:
        """获取资源目录路径（异步）

        Returns:
            Optional[Path]: 资源目录路径，如果不存在返回 None
        """
        if await self.has_resources():
            return self.skill_dir / "resources"
        return None
