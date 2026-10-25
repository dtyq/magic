"""生成适配使用的项目身份模型。"""

from dataclasses import dataclass


@dataclass(frozen=True)
class ProjectIdentity:
    """描述生成适配使用的稳定项目路径和名称。"""

    project_path: str
    project_name: str
