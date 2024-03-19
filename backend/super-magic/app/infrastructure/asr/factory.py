"""
ASR服务工厂模块
"""

from typing import Optional

from agentlang.config.config import config
from app.infrastructure.asr.types import ASRConfig
from app.infrastructure.asr.ve_asr_service import VEASRService


class ASRServiceFactory:
    """ASR服务工厂，用于创建不同的ASR服务实例"""

    _instance: Optional[VEASRService] = None

    @classmethod
    def get_ve_asr_service(cls) -> VEASRService:
        """
        获取火山引擎语音识别服务实例
        
        Returns:
            VEASRService: 火山引擎语音识别服务实例
        """
        if cls._instance is None:
            # 从配置中获取ASR配置
            asr_config = config.get("asr", {})

            # 创建ASR配置对象
            asr_service_config = ASRConfig(
                app_id=asr_config.get("app_id", ""),
                token=asr_config.get("token", ""),
                cluster=asr_config.get("cluster", ""),
                secret_key=asr_config.get("secret_key", "")
            )

            # 创建服务实例
            cls._instance = VEASRService(asr_service_config)

        return cls._instance 
