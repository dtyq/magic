"""
ASR 音频合并 API 路由

提供ASR音频合并任务管理的HTTP接口（RESTful风格）
"""

import asyncio
import traceback

from fastapi import APIRouter, Body
from loguru import logger

from app.api.http_dto.asr_dto import (
    AsrTaskResponse,
    CancelAsrTaskRequest,
    CreateAsrTaskRequest,
    FinalizeAsrTaskRequest,
    QueryAsrTaskRequest,
)
from app.api.http_dto.response import BaseResponse, create_error_response, create_success_response
from app.service.asr.asr_merge_service import AsrMergeService
from app.service.asr.asr_merge_task_manager import AsrMergeTaskManager, AsrTaskResult, AsrTaskStatus
from app.service.asr.asr_time_config import asr_time_config

router = APIRouter(prefix="/asr", tags=["ASR音频合并"])


def _build_task_response(task: AsrTaskResult) -> AsrTaskResponse:
    """
    从任务对象构建 AsrTaskResponse

    Args:
        task: 任务结果对象

    Returns:
        AsrTaskResponse: 响应数据对象
    """
    return AsrTaskResponse(
        status=task.status,
        task_key=task.task_key,
        audio_format=task.audio_format,
        intelligent_title=task.intelligent_title,
        error_message=task.error_message or task.audio_format_error,
        files=task.files,
        deleted_files=task.deleted_files,
        operations=task.operations,
        degraded=task.degraded,
        completion_mode=task.completion_mode,
        missing_shard_indices=task.missing_shard_indices,
    )


async def _resolve_finish_file_shard_count(audio_config, workspace_dir: str, task_key: str | None = None) -> int | None:
    """
    获取 finish 使用的分片总数（file_shard_count）。

    只接受客户端明确声明的数量。历史客户端不传时返回 None，
    由后续稳定扫描逻辑兼容处理，不能把某次目录扫描结果固化成声明数量。

    Args:
        audio_config: finish 请求中的 audio 配置
        workspace_dir: 工作区目录

    Returns:
        int | None: 客户端声明的分片总数；历史客户端返回 None
    """
    incoming_count = getattr(audio_config, "file_shard_count", None)
    if incoming_count is None:
        logger.info("[asrmerge] finish 未声明 file_shard_count，使用历史客户端兼容模式")
        return None
    if isinstance(incoming_count, bool) or not isinstance(incoming_count, int) or incoming_count <= 0:
        raise ValueError("file_shard_count must be a positive integer")
    logger.info(f"[asrmerge] finish 使用客户端 file_shard_count: {incoming_count}")
    return incoming_count


async def _get_task_and_check_completed_or_error(
    task_key: str,
    allow_error_retry: bool = False,
    force_reset: bool = False,
) -> tuple[BaseResponse | None, AsrTaskResult | None]:
    """
    查询任务并检查是否已完成或出错

    如果任务不存在、已完成或出错，返回相应的响应；否则返回 None 和任务对象

    Args:
        task_key: 任务标识符
        allow_error_retry: 任务处于 error 时是否尝试重试
        force_reset: allow_error_retry 为 True 时，是否忽略重试上限并重置计数（手动重新合并）

    Returns:
        tuple: (错误/完成响应或None, 任务对象或None)
    """
    existing_task = await AsrMergeTaskManager.instance().get_task(task_key)

    if not existing_task:
        logger.warning(f"[asrmerge] 任务不存在: {task_key}")
        return (
            create_error_response(
                message=f"任务不存在: {task_key}",
                data={"task_key": task_key},
                code=4004
            ),
            None
        )

    # 如果任务已经完成，直接返回结果
    if existing_task.status in [AsrTaskStatus.COMPLETED.value, AsrTaskStatus.FINISHED.value]:
        response_data = _build_task_response(existing_task)
        logger.info(
            f"📤 [asrmerge] 任务已完成: task_key={task_key}, "
            f"status={existing_task.status}"
        )
        return (
            create_success_response(
                message="音频合并已完成",
                data=response_data.model_dump()
            ),
            None
        )

    # 如果任务出错，返回错误
    if existing_task.status == AsrTaskStatus.ERROR.value:
        # 普通重复 finish 是幂等查询，不得重新开启等待窗口。
        # 只有调用方显式 force_reset 才允许从 error 状态人工重试。
        if allow_error_retry and force_reset:
            retry_ok, retry_count, max_retries = await AsrMergeTaskManager.instance().request_retry(
                task_key, force=True
            )
            if retry_ok:
                existing_task = await AsrMergeTaskManager.instance().get_task(task_key)
                if existing_task is not None:
                    logger.warning(
                        f"🔁 [asrmerge] task_key={task_key} ERROR 任务进入重试: "
                        f"retry_count={retry_count}/{max_retries} force_reset=True"
                    )
                    return None, existing_task
            response_data = _build_task_response(existing_task)
            return (
                create_error_response(
                    message=f"任务重试次数已达上限或重试失败 ({retry_count}/{max_retries})",
                    data=response_data.model_dump(),
                ),
                None,
            )

        response_data = _build_task_response(existing_task)
        # 关键日志：finish/query 在 error 状态会直接返回，不会进入文件就绪检测/完成流程
        logger.warning(
            f"⚠️ [asrmerge] task_key={task_key} 当前为 error，直接返回错误响应；"
            f"不会进入文件检测/完成流程。error_message={existing_task.error_message}"
        )
        return (
            create_error_response(
                message=existing_task.error_message or "音频合并失败",
                data=response_data.model_dump()
            ),
            None
        )

    return None, existing_task


async def _get_task_and_check_exists(
    task_key: str,
    not_found_message: str = "ASR task not found",
    not_found_code: int = 4004
) -> tuple[BaseResponse | None, AsrTaskResult | None]:
    """
    查询任务并检查是否存在

    如果任务不存在，返回错误响应；否则返回 None 和任务对象

    Args:
        task_key: 任务标识符
        not_found_message: 任务不存在时的错误消息
        not_found_code: 任务不存在时的错误代码

    Returns:
        tuple: (错误响应或None, 任务对象或None)
    """
    existing_task = await AsrMergeTaskManager.instance().get_task(task_key)

    if not existing_task:
        logger.warning(f"[asrmerge] 任务不存在: {task_key}")
        return (
            create_error_response(
                message=not_found_message,
                data={
                    "task_key": task_key,
                    "error": "Task not found or already completed"
                },
                code=not_found_code
            ),
            None
        )

    return None, existing_task


async def _get_task_and_check_completed_for_cancel(
    task_key: str
) -> tuple[BaseResponse | None, AsrTaskResult | None]:
    """
    查询任务并检查是否已完成（用于cancel接口）

    如果任务不存在或已完成，返回错误响应；否则返回 None 和任务对象

    Args:
        task_key: 任务标识符

    Returns:
        tuple: (错误响应或None, 任务对象或None)
    """
    error_response, existing_task = await _get_task_and_check_exists(
        task_key,
        not_found_message="ASR task not found",
        not_found_code=4004
    )
    if error_response:
        return error_response, None

    # 类型断言：如果 error_response 为 None，则 existing_task 一定不为 None
    assert existing_task is not None, "existing_task should not be None when error_response is None"

    # 如果任务已完成，不允许取消
    if existing_task.status in [
        AsrTaskStatus.COMPLETED.value,
        AsrTaskStatus.FINISHED.value
    ]:
        logger.warning(
            f"⚠️ [asrmerge] 任务已完成，不允许取消: task_key={task_key}, "
            f"status={existing_task.status}"
        )
        return (
            create_error_response(
                message="Cannot cancel completed task",
                data={
                    "task_key": task_key,
                    "status": existing_task.status,
                    "error": "Task has already completed successfully"
                },
                code=4009
            ),
            None
        )

    return None, existing_task


async def _check_and_return_task_status(
    task_key: str,
    existing_task: AsrTaskResult,
    workspace_dir: str,
    intelligent_title: str | None = None
) -> BaseResponse:
    """
    检查轮询状态并返回任务当前状态的内部共享函数

    由 query 和 finish 接口共同使用，保证任务能顺利完成

    ⚠️ 重要：此函数不会修改任务状态，不会标记 upload_completed
    只有 finish 接口会调用 finalize_task_config 来标记上传完成

    功能：
    1. 检测轮询是否还在运行，如果停止则重启（保护机制）
    2. 检查是否有 merged.wav 并返回文件信息
    3. 构建并返回统一的响应格式

    Args:
        task_key: 任务标识符
        existing_task: 任务结果对象
        workspace_dir: 工作目录
        intelligent_title: 智能标题（可选，finish 接口会传入）

    Returns:
        BaseResponse: 包含任务状态的响应
    """
    # 1. 检测轮询是否还在运行
    asr_merge_service = AsrMergeService.instance()
    task = asr_merge_service.tasks.get(task_key)
    is_polling = task and task.asyncio_task and not task.asyncio_task.done()

    if not is_polling:
        # 轮询已停止，重新启动
        logger.info(f"🔄 [asrmerge] 轮询已停止，重新启动: {task_key}")
        await asr_merge_service.start_monitoring_task(
            task_key,
            existing_task.source_dir,
            workspace_dir
        )
    else:
        logger.debug(f"✅ [asrmerge] 轮询正在运行: {task_key}")

    # 1.5 读取最新任务状态（start_monitoring_task 可能已更新状态文件）
    latest_task = await AsrMergeTaskManager.instance().get_task(task_key)
    if latest_task:
        existing_task = latest_task
    progress = await AsrMergeTaskManager.instance().get_progress(task_key)

    # 状态可能在轮询过程中变为 completed/finished，此时直接返回完整结果
    if existing_task.status in [AsrTaskStatus.COMPLETED.value, AsrTaskStatus.FINISHED.value]:
        response_data = _build_task_response(existing_task)
        logger.info(
            f"📤 [asrmerge] 任务已完成(状态刷新): task_key={task_key}, "
            f"status={existing_task.status}"
        )
        return create_success_response(
            message="音频合并已完成",
            data=response_data.model_dump()
        )

    # 2. 检查是否有 merged 文件（返回当前进度，文件名按任务音频格式解析）
    from app.service.asr.asr_utils import (
        build_merged_filename,
        normalize_audio_format,
        resolve_audio_format_from_directory,
        resolve_path,
    )
    source_dir = resolve_path(existing_task.source_dir, workspace_dir)
    try:
        resolved_format = resolve_audio_format_from_directory(source_dir, existing_task.audio_format)
    except ValueError as exc:
        logger.warning(f"[asrmerge] task_key={task_key} merged 文件格式冲突: {exc}")
        resolved_format = None
    merged_file = source_dir / build_merged_filename(resolved_format or normalize_audio_format(existing_task.audio_format))

    files_info = None
    expose_staging_file = existing_task.audio_format != "opus"
    if merged_file.exists() and expose_staging_file:
        file_size = merged_file.stat().st_size

        # 获取音频时长（使用 ffprobe）
        duration = 0
        try:
            process = await asyncio.create_subprocess_exec(
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(merged_file),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, _ = await asyncio.wait_for(process.communicate(), timeout=asr_time_config.FFPROBE_TIMEOUT)

            if process.returncode == 0 and stdout:
                duration_str = stdout.decode().strip()
                if duration_str:
                    duration = round(float(duration_str))
        except Exception as e:
            logger.debug(f"[asrmerge] 无法获取音频时长: {e}")

        # 构建相对路径
        relative_path = f"{existing_task.source_dir}/{merged_file.name}"

        files_info = {
            "audio_file": {
                "filename": merged_file.name,
                "path": relative_path,
                "size": file_size,
                "duration": duration
            }
        }

    # 3. 返回状态
    response_status = existing_task.status
    response_error = existing_task.audio_format_error
    if existing_task.audio_format == "opus" and progress and existing_task.status == AsrTaskStatus.RUNNING.value:
        # Opus 内部状态不扩散为新的 API 枚举，保持客户端兼容。
        # 合并/最终搬运期间统一复用已有 finalizing；可重试失败仍保持 running，
        # 真正超过截止时间后任务管理器会把任务置为 error。
        if progress.opus_merge_status in {"merging", "completed"}:
            response_status = AsrTaskStatus.FINALIZING.value

    response_data = AsrTaskResponse(
        status=response_status,
        task_key=task_key,
        audio_format=existing_task.audio_format,
        intelligent_title=intelligent_title or existing_task.intelligent_title,
        error_message=response_error,
        files=files_info,
        deleted_files=None,
        operations=None
    )

    logger.info(
        f"📤 [asrmerge] 响应任务状态: task_key={task_key}, "
        f"status={existing_task.status}, has_merged={bool(files_info)}"
    )

    return create_success_response(
        message=f"任务状态: {existing_task.status}",
        data=response_data.model_dump()
    )


@router.post("/task/start", response_model=BaseResponse, summary="创建并启动ASR合并任务")
async def create_asr_task(
    request: CreateAsrTaskRequest = Body(...)
) -> BaseResponse:
    """
    创建并启动ASR音频合并任务

    创建新的音频合并任务，并开始监听指定目录下的音频文件，
    自动进行增量合并。

    Args:
        request: 任务创建请求，包含任务配置信息

    Returns:
        BaseResponse: 包含任务状态的响应

    Raises:
        400: 请求参数错误
        500: 服务器内部错误
    """
    try:
        logger.info(
            f"📥 [asrmerge] 收到创建任务请求: task_key={request.task_key}, "
            f"source_dir={request.source_dir}, workspace_dir={request.workspace_dir or '.workspace'}, "
            f"note_file={bool(request.note_file)}, transcript_file={bool(request.transcript_file)}"
        )

        # 将配置对象转为字典（如果存在）
        note_file_config = request.note_file.model_dump() if request.note_file else None
        transcript_file_config = request.transcript_file.model_dump() if request.transcript_file else None

        # 原子性地获取或创建任务（解决 TOCTOU 竞态条件）
        task, created = await AsrMergeTaskManager.instance().get_or_create_task(
            task_key=request.task_key,
            source_dir=request.source_dir,
            note_file_config=note_file_config,
            transcript_file_config=transcript_file_config
        )

        # 如果任务已存在（非新创建）
        if not created:
            # 检查任务是否真的在运行（服务重启后，状态文件可能是 running，但实际任务可能已停止）
            monitor_task = AsrMergeService.instance().tasks.get(request.task_key)
            is_actually_running = monitor_task and monitor_task.asyncio_task and not monitor_task.asyncio_task.done()

            # 定义已完成的状态（这些状态不需要恢复）
            completed_statuses = {
                AsrTaskStatus.COMPLETED.value,
                AsrTaskStatus.FINISHED.value
            }

            # 如果任务未完成且实际没有在运行，尝试恢复任务
            if task.status not in completed_statuses and not is_actually_running:
                logger.info(
                    f"🔄 [asrmerge] 检测到任务未完成但实际未运行，尝试恢复: "
                    f"task_key={request.task_key}, status={task.status}"
                )
                # 尝试重新启动监听任务
                success = await AsrMergeService.instance().start_monitoring_task(
                    task_key=request.task_key,
                    source_dir=request.source_dir,
                    workspace_dir=request.workspace_dir or ".workspace"
                )
                if success:
                    logger.info(f"✅ [asrmerge] 任务恢复成功: task_key={request.task_key}")
                else:
                    logger.warning(f"⚠️ [asrmerge] 任务恢复失败: task_key={request.task_key}")

            # 任务已存在，返回当前状态
            response_data = _build_task_response(task)

            # 如果任务是错误状态，返回错误响应（code=2000）
            if task.status == AsrTaskStatus.ERROR.value:
                logger.info(
                    f"📤 [asrmerge] 响应（任务已存在-错误）: task_key={request.task_key}, "
                    f"status={task.status}, error={task.error_message}"
                )
                return create_error_response(
                    message=task.error_message or "任务执行失败",
                    data=response_data.model_dump()
                )

            # 其他状态，返回成功响应（code=1000）
            logger.info(
                f"📤 [asrmerge] 响应（任务已存在）: task_key={request.task_key}, "
                f"status={task.status}"
            )
            return create_success_response(
                message=f"任务已存在，当前状态: {task.status}",
                data=response_data.model_dump()
            )

        # 任务是新创建的，启动监听
        logger.info(f"✅ [asrmerge] 创建新任务成功（原子操作）: {request.task_key}")

        # 启动监听任务（幂等操作：如果已启动则返回 True）
        success = await AsrMergeService.instance().start_monitoring_task(
            task_key=request.task_key,
            source_dir=request.source_dir,
            workspace_dir=request.workspace_dir or ".workspace"
        )

        if success:
            response_data = AsrTaskResponse(
                status=AsrTaskStatus.RUNNING,
                task_key=request.task_key,
                audio_format=None,
                intelligent_title=None,
                error_message=None,
                files=None,
                deleted_files=None,
                operations=None
            )
            logger.info(
                f"📤 [asrmerge] 响应（成功）: task_key={request.task_key}, "
                f"status=running, message=任务已创建，开始监听音频文件"
            )
            return create_success_response(
                message="任务已创建，开始监听音频文件",
                data=response_data.model_dump()
            )
        else:
            logger.error(
                f"📤 [asrmerge] 响应（失败）: task_key={request.task_key}, "
                f"message=启动监听任务失败"
            )
            return create_error_response(
                message="启动监听任务失败",
                data={"task_key": request.task_key}
            )

    except ValueError as e:
        logger.warning(f"ASR任务创建参数错误: {e}")
        return create_error_response(
            message=f"请求参数错误: {e!s}",
            data={"error": str(e)}
        )

    except Exception as e:
        logger.error(f"[asrmerge] 创建ASR任务失败: {e}")
        logger.error(traceback.format_exc())
        return create_error_response(
            message="创建任务失败，请稍后重试",
            data={"error": str(e)}
        )


@router.post("/task/finish", response_model=BaseResponse, summary="标记上传完成并重启轮询")
async def finish_asr_task(
    request: FinalizeAsrTaskRequest = Body(...)
) -> BaseResponse:
    """
    标记上传完成，触发任务完成流程

    ⚠️ 与 query 的关键区别：
    - finish 会标记 upload_completed = True，告知服务端所有文件已上传完成
    - query 不会标记 upload_completed，只是纯查询

    工作流程：
    1. 保存 target_dir、intelligent_title、note_file_config、transcript_file_config 到任务状态
    2. **设置 upload_completed = True 标志**（这是触发完成的关键）
    3. 检测轮询是否还在运行，如果已停止则重新启动
    4. 返回当前状态和已合并的文件信息（如果有 merged.wav）

    后台轮询逻辑：
    - 轮询检测到 upload_completed=True 且所有文件已合并完成时
    - 自动执行完成流程（移动文件、更新状态为 completed）

    Args:
        request: 包含 audio、note_file、transcript_file 配置对象

    Returns:
        BaseResponse: 包含当前任务状态的响应

    Raises:
        404: 任务不存在
        500: 服务器内部错误
    """
    try:
        task_key = request.task_key

        logger.info(
            f"📥 [asrmerge] 收到 finish 请求: task_key={task_key}, "
            f"workspace_dir={request.workspace_dir or '.workspace'}"
        )
        logger.info(f"📦 [asrmerge] finish 请求体: {request.model_dump()}")
        workspace_dir = request.workspace_dir or ".workspace"

        # 1. 查询任务状态。已完成/已失败/不存在的任务直接返回，不触发分片扫描。
        error_response, existing_task = await _get_task_and_check_completed_or_error(
            task_key,
            allow_error_retry=True,
            force_reset=request.force_reset,
        )
        if error_response:
            return error_response

        # 类型断言：如果 error_response 为 None，则 existing_task 一定不为 None
        assert existing_task is not None, "existing_task should not be None when error_response is None"

        effective_file_shard_count = await _resolve_finish_file_shard_count(request.audio, workspace_dir, task_key)
        logger.info(
            f"[asrmerge] finish effective_file_shard_count={effective_file_shard_count}, task_key={task_key}"
        )

        # 2. 原子性地保存配置并标记上传完成（解决多次更新的原子性问题）
        success = await AsrMergeTaskManager.instance().finalize_task_config(
            task_key=task_key,
            target_dir=request.audio.target_dir,
            intelligent_title=request.audio.output_filename,
            file_shard_count=effective_file_shard_count,
            note_file_config=request.note_file.model_dump() if request.note_file else None,
            transcript_file_config=request.transcript_file.model_dump() if request.transcript_file else None
        )

        if not success:
            logger.error(f"❌ [asrmerge] 更新任务配置失败: {task_key}")
            return create_error_response(
                message="更新任务配置失败",
                data={"task_key": task_key}
            )

        logger.info(f"✅ [asrmerge] 已标记上传完成并保存配置: {task_key}")

        # 3. 使用共享逻辑检查轮询状态并返回
        return await _check_and_return_task_status(
            task_key=task_key,
            existing_task=existing_task,
            workspace_dir=workspace_dir,
            intelligent_title=request.audio.output_filename
        )

    except ValueError as e:
        logger.warning(f"[asrmerge] finish 参数校验失败: {e}")
        return create_error_response(
            message=str(e),
            data={"task_key": request.task_key},
            code=4001,
        )
    except Exception as e:
        logger.error(f"[asrmerge] finish 接口失败: {e}")
        logger.error(traceback.format_exc())
        return create_error_response(
            message="处理失败，请稍后重试",
            data={"error": str(e)}
        )


@router.post("/task/query", response_model=BaseResponse, summary="查询ASR任务状态")
async def query_asr_task(
    request: QueryAsrTaskRequest = Body(...)
) -> BaseResponse:
    """
    查询ASR音频合并任务状态（纯查询接口）

    ⚠️ 与 finish 的关键区别：
    - query **不会**标记 upload_completed，不会触发任务完成
    - finish 会标记 upload_completed = True，触发完成流程

    功能：
    - 查询任务当前状态
    - 检查轮询是否运行，如果停止则重启（保护机制）
    - 返回当前合并进度（如果有 merged.wav）

    与 finish 接口共享相同的内部检查逻辑，保证任务能顺利完成，
    但 query 不会修改任务状态，不会标记上传完成。

    返回的状态包括：
    - waiting: 任务已创建，等待开始
    - running: 任务正在监听和处理音频文件
    - finalizing: 任务正在执行最终合并操作
    - completed: 任务已成功完成，返回文件详情
    - error: 任务执行失败，返回错误信息
    - canceled: 任务已取消

    Args:
        request: 查询请求，包含任务标识符

    Returns:
        BaseResponse: 包含任务状态的响应

    Raises:
        404: 任务不存在
        500: 服务器内部错误
    """
    try:
        task_key = request.task_key

        logger.info(
            f"📥 [asrmerge] 收到查询请求: task_key={task_key}, "
            f"workspace_dir={request.workspace_dir or '.workspace'}"
        )

        # 1. 查询任务状态并检查是否已完成或出错
        error_response, existing_task = await _get_task_and_check_completed_or_error(task_key)
        if error_response:
            return error_response

        # 类型断言：如果 error_response 为 None，则 existing_task 一定不为 None
        assert existing_task is not None, "existing_task should not be None when error_response is None"

        # 4. 其他状态（waiting/running），使用共享逻辑检查轮询状态并返回
        return await _check_and_return_task_status(
            task_key=task_key,
            existing_task=existing_task,
            workspace_dir=request.workspace_dir or ".workspace"
        )

    except ValueError as e:
        logger.warning(f"查询ASR任务参数错误: {e}")
        return create_error_response(
            message=f"请求参数错误: {e!s}",
            data={"error": str(e)}
        )

    except Exception as e:
        logger.error(f"[asrmerge] 查询ASR任务失败: {e}")
        logger.error(traceback.format_exc())
        return create_error_response(
            message="查询任务失败，请稍后重试",
            data={"error": str(e)}
        )


@router.post("/task/cancel", response_model=BaseResponse, summary="取消ASR合并任务")
async def cancel_asr_task(
    request: CancelAsrTaskRequest = Body(...)
) -> BaseResponse:
    """
    取消ASR音频合并任务

    停止当前录音任务的处理，清理临时文件和资源。
    支持幂等性：多次调用返回相同结果。

    Args:
        request: 取消任务请求，包含任务标识符

    Returns:
        BaseResponse: 包含取消结果的响应

    Raises:
        404: 任务不存在
        500: 服务器内部错误
    """
    try:
        task_key = request.task_key
        logger.info(
            f"📥 [asrmerge] 收到取消请求: task_key={task_key}, "
            f"workspace_dir={request.workspace_dir or '.workspace'}"
        )

        # 检查任务是否存在并检查是否已完成
        error_response, existing_task = await _get_task_and_check_completed_for_cancel(task_key)
        if error_response:
            return error_response

        # 类型断言：如果 error_response 为 None，则 existing_task 一定不为 None
        assert existing_task is not None, "existing_task should not be None when error_response is None"

        # 执行取消操作（包括已经是 canceled 状态的幂等处理）
        success = await AsrMergeService.instance().cancel_task(
            task_key=task_key,
            workspace_dir=request.workspace_dir or ".workspace"
        )

        if success:
            response_data = AsrTaskResponse(
                status=AsrTaskStatus.CANCELED,
                task_key=task_key,
                audio_format=existing_task.audio_format,
                intelligent_title=None,
                error_message=None,
                files=None,
                deleted_files=None,
                operations=None
            )

            logger.info(
                f"📤 [asrmerge] 响应（成功）: task_key={task_key}, "
                f"status=canceled"
            )
            return create_success_response(
                message="ASR task canceled successfully",
                data=response_data.model_dump()
            )
        else:
            logger.error(
                f"📤 [asrmerge] 响应（失败）: task_key={task_key}"
            )
            return create_error_response(
                message="Failed to cancel task",
                data={"task_key": task_key}
            )

    except ValueError as e:
        logger.warning(f"ASR任务取消参数错误: {e}")
        return create_error_response(
            message=f"请求参数错误: {e!s}",
            data={"error": str(e)}
        )

    except Exception as e:
        logger.error(f"[asrmerge] 取消ASR任务失败: {e}")
        logger.error(traceback.format_exc())
        return create_error_response(
            message="取消任务失败，请稍后重试",
            data={"error": str(e)}
        )
