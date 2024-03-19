"""
配置管理模块
"""
import os
from typing import Optional
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """应用配置"""
    # 应用环境
    app_env: str = Field(..., env="APP_ENV")
    # 沙箱镜像名称
    super_magic_image_name: str = Field(..., env="SUPER_MAGIC_IMAGE_NAME")
    
    # 运行中容器超时时间（秒），超过后容器将被停止
    running_container_expire_time: int = Field(3600 * 6, env="CONTAINER_EXPIRE_TIME")
    
    # 已退出容器过期时间（秒），默认30分钟
    exited_container_expire_time: int = Field(1800, env="EXITED_CONTAINER_EXPIRE_TIME")
    
    # 服务端口
    sandbox_gateway_port: int = Field(8003, env="SANDBOX_GATEWAY_PORT")
    
    # 容器WebSocket端口
    container_ws_port: int = Field(8002, env="CONTAINER_WS_PORT")
    
    # 日志级别
    log_level: str = Field("INFO", env="LOG_LEVEL")
    
    # 日志文件
    log_file: Optional[str] = Field(None, env="LOG_FILE")
    
    # 健康检查间隔（秒）
    health_check_interval: int = Field(300, env="HEALTH_CHECK_INTERVAL")
    
    # 容器清理间隔（秒）
    cleanup_interval: int = Field(300, env="CLEANUP_INTERVAL")

    # WebSocket 接收消息超时时间（秒）
    ws_receive_timeout: float = Field(600.0, env="WS_RECEIVE_TIMEOUT")
    
    # Qdrant配置
    qdrant_image_name: str = Field("qdrant/qdrant:latest", env="QDRANT_IMAGE_NAME")
    qdrant_port: int = Field(6333, env="QDRANT_PORT")
    qdrant_grpc_port: int = Field(6334, env="QDRANT_GRPC_PORT")
    qdrant_label: str = Field("qdrant", env="QDRANT_LABEL")
    
    # Agent环境文件配置 - 必需项
    agent_env_file_path: str = Field(..., env="AGENT_ENV_FILE_PATH")
    
    class Config:
        """配置元数据"""
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"  # 允许额外的字段


# 加载配置
def load_settings() -> Settings:
    """加载应用配置"""
    # 尝试从环境变量或.env文件加载配置
    try:
        settings = Settings()
        # 检查Agent环境文件是否存在
        if not os.path.isfile(settings.agent_env_file_path):
            raise ValueError(f"Agent环境文件不存在: {settings.agent_env_file_path}")
        return settings
    except Exception as e:
        # 如果加载失败，输出错误并使用默认值
        print(f"配置加载错误: {e}", file=os.sys.stderr)
        # 如果SUPER_MAGIC_IMAGE_NAME未定义，则必须手动设置
        super_magic_image_name = os.environ.get("SUPER_MAGIC_IMAGE_NAME")
        if not super_magic_image_name:
            raise ValueError("必须设置环境变量 SUPER_MAGIC_IMAGE_NAME 来指定沙箱镜像名称") from e
        
        # 对于必需的环境变量文件，直接抛出异常阻止启动
        if "Agent环境文件不存在" in str(e):
            raise
        
        # 使用基本配置
        return Settings(super_magic_image_name=super_magic_image_name)


# 全局配置实例
settings = load_settings() 