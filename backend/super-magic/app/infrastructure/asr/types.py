"""
语音识别服务类型定义
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ASRConfig(BaseModel):
    """语音识别服务配置"""
    app_id: str = Field(..., description="火山引擎应用ID")
    token: str = Field(..., description="火山引擎访问令牌")
    cluster: str = Field(..., description="火山引擎集群名称")
    secret_key: str = Field(..., description="火山引擎密钥")


class Utterance(BaseModel):
    """语音识别结果中的单个语句"""
    start_time: int = Field(..., description="开始时间（毫秒）")
    end_time: int = Field(..., description="结束时间（毫秒）")
    text: str = Field(..., description="识别出的文字")


class ASRResult(BaseModel):
    """语音识别结果"""
    status: str = Field(..., description="识别状态")
    message: str = Field(..., description="状态描述")
    task_id: str = Field(..., description="任务ID")
    text: str = Field("", description="完整识别文本")
    utterances: List[Utterance] = Field([], description="分段识别结果")
    raw_response: Optional[Dict[str, Any]] = Field(None, description="原始响应") 
