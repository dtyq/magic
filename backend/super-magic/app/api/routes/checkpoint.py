# -*- coding: utf-8 -*-
"""
Checkpoint相关的API路由

这个模块提供checkpoint功能的HTTP API接口，包括：
- 回滚执行
"""

from fastapi import APIRouter

from app.api.dto.checkpoint_dto import (
    RollbackRequestDTO,
    CheckRollbackRequestDTO,
    CheckRollbackResponseDTO
)
from app.api.http_dto.checkpoint_dto import (
    RollbackExecuteResponse
)
from app.service.checkpoint_service import CheckpointService
from app.service.rollback_service import RollbackService
from app.core.exceptions import RollbackException
from app.api.http_dto.response import (
    BaseResponse,
    create_success_response,
    create_error_response
)
from agentlang.logger import get_logger

logger = get_logger(__name__)

# 创建路由器
router = APIRouter(prefix="/checkpoints", tags=["checkpoint"])

# 初始化服务
checkpoint_service = CheckpointService()
rollback_service = RollbackService()


@router.post("/rollback/start", response_model=BaseResponse)
async def start_rollback(request: RollbackRequestDTO):
    """
    开始文件回滚操作

    将文件系统回滚到目标消息的执行前状态，但保留所有checkpoint记录。

    ⚠️ 重要：回滚到messageN表示恢复到messageN执行之前的状态

    此操作只恢复文件状态，不删除checkpoint记录。
    如需完成完整的回滚操作，请调用 /rollback/commit 接口。

    示例：message1创建文件1，message2创建文件2，message3创建文件3
    - 回滚到message1 → 无文件（message1执行前状态）
    - 回滚到message2 → 只有文件1（message2执行前状态）
    - 回滚到message3 → 文件1和文件2（message3执行前状态）

    Args:
        request: 回滚请求参数

    Returns:
        回滚开始执行结果
    """
    try:
        logger.info(f"开始执行回滚操作，目标checkpoint: {request.target_message_id}")

        await rollback_service.start_rollback(request.target_message_id)

        return create_success_response(
            message=f"开始回滚到checkpoint {request.target_message_id} 执行成功",
            data={
                "target_message_id": request.target_message_id,
                "status": "started",
                "next_step": "调用 /rollback/commit 完成回滚"
            }
        )

    except RollbackException as e:
        logger.error(f"开始回滚操作异常: {e}")
        return create_error_response(message=e.message, code=e.code)

    except Exception as e:
        logger.error(f"开始回滚失败: {e}")
        return create_error_response(
            message="开始回滚操作失败，请联系系统管理员"
        )


@router.post("/rollback/commit", response_model=BaseResponse)
async def commit_rollback():
    """
    提交回滚操作

    清理当前checkpoint之后的所有checkpoint记录，完成回滚操作。

    ⚠️ 重要：此操作会永久删除后续的checkpoint，无法撤销

    此操作应该在调用 /rollback/start 之后执行。

    Returns:
        回滚提交执行结果
    """
    try:
        logger.info("开始提交回滚操作")

        rollback_service.commit_rollback()

        return create_success_response(
            message="回滚提交操作执行成功",
            data={
                "status": "committed",
                "message": "后续checkpoint已清理"
            }
        )

    except RollbackException as e:
        logger.error(f"提交回滚操作异常: {e}")
        return create_error_response(message=e.message, code=e.code)

    except Exception as e:
        logger.error(f"提交回滚失败: {e}")
        return create_error_response(
            message="提交回滚操作失败，请联系系统管理员"
        )


@router.post("/rollback/undo", response_model=BaseResponse)
async def undo_rollback():
    """
    撤回回滚操作

    将 current_checkpoint_id 恢复到 checkpoints 列表中的最新 checkpoint。
    这个操作用于撤销之前的回滚操作，让系统回到最新的状态。

    示例场景：
    - 原始状态：checkpoints=[c1,c2,c3,c4], current_checkpoint_id=c4
    - 执行回滚到c2后：current_checkpoint_id=c2
    - 执行撤回回滚后：current_checkpoint_id=c4（回到最新状态）

    ⚠️ 注意：
    - 如果当前已经是最新状态，则不执行任何操作
    - 此操作会将系统状态恢复到最新的 checkpoint
    - 操作过程中会恢复文件状态和聊天历史

    Returns:
        撤回回滚执行结果
    """
    try:
        logger.info("开始执行撤回回滚操作")

        await rollback_service.undo_rollback()

        return create_success_response(
            message="撤回回滚操作执行成功",
            data={
                "status": "completed",
                "message": "系统已恢复到最新checkpoint状态"
            }
        )

    except RollbackException as e:
        logger.error(f"撤回回滚操作异常: {e}")
        return create_error_response(message=e.message, code=e.code)

    except Exception as e:
        logger.error(f"撤回回滚失败: {e}")
        return create_error_response(
            message="撤回回滚操作失败，请联系系统管理员"
        )


@router.post("/rollback/check", response_model=BaseResponse)
async def check_rollback(request: CheckRollbackRequestDTO):
    """
    检查是否可以回滚到指定checkpoint

    检查指定的target_message_id是否存在对应的checkpoint，
    如果找不到则返回can_rollback=False的标记。

    Args:
        request: 检查回滚请求参数

    Returns:
        检查结果，包含是否可以回滚的布尔标记
    """
    try:
        logger.info(f"检查回滚可行性，目标checkpoint: {request.target_message_id}")

        # 调用服务层方法检查回滚可行性
        can_rollback = await checkpoint_service.can_rollback_to_checkpoint(request.target_message_id)

        # 构造响应数据
        response_data = CheckRollbackResponseDTO(
            can_rollback=can_rollback
        )

        return create_success_response(
            message=f"检查回滚可行性完成",
            data=response_data.model_dump()
        )

    except Exception as e:
        logger.error(f"检查回滚可行性失败: {e}")
        return create_error_response(
            message="检查回滚可行性失败，请联系系统管理员"
        )
