from typing import List, Optional
from pydantic import BaseModel, Field, validator


class FileEditItem(BaseModel):
    """文件保存项"""
    
    file_key: str = Field(..., description="存储中的文件标识")
    file_path: str = Field(..., description="工作区相对路径，如 ppt/a.png")
    content: str = Field(..., description="文件内容（可能是 ShadowCode 加密）")
    is_encrypted: bool = Field(False, description="内容是否为 ShadowCode 加密")
    
    @validator('file_key')
    def validate_file_key(cls, v):
        if not v or not v.strip():
            raise ValueError("file_key 不能为空")
        return v.strip()
    
    @validator('file_path')
    def validate_file_path(cls, v):
        if not v or not v.strip():
            raise ValueError("file_path 不能为空")
        
        # 清理路径
        clean_path = v.strip().lstrip('/')
        
        # 基本安全检查 - 禁止危险的路径模式
        dangerous_patterns = ['../', '..\\']
        if any(pattern in clean_path for pattern in dangerous_patterns):
            raise ValueError("file_path 包含不安全的路径模式")
        
        # 禁止绝对路径
        if clean_path.startswith('/') or (len(clean_path) > 1 and clean_path[1] == ':'):
            raise ValueError("file_path 必须是相对路径")
        
        return clean_path
    
    @validator('content')
    def validate_content(cls, v):
        if v is None:
            raise ValueError("content 不能为空")
        # 允许空字符串内容（创建空文件）
        return v
    


class FileEditRequest(BaseModel):
    """文件保存请求"""
    
    files: List[FileEditItem] = Field(..., description="要保存的文件列表")
    
    @validator('files')
    def validate_files(cls, v):
        if not v:
            raise ValueError("files 列表不能为空")
        if len(v) > 20:  # 限制一次最多保存20个文件
            raise ValueError("单次保存文件数量不能超过20个")
        return v


class FileEditResult(BaseModel):
    """单个文件保存结果"""
    
    file_key: str = Field(..., description="存储中的文件标识")
    file_path: str = Field(..., description="工作区相对路径")
    success: bool = Field(..., description="是否保存成功")
    error_message: Optional[str] = Field(None, description="错误信息（仅在失败时）")
    file_size: Optional[int] = Field(None, description="文件大小（字节）")
    # 注释：简化版本不再包含上传相关字段
    # upload_success: Optional[bool] = Field(None, description="是否上传成功")
    # upload_url: Optional[str] = Field(None, description="上传后的访问URL")
    operation_type: Optional[str] = Field(None, description="操作类型：create/overwrite")


class FileEditResponse(BaseModel):
    """文件保存响应"""
    
    total_count: int = Field(..., description="总文件数量")
    success_count: int = Field(..., description="成功保存的文件数量")
    failed_count: int = Field(..., description="失败的文件数量")
    # 注释：简化版本不再包含上传相关字段
    # upload_success_count: int = Field(..., description="成功上传的文件数量")
    results: List[FileEditResult] = Field(..., description="详细结果列表")
    
    @property
    def all_success(self) -> bool:
        """是否全部成功"""
        return self.failed_count == 0
    
    # 注释：简化版本不再包含上传相关方法
    # @property
    # def all_uploaded(self) -> bool:
    #     """是否全部上传成功"""
    #     return self.upload_success_count == self.success_count