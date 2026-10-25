"""通用沙箱任务 API。"""

from fastapi import APIRouter, Body

from app.api.http_dto.response import BaseResponse, create_error_response, create_success_response
from app.api.http_dto.sandbox_task_dto import CreateSandboxTaskRequest, SandboxTaskResponse
from app.service.sandbox_task.models import SandboxTask
from app.service.sandbox_task.task_manager import SandboxTaskManager
from app.service.sandbox_task.capability_runner import run_capability


router = APIRouter(prefix="/sandbox/tasks", tags=["通用沙箱任务"])


def _response(task: SandboxTask) -> SandboxTaskResponse:
    """把内部任务快照转换为 HTTP 响应模型。"""
    return SandboxTaskResponse(
        task_id=task.task_id,
        capability=task.capability,
        status=task.status.value if hasattr(task.status, "value") else str(task.status),
        output=task.output,
        error_message=task.error_message,
        created_at=task.created_at.isoformat(),
        updated_at=task.updated_at.isoformat(),
    )


@router.post("", response_model=BaseResponse)
async def create_sandbox_task(request: CreateSandboxTaskRequest = Body(...)) -> BaseResponse:
    """幂等创建并异步执行沙箱任务。"""
    try:
        task = await SandboxTaskManager.instance().create_or_get(
            task_id=request.task_id,
            capability=request.capability,
            project_path=request.project_path,
            payload=request.payload,
            worker=run_capability,
        )
        return create_success_response("沙箱任务已提交", _response(task).model_dump())
    except ValueError as error:
        return create_error_response(str(error), {"task_id": request.task_id})


@router.get("/{task_id}", response_model=BaseResponse)
async def get_sandbox_task(task_id: str) -> BaseResponse:
    """查询沙箱任务状态和结果。"""
    task = await SandboxTaskManager.instance().get(task_id)
    if task is None:
        return create_error_response("沙箱任务不存在", {"task_id": task_id}, code=4004)
    response = _response(task)
    if (task.status.value if hasattr(task.status, "value") else task.status) == "failed":
        return create_error_response(task.error_message or "沙箱任务失败", response.model_dump())
    return create_success_response("沙箱任务状态", response.model_dump())


@router.post("/{task_id}/cancel", response_model=BaseResponse)
async def cancel_sandbox_task(task_id: str) -> BaseResponse:
    """取消尚未完成的沙箱任务。"""
    task = await SandboxTaskManager.instance().cancel(task_id)
    if task is None:
        return create_error_response("沙箱任务不存在", {"task_id": task_id}, code=4004)
    return create_success_response("沙箱任务已取消", _response(task).model_dump())
