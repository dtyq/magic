from typing import Optional, List

from pydantic import BaseModel, Field


class File(BaseModel):
    """
    文件/目录数据模型

    对应 Magic Service 返回的文件树节点结构
    """
    id: str = Field(..., description="文件ID (Snowflake ID)")
    name: str = Field(..., description="文件名")
    parent_id: str = Field(..., description="父目录ID")
    is_directory: bool = Field(..., description="是否为目录")
    size: int = Field(..., description="文件大小(字节)")
    created_at: str = Field(..., description="创建时间")
    updated_at: str = Field(..., description="更新时间")
    children: Optional[List["File"]] = Field(default=None, description="子文件/目录列表")

    class Config:
        # 允许通过字段名或别名填充
        populate_by_name = True


# 更新前向引用,支持递归定义
File.model_rebuild()
