"""
语音识别服务模块初始化文件
"""

from .types import ASRConfig, ASRResult
from .ve_asr_service import VEASRService

__all__ = [
    "ASRConfig",
    "ASRResult",
    "VEASRService"
] 
