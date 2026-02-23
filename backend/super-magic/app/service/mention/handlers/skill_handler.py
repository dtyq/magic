"""Skill mention handler"""
from typing import Dict, List, Any
from app.service.mention.base import BaseMentionHandler, logger

# mention_source 字段的 "mine" 值表示来源为用户自己的技能库
_SOURCE_MINE = "mine"


def _parse_mention_source(mention_source: str) -> str:
    """解析 mention_source 字段，返回 source key。

    支持两种格式：
    - 单值：`"mine"`
    - 枚举描述串：`"system=系统,agent=员工,mine=我的"`
    """
    if not mention_source:
        return ""
    # 取第一个 key=value 对，或整个字符串本身作为 key
    first_part = mention_source.split(",")[0].strip()
    if "=" in first_part:
        return first_part.split("=", 1)[0].strip()
    return first_part


class SkillHandler(BaseMentionHandler):
    """处理 skill 类型的 mention"""

    # mention_source 各值对应的中文标签
    _SOURCE_LABELS = {
        "system": "系统",
        "agent": "员工",
        "mine": "我的",
    }

    def get_type(self) -> str:
        return "skill"

    async def get_tip(self, mention: Dict[str, Any]) -> str:
        code = mention.get("code", "")
        raw_source = mention.get("mention_source", "")
        source_key = _parse_mention_source(raw_source)

        if source_key == _SOURCE_MINE and code:
            return (
                "引用了「我的技能库」的技能，需先调用 skill_list 确认安装状态（installed 字段），"
                "未安装的技能请加载并参考 find-skill 技能学习如何安装，"
                "安装完成后再用 skills_read 加载；"
                "技能的 package_name 字段才是工具调用时使用的名称，如 skills_read(skill_names=[package_name])"
            )
        return (
            "引用的技能需先通过 skills_read 加载后再使用；"
            "技能的 package_name 字段才是工具调用时使用的名称，如 skills_read(skill_names=[package_name])"
        )

    async def handle(self, mention: Dict[str, Any], index: int) -> List[str]:
        """处理 skill 引用，格式化上下文行

        Args:
            mention: mention 数据
            index: mention 序号

        Returns:
            List[str]: 格式化的上下文行列表
        """
        name = mention.get("name")
        if not name:
            return []

        code = mention.get("code", "")
        package_name = mention.get("package_name", "")
        description = mention.get("description", "")
        raw_source = mention.get("mention_source", "")
        source_key = _parse_mention_source(raw_source)

        # 用于工具调用的实际包名，优先使用 package_name，fallback 到 name
        skill_key = package_name or name

        logger.info(f"用户 prompt 添加技能引用: {name} (package={skill_key}, code={code}), 来源: {source_key}")

        lines = [f"{index}. [@skill:{name}]"]
        lines.append(f"   - package_name: {skill_key}")
        if code:
            lines.append(f"   - code: {code}")
        if description:
            lines.append(f"   - 描述: {description}")

        return lines
