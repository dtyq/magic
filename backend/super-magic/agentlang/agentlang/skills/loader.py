"""Skill 加载器，负责从文件系统加载 Skill"""

from pathlib import Path
from typing import Tuple, Any, Optional, List
import yaml
import aiofiles
import asyncio

from agentlang.utils.annotation_remover import remove_developer_annotations
from .models import SkillMetadata
from .exceptions import SkillLoadError, SkillParseError, SkillValidationError


class SkillLoader:
    """Skill 加载器，负责从文件系统加载 Skill

    提供从 SKILL.md 文件或目录加载 Skill 的功能，
    解析 YAML frontmatter 和 Markdown 内容。
    """

    def __init__(self):
        """初始化 SkillLoader"""
        pass

    async def load_from_file(self, skill_file: Path) -> SkillMetadata:
        """从 SKILL.md 文件加载 Skill（异步）

        Args:
            skill_file: SKILL.md 文件路径

        Returns:
            SkillMetadata: 加载的 Skill 元数据

        Raises:
            SkillLoadError: 加载失败时抛出
            SkillParseError: 解析失败时抛出
            SkillValidationError: 验证失败时抛出
        """
        # 异步检查文件是否存在
        if not await asyncio.to_thread(skill_file.exists):
            raise SkillLoadError(f"Skill file not found: {skill_file}")

        # 异步读取文件内容
        try:
            async with aiofiles.open(skill_file, mode="r", encoding="utf-8") as f:
                content = await f.read()
        except Exception as e:
            raise SkillLoadError(f"Failed to read skill file {skill_file}: {e}")

        # 解析 frontmatter 和 markdown 内容
        try:
            metadata_dict, markdown_content = self._parse_frontmatter(content)
        except SkillParseError:
            # frontmatter 解析失败时，兼容处理：用目录名作为 name，description 为空
            metadata_dict = {
                "name": skill_file.parent.name,
                "description": "",
            }
            markdown_content = content

        # 移除 markdown 内容中的中文注释，只保留英文内容给 LLM
        markdown_content = remove_developer_annotations(markdown_content)

        # 验证必需字段
        self._validate_metadata(metadata_dict)

        # 处理 allowed-tools 字段（支持字符串和列表格式）
        allowed_tools = self._parse_allowed_tools(metadata_dict.get("allowed-tools"))

        # 创建 SkillMetadata 实例
        skill_metadata = SkillMetadata(
            name=metadata_dict["name"],
            description=metadata_dict["description"],
            version=metadata_dict.get("version", "1.0.0"),
            author=metadata_dict.get("author"),
            license=metadata_dict.get("license"),
            dependencies=metadata_dict.get("dependencies", []),
            tags=metadata_dict.get("tags", []),
            enabled=metadata_dict.get("enabled", True),
            allowed_tools=allowed_tools,
            skill_dir=skill_file.parent,
            skill_file=skill_file,
            content=markdown_content,
            raw_metadata=metadata_dict,
        )

        return skill_metadata

    async def load_from_directory(self, skill_dir: Path) -> SkillMetadata:
        """从 Skill 目录加载（异步）

        Args:
            skill_dir: Skill 目录路径

        Returns:
            SkillMetadata: 加载的 Skill 元数据

        Raises:
            SkillLoadError: 如果 SKILL.md 文件不存在
        """
        skill_file = skill_dir / "SKILL.md"
        return await self.load_from_file(skill_file)

    def _parse_frontmatter(self, content: str) -> Tuple[dict, str]:
        """解析 YAML frontmatter 和 Markdown 内容

        Args:
            content: 文件内容

        Returns:
            Tuple[dict, str]: (metadata_dict, markdown_content)

        Raises:
            SkillParseError: 解析失败时抛出
        """
        lines = content.split("\n")

        # 检查是否以 --- 开头
        if not lines or lines[0].strip() != "---":
            raise SkillParseError("Invalid frontmatter: must start with '---'")

        # 查找结束标记
        end_index = -1
        for i in range(1, len(lines)):
            if lines[i].strip() == "---":
                end_index = i
                break

        if end_index == -1:
            raise SkillParseError("Invalid frontmatter: missing closing '---'")

        # 提取并解析 YAML
        yaml_content = "\n".join(lines[1:end_index])

        # 注意：不再移除 YAML 中的中文注释，因为新格式使用 name-cn 和 description-cn 字段
        # 如果 YAML 中包含 <!--zh --> 注释，YAML 解析器会将其作为字符串的一部分处理
        # 但新格式应该不再使用这种注释，而是使用独立的字段

        try:
            metadata_dict = yaml.safe_load(yaml_content) or {}
        except yaml.YAMLError as e:
            raise SkillParseError(f"Failed to parse YAML frontmatter: {e}")

        # 提取 Markdown 内容
        markdown_content = "\n".join(lines[end_index + 1 :]).strip()

        return metadata_dict, markdown_content

    def _validate_metadata(self, metadata: dict) -> None:
        """验证元数据必需字段

        Args:
            metadata: 元数据字典

        Raises:
            SkillValidationError: 验证失败时抛出
        """
        required_fields = ["name", "description"]
        missing_fields = [f for f in required_fields if f not in metadata]

        if missing_fields:
            raise SkillValidationError(f"Missing required fields: {', '.join(missing_fields)}")

    def _parse_allowed_tools(self, allowed_tools_value: Any) -> Optional[List[str]]:
        """解析 allowed-tools 字段

        支持以下格式：
        - None: 不限制
        - 字符串: "Read, Grep, Glob" 或 "Read,Grep,Glob"
        - 列表: ["Read", "Grep", "Glob"]

        Args:
            allowed_tools_value: allowed-tools 字段的值

        Returns:
            Optional[List[str]]: 工具名称列表，如果为 None 表示不限制
        """
        if allowed_tools_value is None:
            return None

        if isinstance(allowed_tools_value, str):
            # 字符串格式：按逗号分割，去除空白
            tools = [tool.strip() for tool in allowed_tools_value.split(",") if tool.strip()]
            return tools if tools else None

        if isinstance(allowed_tools_value, list):
            # 列表格式：确保所有元素都是字符串
            tools = [str(tool).strip() for tool in allowed_tools_value if tool]
            return tools if tools else None

        # 其他类型：尝试转换为字符串列表
        return [str(allowed_tools_value).strip()]
