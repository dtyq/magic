from typing import List, Optional
from pydantic import BaseModel, Field, validator


class KnowledgeSourceFileDownloadItem(BaseModel):
    """知识库源文件下载项"""

    knowledge_code: str = Field(..., description="知识库编码")
    document_code: str = Field(..., description="知识库文档编码")
    file_key: str = Field(..., description="知识库检索结果中的源文件键")
    location: str = Field(..., description="工作区中的目标路径")

    @validator('knowledge_code', 'document_code', 'file_key')
    def validate_required_code(cls, v):
        if not v or not v.strip():
            raise ValueError("知识库源文件下载参数不能为空")
        return v.strip()

    @validator('location')
    def validate_location(cls, v):
        if not v or not v.strip():
            raise ValueError("location 不能为空")

        # 清理路径
        clean_path = v.strip().lstrip('/')

        # 基本安全检查 - 禁止危险的路径模式
        dangerous_patterns = ['../', '..\\']
        if any(pattern in clean_path for pattern in dangerous_patterns):
            raise ValueError("location 包含不安全的路径模式")

        # 禁止绝对路径
        if clean_path.startswith('/') or (len(clean_path) > 1 and clean_path[1] == ':'):
            raise ValueError("location 必须是相对路径")

        return clean_path


class KnowledgeSourceFileDownloadRequest(BaseModel):
    """知识库源文件下载请求"""

    files: List[KnowledgeSourceFileDownloadItem] = Field(..., description="要下载的文件列表")

    @validator('files')
    def validate_files(cls, v):
        if not v:
            raise ValueError("files 列表不能为空")
        if len(v) > 50:  # 限制一次最多下载50个文件
            raise ValueError("单次下载文件数量不能超过50个")
        return v


class KnowledgeSourceFileDownloadResult(BaseModel):
    """单个知识库源文件下载结果"""

    file_key: str = Field(..., description="存储中的文件键")
    location: str = Field(..., description="工作区中的目标路径")
    success: bool = Field(..., description="是否下载成功")
    error_message: Optional[str] = Field(None, description="错误信息（仅在失败时）")
    file_size: Optional[int] = Field(None, description="文件大小（字节）")
    workspace_file_key: Optional[str] = Field(None, description="当前工作区项目文件的存储键")
    project_file_id: Optional[str] = Field(None, description="项目文件ID")
    registered_relative_path: Optional[str] = Field(None, description="注册后的项目文件相对路径")


class KnowledgeSourceFileDownloadResponse(BaseModel):
    """知识库源文件下载响应"""

    total_count: int = Field(..., description="总文件数量")
    success_count: int = Field(..., description="成功下载的文件数量")
    failed_count: int = Field(..., description="失败的文件数量")
    results: List[KnowledgeSourceFileDownloadResult] = Field(..., description="详细结果列表")

    @property
    def all_success(self) -> bool:
        """是否全部成功"""
        return self.failed_count == 0
