"""
聊天历史管理API模块

提供聊天历史相关功能，如打包下载历史记录等

观察期说明：
`/api/chat-history/download` 已在统一路由注册处暂时下线。仓库内未发现调用方，
若观察期内无反馈，应删除本模块及对应的历史接口实现。
"""
import asyncio
import os
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.service.topic_persistence import get_chat_history_excluded_dir_names

logger = get_logger(__name__)

router = APIRouter(prefix="/chat-history", tags=["chat_history"])

def remove_file(path: str):
    """删除指定路径的文件"""
    try:
        os.unlink(path)
        logger.info(f"临时文件已删除: {path}")
    except Exception as e:
        logger.error(f"删除文件失败: {e}")

def build_chat_history_archive(source_dir: Path, dest_zip_path: str) -> str:
    """打包聊天历史目录，zip 内顶层固定为 .chat_history/，保持外部消费方兼容。"""
    top = PurePosixPath(".chat_history")
    excluded_dir_names = get_chat_history_excluded_dir_names()
    with zipfile.ZipFile(dest_zip_path, "w", zipfile.ZIP_DEFLATED) as zip_ref:
        for root, dirnames, filenames in os.walk(source_dir):
            dirnames[:] = [
                dirname for dirname in dirnames if dirname not in excluded_dir_names
            ]
            rel_root = PurePosixPath(Path(root).relative_to(source_dir).as_posix())
            for dirname in dirnames:
                zip_ref.writestr(str(top / rel_root / dirname) + "/", "")
            for filename in filenames:
                zip_ref.write(Path(root) / filename, str(top / rel_root / filename))
    return dest_zip_path

@router.get("/download")
async def download_chat_history(background_tasks: BackgroundTasks):
    """打包并下载本地 .chat_history 目录，保持旧 zip 顶层结构兼容。"""
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

        # 写 zip 时用 arcname 补 `.chat_history/` 顶层前缀，避免 staging 全量拷贝
        archive_path = await asyncio.to_thread(
            build_chat_history_archive, chat_history_dir, tmp_path
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
