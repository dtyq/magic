"""Skill mention handler"""
from typing import Dict, List, Any
from app.service.mention.base import BaseMentionHandler, logger

# mention_source 字段的 "mine" 值表示来源为用户自己的技能库
_SOURCE_MINE = "mine"


def _get_code(mention: Dict[str, Any]) -> str:
    """取 code，兼容前端将平台 code 放在 id 字段的情况"""
    return mention.get("code") or mention.get("id") or ""


def _parse_mention_source(mention_source: str) -> str:
    """解析 mention_source 字段，返回第一个 source key（用于日志等场景）。

    支持两种格式：
    - 单值：`"mine"`
    - 枚举描述串：`"system=系统,agent=员工,mine=我的"`
    """
    if not mention_source:
        return ""
    first_part = mention_source.split(",")[0].strip()
    if "=" in first_part:
        return first_part.split("=", 1)[0].strip()
    return first_part


def _has_source(mention_source: str, target: str) -> bool:
    """检查 mention_source 中是否包含指定的 source key，支持枚举描述串中任意位置匹配。"""
    if not mention_source:
        return False
    for part in mention_source.split(","):
        part = part.strip()
        key = part.split("=", 1)[0].strip() if "=" in part else part
        if key == target:
            return True
    return False


class SkillHandler(BaseMentionHandler):
    """处理 skill 类型的 mention"""

    def get_type(self) -> str:
        return "skill"

    async def get_tip(self, mention: Dict[str, Any]) -> str:
        code = _get_code(mention)
        raw_source = mention.get("mention_source", "")

        if _has_source(raw_source, _SOURCE_MINE) and code:
            return (
                "The referenced skill comes from your personal skill library. "
                "Call skill_list first to check installation status (installed field). "
                "For uninstalled skills, load and follow the find-skill skill to install them. "
                "After installation, use read_skills to load. "
                "Use the skill's package_name field as the name when calling, e.g. read_skills(skill_names=[package_name])."
            )
        return (
            "Load the referenced skill via read_skills before use. "
            "Use the skill's package_name field as the name when calling, e.g. read_skills(skill_names=[package_name])."
        )

    async def handle(self, mention: Dict[str, Any], index: int) -> List[str]:
        name = mention.get("name")
        if not name:
            return []

        code = _get_code(mention)
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
            lines.append(f"   - description: {description}")

        return lines
