"""
AIGC元数据实体定义

用于文件转换服务中的AIGC元数据标识参数
"""
from typing import Optional
from pydantic import BaseModel, Field


class AigcMetadataParams(BaseModel):
    """
    AIGC元数据参数

    用于标识AIGC生成内容的来源信息，包括用户ID、组织代码和话题ID
    这些参数将被嵌入到生成的PDF、PPTX和图片文件的元数据中
    """
    user_id: Optional[str] = Field(default=None, description="用户ID")
    organization_code: Optional[str] = Field(default=None, description="组织代码")
    topic_id: Optional[str] = Field(default=None, description="话题ID")

    class Config:
        """Pydantic配置"""
        json_schema_extra = {
            "example": {
                "user_id": "user123",
                "organization_code": "org456",
                "topic_id": "topic789"
            }
        }
