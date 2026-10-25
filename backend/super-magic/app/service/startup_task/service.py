"""
启动任务服务：沙盒每次启动后，在后台按顺序运行用户登记的脚本（典型用途是重装依赖）。

| 场景 | 行为 |
| --- | --- |
| 沙盒启动（on_runtime_ready） | 每个进程只跑一轮，后台顺序执行，不阻塞 INIT 和用户消息，不推送通知 |
| enabled=false | 不执行，记为 skipped_disabled |
| project_id 与当前项目不一致 | 不执行，记为 skipped_untrusted；需用户重新确认后才能启用 |
| Agent 试跑（run_now） | 立即运行一次，不看 enabled，仍检查项目一致；拿到后台任务 ID 就返回 |

结果只记在内存和日志里，Agent 遇到缺依赖等问题时用 startup_task_list 查询。
信任绑定防的是「别人项目里的脚本在我这里自动执行」，与 cron 同级，不做密码学防篡改。
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import ClassVar

from agentlang.config.config import config
from agentlang.logger import get_logger
from app.service.cron.utils import name_to_job_id
from app.service.env_manager.identity import EnvIdentityResolver
from app.service.startup_task import runner, store
from app.service.startup_task.models import (
    StartupTask,
    StartupTaskError,
    StartupTaskRunState,
    StartupTaskRunStatus,
    StartupTaskSettings,
)
from app.tools.shell_exec_utils.bg_task_models import BackgroundStartResult

logger = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class StartupTaskView:
    task: StartupTask
    state: StartupTaskRunState
    trusted: bool  # 任务的 project_id 与当前项目一致，沙盒启动时才会自动执行


@dataclass(frozen=True, slots=True)
class StartupTaskUpdateResult:
    task: StartupTask
    changed_fields: list[str]


class StartupTaskService:
    _instance: ClassVar[StartupTaskService | None] = None

    def __init__(self) -> None:
        self._states: dict[str, StartupTaskRunState] = {}
        self._startup_job: asyncio.Task[None] | None = None
        # 持有后台等待协程的引用，避免被垃圾回收；任务属于沙盒，用户停止对话时不取消
        self._wait_jobs: set[asyncio.Task[None]] = set()

    @classmethod
    def get_instance(cls) -> StartupTaskService:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    @staticmethod
    def load_settings() -> StartupTaskSettings:
        return StartupTaskSettings(
            default_timeout_seconds=int(config.get("startup_task.default_timeout_seconds", 900)),
            max_timeout_seconds=int(config.get("startup_task.max_timeout_seconds", 3600)),
            background_after_seconds=int(config.get("startup_task.background_after_seconds", 1)),
        )

    # ── 沙盒启动 ──────────────────────────────────────────────────────────────

    def start(self) -> None:
        """在后台启动本进程的一轮启动任务后立即返回；重复调用无副作用。"""
        if self._startup_job is not None:
            return
        self._startup_job = asyncio.create_task(self._run_startup_round())

    async def _run_startup_round(self) -> None:
        settings = self.load_settings()
        try:
            tasks = await store.scan_tasks(settings)
        except Exception:
            logger.exception("startup_task: 扫描启动任务失败，本轮不执行")
            return
        project_id = self._current_project_id()
        for task in tasks:
            state = self._get_state(task.task_id)
            if state.status == StartupTaskRunStatus.RUNNING:
                continue  # Agent 已经在试跑同一个任务
            if not task.enabled:
                state.status = StartupTaskRunStatus.SKIPPED_DISABLED
                logger.info(f"startup_task: 已停用，跳过 task_id={task.task_id}")
                continue
            if task.project_id != project_id:
                state.status = StartupTaskRunStatus.SKIPPED_UNTRUSTED
                logger.warning(
                    f"startup_task: 任务登记于其他项目，跳过 task_id={task.task_id} "
                    f"task_project_id={task.project_id} current_project_id={project_id}"
                )
                continue
            # 顺序执行：多个依赖安装同时跑会抢 CPU、网络和后台任务名额
            try:
                await runner.run_to_completion(task, state, settings)
            except Exception:
                logger.exception(f"startup_task: 运行异常 task_id={task.task_id}")

    # ── 查询与管理 ────────────────────────────────────────────────────────────

    async def list_tasks(self) -> list[StartupTaskView]:
        tasks = await store.scan_tasks(self.load_settings())
        project_id = self._current_project_id()
        return [
            StartupTaskView(task=task, state=self._get_state(task.task_id), trusted=task.project_id == project_id)
            for task in tasks
        ]

    async def create(
        self,
        name: str,
        script: str,
        workdir: str,
        timeout_seconds: int | None,
        enabled: bool,
        confirmed: bool,
    ) -> StartupTask:
        settings = self.load_settings()
        normalized_name = name.strip()
        if not normalized_name:
            raise StartupTaskError("invalid_name", "Task name must not be empty.")
        task_id = name_to_job_id(normalized_name)
        if await store.read_task(task_id, settings) is not None:
            raise StartupTaskError("task_exists", f"A startup task with ID {task_id} already exists.", task_id=task_id)
        task = StartupTask(
            task_id=task_id,
            name=normalized_name,
            enabled=enabled,
            workdir=await self._validate_workdir(workdir),
            timeout_seconds=self._validate_timeout(
                settings.default_timeout_seconds if timeout_seconds is None else timeout_seconds, settings
            ),
            project_id=self._current_project_id(),
            script=self._validate_script(script),
        )
        self._require_confirmation(confirmed)
        await store.write_task(task)
        logger.info(f"startup_task: 已登记 task_id={task_id} workdir={task.workdir} enabled={task.enabled}")
        return task

    async def update(
        self,
        task_id: str,
        name: str | None,
        script: str | None,
        workdir: str | None,
        timeout_seconds: int | None,
        enabled: bool | None,
        confirmed: bool,
    ) -> StartupTaskUpdateResult:
        """
        None 表示不修改该字段；task_id 即文件名，改名不改 ID。
        改脚本或传 enabled=true 时要求用户确认，并把任务重新绑定到当前项目；
        其余字段的修改不重新绑定，避免借改超时等小改动让别人项目的脚本获得信任。
        """
        settings = self.load_settings()
        task = await self._require_task(task_id, settings)
        changed: list[str] = []
        if name is not None:
            normalized_name = name.strip()
            if not normalized_name:
                raise StartupTaskError("invalid_name", "Task name must not be empty.")
            task.name = normalized_name
            changed.append("name")
        if script is not None:
            task.script = self._validate_script(script)
            changed.append("script")
        if workdir is not None:
            task.workdir = await self._validate_workdir(workdir)
            changed.append("workdir")
        if timeout_seconds is not None:
            task.timeout_seconds = self._validate_timeout(timeout_seconds, settings)
            changed.append("timeout_seconds")
        if enabled is not None:
            task.enabled = enabled
            changed.append("enabled")
        if not changed:
            raise StartupTaskError("no_changes", "No fields to update were provided.", task_id=task_id)
        if script is not None or enabled is True:
            self._require_confirmation(confirmed)
            task.project_id = self._current_project_id()
        await store.write_task(task)
        logger.info(f"startup_task: 已修改 task_id={task_id} fields={','.join(changed)}")
        return StartupTaskUpdateResult(task=task, changed_fields=changed)

    async def delete(self, task_id: str) -> StartupTaskRunState:
        """只删除定义，不终止正在运行的后台进程；返回本进程内的运行状态供调用方说明。"""
        if not await store.delete_task(task_id):
            raise StartupTaskError("task_not_found", f"Startup task {task_id} does not exist.", task_id=task_id)
        logger.info(f"startup_task: 已删除 task_id={task_id}")
        return self._states.pop(task_id, StartupTaskRunState())

    async def run_now(self, task_id: str) -> StartupTaskView:
        """立即运行一次：前台观察窗口内结束就带回结果，否则转为后台并返回后台任务 ID。"""
        settings = self.load_settings()
        task = await self._require_task(task_id, settings)
        state = self._get_state(task_id)
        if state.status == StartupTaskRunStatus.RUNNING:
            raise StartupTaskError(
                "already_running",
                f"Startup task {task_id} is already running.",
                task_id=task_id,
                background_task_id=state.background_task_id,
            )
        if task.project_id != self._current_project_id():
            raise StartupTaskError(
                "untrusted",
                f"Startup task {task_id} was confirmed in a different project.",
                task_id=task_id,
            )
        background = await runner.launch(task, state, settings)
        if background is not None:
            job = asyncio.create_task(self._wait_in_background(task, state, background))
            self._wait_jobs.add(job)
            job.add_done_callback(self._wait_jobs.discard)
        return StartupTaskView(task=task, state=state, trusted=True)

    async def _wait_in_background(
        self, task: StartupTask, state: StartupTaskRunState, background: BackgroundStartResult,
    ) -> None:
        try:
            await runner.wait_until_finished(task, state, background)
        except Exception:
            logger.exception(f"startup_task: 等待试跑结束失败 task_id={task.task_id}")
        logger.info(
            f"startup_task: 试跑结束 task_id={task.task_id} status={state.status} exit_code={state.exit_code}"
        )

    # ── 内部辅助 ──────────────────────────────────────────────────────────────

    def _get_state(self, task_id: str) -> StartupTaskRunState:
        return self._states.setdefault(task_id, StartupTaskRunState())

    async def _require_task(self, task_id: str, settings: StartupTaskSettings) -> StartupTask:
        task = await store.read_task(task_id, settings)
        if task is None:
            raise StartupTaskError("task_not_found", f"Startup task {task_id} does not exist.", task_id=task_id)
        return task

    @staticmethod
    def _current_project_id() -> str:
        identity = EnvIdentityResolver().resolve_workspace()
        return identity.value if identity is not None else ""

    @staticmethod
    def _require_confirmation(confirmed: bool) -> None:
        if not confirmed:
            raise StartupTaskError(
                "confirmation_required",
                "The user must confirm before this script is registered or enabled, because it runs automatically every time the sandbox starts.",
            )

    @staticmethod
    def _validate_script(script: str) -> str:
        normalized = script.strip()
        if not normalized:
            raise StartupTaskError("invalid_script", "Script must not be empty.")
        return normalized

    @staticmethod
    def _validate_timeout(timeout_seconds: int, settings: StartupTaskSettings) -> int:
        if not 1 <= timeout_seconds <= settings.max_timeout_seconds:
            raise StartupTaskError(
                "invalid_timeout",
                f"timeout_seconds must be between 1 and {settings.max_timeout_seconds}.",
                max_timeout_seconds=settings.max_timeout_seconds,
            )
        return timeout_seconds

    @staticmethod
    async def _validate_workdir(workdir: str) -> str:
        normalized = workdir.strip() or "."
        if await runner.resolve_task_workdir(normalized) is None:
            raise StartupTaskError(
                "invalid_workdir",
                f"Working directory {normalized} must be an existing directory inside .workspace.",
                workdir=normalized,
            )
        return normalized
