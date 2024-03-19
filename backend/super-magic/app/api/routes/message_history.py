"""
消息历史查询API

提供查询任务消息历史的接口
"""

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from agentlang.logger import get_logger
from app.api.http_dto.base import BaseResponse, create_success_response, create_error_response
from app.service.message_history_service import get_message_history_service, TaskIndex

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/message_history", tags=["消息历史"])


class MessageHistoryResponse(BaseModel):
    """消息历史响应模型"""
    seq_id: int
    message_id: str
    timestamp: int
    message_type: str
    status: str
    content: str
    saved_at: str


class TaskInfoResponse(BaseModel):
    """任务信息响应模型"""
    task_id: str
    created_at: str
    last_updated: str
    message_count: int
    max_seq_id: int
    total_size_bytes: int


@router.get("/tasks", response_model=BaseResponse)
async def get_all_tasks():
    """
    获取所有任务列表
    """
    try:
        history_manager = get_message_history_service()
        task_indices = await history_manager.get_all_tasks()

        task_list = []
        for task_index in task_indices:
            task_list.append(TaskInfoResponse(
                task_id=task_index.task_id,
                created_at=task_index.created_at,
                last_updated=task_index.last_updated,
                message_count=task_index.message_count,
                max_seq_id=task_index.max_seq_id,
                total_size_bytes=task_index.total_size_bytes
            ))

        return create_success_response(
            f"获取任务列表成功，共 {len(task_list)} 个任务",
            data={
                "total": len(task_list),
                "tasks": task_list
            }
        )

    except Exception as e:
        logger.error(f"获取任务列表失败: {e}")
        return create_error_response("获取任务列表失败")


@router.get("/tasks/{task_id}/messages", response_model=BaseResponse)
async def get_task_messages(
    task_id: str,
    start_seq: int = Query(1, description="起始序列号"),
    limit: int = Query(100, description="返回数量限制", le=500)
):
    """
    获取任务的消息列表
    """
    try:
        history_manager = get_message_history_service()
        messages = await history_manager.get_message_list(task_id, start_seq, limit)

        message_list = []
        for msg_data in messages:
            payload = msg_data.get('payload', {})
            message_list.append(MessageHistoryResponse(
                seq_id=payload.get('seq_id', 0),
                message_id=payload.get('message_id', ''),
                timestamp=payload.get('send_timestamp', 0),
                message_type=payload.get('type', ''),
                status=payload.get('status', ''),
                content=payload.get('content', ''),
                saved_at=msg_data.get('saved_at', '')
            ))

        return create_success_response(
            f"获取消息列表成功，共 {len(message_list)} 条消息",
            data={
                "task_id": task_id,
                "start_seq": start_seq,
                "limit": limit,
                "messages": message_list
            }
        )

    except Exception as e:
        logger.error(f"获取消息列表失败 {task_id}: {e}")
        return create_error_response("获取消息列表失败")


@router.get("/tasks/{task_id}/info", response_model=BaseResponse)
async def get_task_info(task_id: str):
    """
    获取任务信息
    """
    try:
        history_manager = get_message_history_service()
        task_index = await history_manager.get_task_info(task_id)

        if not task_index:
            return create_error_response(f"任务 {task_id} 不存在")

        task_info = TaskInfoResponse(
            task_id=task_index.task_id,
            created_at=task_index.created_at,
            last_updated=task_index.last_updated,
            message_count=task_index.message_count,
            max_seq_id=task_index.max_seq_id,
            total_size_bytes=task_index.total_size_bytes
        )

        return create_success_response(
            f"获取任务信息成功",
            data=task_info
        )

    except Exception as e:
        logger.error(f"获取任务信息失败 {task_id}: {e}")
        return create_error_response("获取任务信息失败")


@router.get("/tasks/{task_id}/messages/{seq_id}", response_model=BaseResponse)
async def get_single_message(task_id: str, seq_id: int):
    """
    获取单条消息
    """
    try:
        history_manager = get_message_history_service()
        message_data = await history_manager.get_message(task_id, seq_id)

        if not message_data:
            return create_error_response(f"消息 {task_id}/{seq_id} 不存在")

        return create_success_response(
            f"获取消息成功",
            data=message_data
        )

    except Exception as e:
        logger.error(f"获取消息失败 {task_id}/{seq_id}: {e}")
        return create_error_response("获取消息失败")


@router.delete("/tasks/{task_id}/cleanup", response_model=BaseResponse)
async def cleanup_task_messages(
    task_id: str,
    days: int = Query(30, description="保留天数", ge=1)
):
    """
    清理任务的旧消息
    """
    try:
        history_manager = get_message_history_service()
        deleted_count = await history_manager.cleanup_old_messages(days)

        return create_success_response(
            f"清理完成，删除了 {deleted_count} 条旧消息",
            data={
                "deleted_count": deleted_count,
                "days": days
            }
        )

    except Exception as e:
        logger.error(f"清理消息失败: {e}")
        return create_error_response("清理消息失败")
