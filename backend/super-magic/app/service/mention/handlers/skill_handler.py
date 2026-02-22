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
        "system": "系统技能",
        "agent": "员工技能",
        "mine": "我的技能",
    }

    def get_type(self) -> str:
        return "skill"

    async def get_tip(self, mention: Dict[str, Any]) -> str:
        return ""

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
        description = mention.get("description", "")
        raw_source = mention.get("mention_source", "")
        source_key = _parse_mention_source(raw_source)
        source_label = self._SOURCE_LABELS.get(source_key, source_key) if source_key else ""

        logger.info(f"用户 prompt 添加技能引用: {name} ({code}), 来源: {source_key}")

        lines = [f"{index}. [@skill:{name}]"]
        if code:
            lines.append(f"   - 技能编码: {code}")
        if source_label:
            lines.append(f"   - 来源: {source_label}")
        if description:
            lines.append(f"   - 描述: {description}")

        if source_key == _SOURCE_MINE and code:
            lines.append(
                f"   - 使用指南: 先用 skills_read(skill_names=[\"{name}\"]) 加载；"
                f"若技能未安装，执行 `skillhub install-platform-me {code}` 安装后再加载使用"
            )
        else:
            lines.append(f"   - 使用指南: 先用 skills_read(skill_names=[\"{name}\"]) 加载后使用")

        return lines
