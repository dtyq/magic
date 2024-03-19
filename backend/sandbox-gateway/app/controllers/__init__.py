"""
控制器包
"""
from app.controllers.health_controller import router as health_router
from app.controllers.sandbox_controller import router as sandbox_router
from app.controllers.chat_controller import router as chat_history_router

__all__ = ["health_router", "sandbox_router", "chat_history_router"] 