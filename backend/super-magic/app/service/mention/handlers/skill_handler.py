"""Skill mention handler"""
from typing import TYPE_CHECKING, Any, Dict, List, Optional
from app.service.mention.base import BaseMentionHandler, logger

if TYPE_CHECKING:
    from app.core.context.agent_context import AgentContext

# mention_source 字段的 "mine" 值表示来源为用户自己的技能库，对应安装时的 provider 为 my_library
_SOURCE_MINE = "mine"
_PROVIDER_MY_LIBRARY = "my_library"


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

    async def get_tip(self, mention: Dict[str, Any], agent_context: Optional["AgentContext"] = None) -> str:
        """检查 skill 安装状态并通过 horizon 推送相应指引。

        - 已安装：提示使用 read_skills 加载
        - 未安装 + 来源为 mine：提示通过 install_skills(my_library) 安装后再 read_skills
        - 未安装 + 其他来源：提示先 install_skills 再 read_skills
        """
        from app.core.skill_manager import find_skill

        name = mention.get("name", "")
        package_name = mention.get("package_name", "") or name
        code = _get_code(mention)
        raw_source = mention.get("mention_source", "")
        is_mine = _has_source(raw_source, _SOURCE_MINE)

        # 检查 skill 是否已安装
        try:
            installed = await find_skill(package_name) is not None
        except Exception as e:
            logger.warning(f"检查 skill '{package_name}' 安装状态时出错: {e}")
            installed = False

        if installed:
            tip = (
                f"Skill '{name}' is already installed. "
                f"If you need to use it, call read_skills(skill_names=['{package_name}']) to load it first."
            )
        elif is_mine:
            id_hint = f", id='{code}'" if code else ""
            tip = (
                f"Skill '{name}' is not installed yet. "
                f"If you need to use it, install it first via install_skills "
                f"(provider='{_PROVIDER_MY_LIBRARY}'{id_hint}), "
                f"then call read_skills(skill_names=['{package_name}']) to load it."
            )
        else:
            tip = (
                f"Skill '{name}' may not be installed. "
                f"If you need to use it, install it first via install_skills, "
                f"then call read_skills(skill_names=['{package_name}']) to load it."
            )

        # 通过 horizon 推送到 system context；无 agent_context 时退化为 Before proceeding: 文本注入
        if agent_context is not None:
            try:
                agent_context.horizon.push_notification("skill_mention", tip)
                return ""
            except Exception as e:
                logger.warning(f"推送 skill mention horizon 通知失败: {e}")

        return tip

    async def handle(self, mention: Dict[str, Any], index: int, agent_context: Optional["AgentContext"] = None) -> List[str]:
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
