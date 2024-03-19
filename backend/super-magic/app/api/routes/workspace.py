from fastapi import APIRouter
import traceback
from typing import Dict, Any

from app.api.http_dto.response import (
    BaseResponse,
    create_success_response,
    create_error_response
)
from app.service.agent_dispatcher import AgentDispatcher
from app.core.entity.workspace_status import WorkspaceStatus
from agentlang.logger import get_logger

router = APIRouter(prefix="/v1/workspace", tags=["工作区管理"])

logger = get_logger(__name__)


@router.get("/status", response_model=BaseResponse)
async def get_workspace_status() -> BaseResponse:
    """
    获取工作区初始化状态

    该接口用于检查当前工作区是否已经完成初始化。
    返回标准化的状态码和描述信息。

    工作区状态说明：
    - 0: 未初始化 - AgentDispatcher未创建或未初始化
    - 1: 正在初始化 - 预留状态，暂未使用
    - 2: 初始化完成 - 工作区完全可用
    - -1: 初始化错误 - 初始化过程中发生异常

    Returns:
        BaseResponse: 响应对象
            - code: 响应状态码 (1000=成功, 2000=失败)
            - message: 响应消息
            - data: 包含status和description的字典

    Raises:
        Exception: 当系统异常时会被捕获并返回错误状态

    """
    try:
        # 获取AgentDispatcher实例
        agent_dispatcher = AgentDispatcher.get_instance()

        # 确定工作区状态
        if agent_dispatcher is None:
            # AgentDispatcher未初始化
            status = WorkspaceStatus.NOT_INITIALIZED
            logger.info("AgentDispatcher实例不存在，工作区未初始化")
        else:
            # 根据is_workspace_initialized字段映射状态
            is_initialized = agent_dispatcher.is_workspace_initialized
            status = WorkspaceStatus.from_boolean(is_initialized)
            logger.info(f"AgentDispatcher存在，初始化状态: {is_initialized}, 状态码: {status}")

        # 构造响应数据
        status_data = {
            "status": status,
            "description": WorkspaceStatus.get_description(status)
        }

        logger.info(f"工作区状态查询成功: {status_data}")

        return create_success_response(
            message="获取工作区状态成功",
            data=status_data
        )

    except Exception as e:
        logger.error(f"获取工作区状态失败: {e}")
        logger.error(traceback.format_exc())

        # 构造错误状态数据
        error_data = {
            "status": WorkspaceStatus.ERROR,
            "description": WorkspaceStatus.get_description(WorkspaceStatus.ERROR)
        }

        return create_error_response(
            message="获取工作区状态失败",
            data=error_data
        )


@router.get("/status/all", response_model=BaseResponse)
async def get_all_workspace_statuses() -> BaseResponse:
    """
    获取所有可能的工作区状态码和描述

    该接口用于获取所有定义的工作区状态码及其描述信息，
    便于前端了解所有可能的状态值。

    Returns:
        BaseResponse: 响应对象，包含所有状态码映射

    Example:
        ```bash
        curl -X GET "http://localhost:8000/v1/workspace/status/all"
        ```

        Response:
        ```json
        {
            "code": 1000,
            "message": "获取状态码列表成功",
            "data": {
                "statuses": {
                    "0": "未初始化",
                    "1": "正在初始化",
                    "2": "初始化完成",
                    "-1": "初始化错误"
                }
            }
        }
        ```
    """
    try:
        all_statuses = WorkspaceStatus.get_all_statuses()

        # 将int键转换为字符串，符合JSON标准
        statuses_data = {
            "statuses": {str(k): v for k, v in all_statuses.items()}
        }

        logger.info("成功获取所有工作区状态码")

        return create_success_response(
            message="获取状态码列表成功",
            data=statuses_data
        )

    except Exception as e:
        logger.error(f"获取状态码列表失败: {e}")
        logger.error(traceback.format_exc())

        return create_error_response(
            message="获取状态码列表失败"
        )
