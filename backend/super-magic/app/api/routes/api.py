"""
API路由集中注册模块

该模块负责集中注册所有API路由，包括RESTful API，
简化路由管理和维护。
"""
from fastapi import APIRouter

from app.api.routes.chat_history import router as chat_history_router
from app.api.routes.messages import router as messages_router
from app.api.routes.workspace import router as workspace_router
from app.api.routes.file import router as file_router
from app.api.routes.file_convert import router as file_convert_router
from app.api.routes.checkpoint import router as checkpoint_router
from app.api.routes.asr import router as asr_router
from app.api.routes.skills import router as skills_router


# 创建主路由器，设置统一前缀
api_router = APIRouter(prefix="/api")

# 注册消息处理路由
api_router.include_router(messages_router, tags=["消息处理"])

# 注册聊天历史路由
api_router.include_router(chat_history_router, tags=["聊天历史"])

# 注册工作区管理路由
api_router.include_router(workspace_router, tags=["工作区管理"])

# 注册文件管理路由
api_router.include_router(file_router, tags=["文件管理"])

# 注册文件转换路由
api_router.include_router(file_convert_router, tags=["文件转换"])

# 注册checkpoint管理路由
api_router.include_router(checkpoint_router, tags=["Checkpoint管理"])

# 注册ASR音频合并路由
api_router.include_router(asr_router, tags=["语音识别"])

# 注册Skill工具调用路由
api_router.include_router(skills_router, tags=["Skill工具调用"])

@api_router.get("/health", tags=["系统"])
async def health_check():
    """
    健康检查端点

    用于监控服务状态，确保API服务正常运行
    """
    return {
        "status": "healthy",
        "service": "SuperMagic API",
        "version": "1.0.0"
    }
