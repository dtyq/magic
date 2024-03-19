"""Skills 相关异常定义"""


class SkillError(Exception):
    """Skill 相关异常的基类"""
    pass


class SkillLoadError(SkillError):
    """Skill 加载错误"""
    pass


class SkillParseError(SkillError):
    """Skill 解析错误"""
    pass


class SkillValidationError(SkillError):
    """Skill 验证错误"""
    pass


class SkillNotFoundError(SkillError):
    """Skill 未找到"""
    pass


class SkillExecutionError(SkillError):
    """Skill 执行错误"""
    pass


class SkillResourceError(SkillError):
    """Skill 资源错误"""
    pass
