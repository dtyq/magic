from fastapi import APIRouter
import traceback

from app.api.http_dto.response import (
    BaseResponse,
    create_success_response,
    create_error_response
)
from app.api.http_dto.workspace import (
    WorkspaceExportRequest,
    WorkspaceStatusData,
    WorkspaceStatusesData,
    WorkspaceExportData,
    WorkspaceImportRequest,
    WorkspaceImportData,
    WorkspaceExportTaskRequest,
    WorkspaceExportTaskData,
)
from app.service.sandbox_task.models import SandboxTask
from app.service.sandbox_task.task_manager import SandboxTaskManager
from app.service.sandbox_task.capability_runner import run_capability
from agentlang.path_manager import PathManager
from app.service.agent_dispatcher import AgentDispatcher
from app.service.workspace_export_service import export_workspace
from app.service.workspace_import_service import import_workspace_from_url
from app.core.entity.workspace_status import WorkspaceStatus
from agentlang.logger import get_logger

router = APIRouter(prefix="/v1/workspace", tags=["工作区管理"])

logger = get_logger(__name__)


def _export_task_response(task: SandboxTask) -> dict:
    output = task.output or {}
    status = task.status.value if hasattr(task.status, "value") else str(task.status)
    progress = {
        "queued": 0,
        "preparing": 10,
        "running": 60,
        "finalizing": 90,
        "completed": 100,
    }.get(status, 0)
    return WorkspaceExportTaskData(
        task_key=task.task_id,
        status=status,
        progress=progress,
        file_key=output.get("file_key"),
        metadata=output.get("metadata") or {},
        error=task.error_message,
    ).model_dump()


@router.post("/export/create", response_model=BaseResponse)
async def create_workspace_export_endpoint(request: WorkspaceExportTaskRequest) -> BaseResponse:
    """幂等创建工作区异步导出任务。"""
    try:
        task = await SandboxTaskManager.instance().create_or_get(
            task_id=request.task_key,
            capability="workspace_export",
            project_path=str(PathManager.get_workspace_dir().resolve()),
            payload=request.model_dump(exclude={"task_key"}),
            worker=run_capability,
        )
        return create_success_response("工作区导出任务已提交", _export_task_response(task))
    except ValueError as error:
        return create_error_response(str(error), {"task_key": request.task_key}, code=4000)


@router.get("/export/check", response_model=BaseResponse)
async def check_workspace_export_endpoint(task_key: str) -> BaseResponse:
    """查询工作区异步导出任务。"""
    task = await SandboxTaskManager.instance().get(task_key)
    if task is None:
        return create_error_response("工作区导出任务不存在", {"task_key": task_key}, code=4004)
    data = _export_task_response(task)
    if data["status"] == "failed":
        return create_error_response(task.error_message or "工作区导出失败", data, code=4001)
    return create_success_response("工作区导出任务状态", data)


@router.get("/info", response_model=BaseResponse)
async def get_workspace_info() -> BaseResponse:
    """返回工作区的绝对路径等基本信息，供本地调试客户端构造 file:// URL"""
    try:
        workspace_dir = PathManager.get_workspace_dir()
        return create_success_response(
            message="获取工作区信息成功",
            data={"workspace_path": str(workspace_dir.resolve())},
        )
    except Exception as e:
        logger.error(f"获取工作区信息失败: {e}")
        return create_error_response(message=f"获取工作区信息失败: {e}")


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
            logger.debug("AgentDispatcher实例不存在，工作区未初始化")
        else:
            # 根据is_workspace_initialized字段映射状态
            is_initialized = agent_dispatcher.is_workspace_initialized
            status = WorkspaceStatus.from_boolean(is_initialized)
            logger.debug(f"AgentDispatcher存在，初始化状态: {is_initialized}, 状态码: {status}")

        # 构造响应数据
        status_data = WorkspaceStatusData(
            status=status,
            description=WorkspaceStatus.get_description(status),
        )

        logger.debug(f"工作区状态查询成功: {status_data.model_dump()}")

        return create_success_response(
            message="获取工作区状态成功",
            data=status_data.model_dump()
        )

    except Exception as e:
        logger.error(f"获取工作区状态失败: {e}")
        logger.error(traceback.format_exc())

        # 构造错误状态数据
        error_data = WorkspaceStatusData(
            status=WorkspaceStatus.ERROR,
            description=WorkspaceStatus.get_description(WorkspaceStatus.ERROR),
        )

        return create_error_response(
            message="获取工作区状态失败",
            data=error_data.model_dump()
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

        statuses_data = WorkspaceStatusesData(
            statuses={str(k): v for k, v in all_statuses.items()}
        )

        logger.info("成功获取所有工作区状态码")

        return create_success_response(
            message="获取状态码列表成功",
            data=statuses_data.model_dump()
        )

    except Exception as e:
        logger.error(f"获取状态码列表失败: {e}")
        logger.error(traceback.format_exc())

        return create_error_response(
            message="获取状态码列表失败"
        )


@router.post("/export", response_model=BaseResponse)
async def export_workspace_endpoint(request: WorkspaceExportRequest) -> BaseResponse:
    """Package and upload current workspace, returning file key and metadata."""
    try:
        result = await export_workspace(
            export_type=request.type,
            code=request.code,
            upload_config=request.upload_config,
            public_upload_config=request.public_upload_config,
            source_path=request.source_path,
            archive_root=request.archive_root,
            file_name=request.file_name,
            exclude_paths=request.exclude_paths,
            skills_md_hash=request.skills_md_hash,
        )
        response_data = WorkspaceExportData.model_validate(result)

        return create_success_response(
            message="Workspace exported successfully",
            data=response_data.model_dump(),
        )

    except ValueError as exc:
        logger.error(f"Invalid export request: {exc}")
        return create_error_response(
            message=str(exc),
            data=None,
        )
    except Exception as exc:
        logger.error(f"Workspace export failed: {exc}")
        logger.error(traceback.format_exc())
        return create_error_response(
            message=f"Workspace export failed: {exc}",
            data=None,
        )


@router.post("/import", response_model=BaseResponse)
async def import_workspace_endpoint(request: WorkspaceImportRequest) -> BaseResponse:
    """Download a ZIP archive and extract it into current workspace."""
    try:
        result = await import_workspace_from_url(request.url, request.target_dir)
        response_data = WorkspaceImportData.model_validate(result)

        return create_success_response(
            message="Workspace imported successfully",
            data=response_data.model_dump(),
        )
    except ValueError as exc:
        logger.error(f"Invalid import request: {exc}")
        return create_error_response(
            message=str(exc),
            data=None,
        )
    except Exception as exc:
        logger.error(f"Workspace import failed: {exc}")
        logger.error(traceback.format_exc())
        return create_error_response(
            message=f"Workspace import failed: {exc}",
            data=None,
        )
