"""
启动任务文件的读写。

每个任务一个文件：`.workspace/.magic/startup/<task_id>.md`，用户在文件树里能直接看到和编辑。

    ---
    name: ledger deps
    enabled: true
    workdir: ledger
    timeout_seconds: 900
    project_id: "<确认时的 project_id>"
    ---

    ```bash
    npm install
    ```

解析宽兼容：脚本取正文第一个 bash／sh／无语言的代码块，没有代码块时取整段正文；
字段缺失或类型不对时回落默认值。写入统一生成上面的格式，直接覆盖同名文件（不用临时文件加 rename，见 AGENTS.md §11）。
"""

from __future__ import annotations

import re
from pathlib import Path

import yaml

from agentlang.logger import get_logger
from app.path_manager import PathManager
from app.service.startup_task.models import StartupTask, StartupTaskSettings
from app.utils.async_file_utils import (
    async_exists,
    async_scandir,
    async_try_read_markdown,
    async_unlink,
    async_write_text,
)

logger = get_logger(__name__)

_TASK_FILE_SUFFIX = ".md"
_FENCE_OPEN_RE = re.compile(r"^(`{3,})[ \t]*([^`\s]*)[ \t]*$")
_SCRIPT_LANGUAGES = frozenset({"", "bash", "sh"})
_TRUE_TEXTS = frozenset({"true", "yes", "on", "1"})


def get_task_file(task_id: str) -> Path:
    return PathManager.get_startup_task_dir() / f"{task_id}{_TASK_FILE_SUFFIX}"


async def scan_tasks(settings: StartupTaskSettings) -> list[StartupTask]:
    """按 task_id 排序返回全部有效任务；无法解析的文件记日志后跳过。"""
    task_dir = PathManager.get_startup_task_dir()
    if not await async_exists(task_dir):
        return []
    tasks: list[StartupTask] = []
    for entry in await async_scandir(task_dir):
        if entry.is_dir() or entry.name.startswith(".") or not entry.name.endswith(_TASK_FILE_SUFFIX):
            continue
        task = await read_task(entry.name[: -len(_TASK_FILE_SUFFIX)], settings)
        if task is not None:
            tasks.append(task)
    return sorted(tasks, key=lambda task: task.task_id)


async def read_task(task_id: str, settings: StartupTaskSettings) -> StartupTask | None:
    path = get_task_file(task_id)
    markdown = await async_try_read_markdown(path)
    if markdown is None:
        return None
    script = _extract_script(markdown.body)
    if not script:
        logger.warning(f"startup_task: 任务文件没有可执行脚本，已跳过: {path}")
        return None
    meta = markdown.meta if isinstance(markdown.meta, dict) else {}
    return StartupTask(
        task_id=task_id,
        name=str(meta.get("name") or task_id).strip(),
        enabled=_parse_enabled(meta.get("enabled", True)),
        workdir=str(meta.get("workdir") or ".").strip() or ".",
        timeout_seconds=_parse_timeout(meta.get("timeout_seconds"), settings),
        project_id=str(meta.get("project_id") or "").strip(),
        script=script,
    )


async def write_task(task: StartupTask) -> None:
    frontmatter = {
        "name": task.name,
        "enabled": task.enabled,
        "workdir": task.workdir,
        "timeout_seconds": task.timeout_seconds,
        "project_id": task.project_id,
    }
    frontmatter_text = yaml.safe_dump(frontmatter, allow_unicode=True, sort_keys=False).rstrip()
    # 围栏比脚本里最长的反引号串多一个，脚本自身含 ``` 时也能原样读回
    longest_backticks = max((len(match) for match in re.findall(r"`+", task.script)), default=0)
    fence = "`" * max(3, longest_backticks + 1)
    content = f"---\n{frontmatter_text}\n---\n\n{fence}bash\n{task.script}\n{fence}\n"
    await async_write_text(get_task_file(task.task_id), content)


async def delete_task(task_id: str) -> bool:
    path = get_task_file(task_id)
    if not await async_exists(path):
        return False
    await async_unlink(path)
    return True


def _extract_script(body: str) -> str:
    """
    按行成对识别代码块，跳过其他语言的块，避免把前一个块的结束围栏误当成开始围栏。
    例：正文先有 ```python 说明块、再有 ```bash 脚本块 -> 取 bash 块；一个代码块都没有 -> 取整段正文。
    """
    lines = body.splitlines()
    has_fence = False
    index = 0
    while index < len(lines):
        opening = _FENCE_OPEN_RE.match(lines[index].strip())
        if opening is None:
            index += 1
            continue
        has_fence = True
        fence, language = opening.group(1), opening.group(2).lower()
        end = next(
            (i for i in range(index + 1, len(lines)) if re.fullmatch(rf"`{{{len(fence)},}}", lines[i].strip())),
            len(lines),
        )
        if language in _SCRIPT_LANGUAGES:
            return "\n".join(lines[index + 1:end]).strip()
        index = end + 1
    return "" if has_fence else body.strip()


def _parse_enabled(value: object) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in _TRUE_TEXTS


def _parse_timeout(value: object, settings: StartupTaskSettings) -> int:
    """用户手改出的非法值不让任务失效：缺失或无法解析用默认值，越界收敛到 1..max。"""
    try:
        seconds = int(str(value))
    except ValueError:
        return settings.default_timeout_seconds
    return min(max(seconds, 1), settings.max_timeout_seconds)
