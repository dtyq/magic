"""
聊天历史管理API模块

提供聊天历史相关功能，如打包下载历史记录等
"""
import os
import shutil
import tempfile

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse

from agentlang.logger import get_logger
from app.paths import PathManager

logger = get_logger(__name__)

router = APIRouter(prefix="/chat-history", tags=["chat_history"])

def remove_file(path: str):
    """删除指定路径的文件"""
    try:
        os.unlink(path)
        logger.info(f"临时文件已删除: {path}")
    except Exception as e:
        logger.error(f"删除文件失败: {e}")

@router.get("/download")
async def download_chat_history(background_tasks: BackgroundTasks):
    """打包并下载.chat_history目录"""
    try:
        # 检查目录是否存在
        chat_history_dir = PathManager.get_chat_history_dir()
        if not chat_history_dir.exists() or not chat_history_dir.is_dir():
            logger.error("聊天历史目录不存在")
            raise HTTPException(status_code=404, detail="聊天历史目录不存在")

        # 创建临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as tmp:
            tmp_path = tmp.name

        logger.info(f"创建临时文件: {tmp_path}")

        # 创建zip文件
        archive_path = shutil.make_archive(
            tmp_path.replace('.zip', ''), 
            'zip', 
            root_dir=PathManager.get_project_root(),
            base_dir=PathManager.get_chat_history_dir_name()
        )

        logger.info(f"创建聊天历史压缩包: {archive_path}")

        # 添加后台任务，在响应完成后删除临时文件
        background_tasks.add_task(remove_file, archive_path)

        return FileResponse(
            path=archive_path,
            media_type="application/zip",
            filename="chat_history.zip"
        )
    except Exception as e:
        logger.error(f"打包聊天历史失败: {e!s}")
        raise HTTPException(status_code=500, detail=f"打包失败: {e!s}") 
