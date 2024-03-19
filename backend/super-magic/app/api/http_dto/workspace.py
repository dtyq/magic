from typing import Any, Optional

from pydantic import BaseModel


class WorkspaceInfo(BaseModel):
    """工作区信息模型"""

    id: Any  # 可以是数字或字符串
    workspace_name: str
    sort: int


# 请求模型
class GetWorkspacesRequest(BaseModel):
    """获取工作区列表请求模型"""
    pass


class SaveWorkspaceRequest(BaseModel):
    """保存工作区请求模型"""

    id: Optional[Any] = None  # 可选，编辑时提供
    name: str  # 工作区名称


class DeleteWorkspaceRequest(BaseModel):
    """删除工作区请求模型"""

    id: Any  # 工作区ID


# 响应模型
class WorkspaceResponse(BaseModel):
    """工作区响应模型"""

    id: Any
