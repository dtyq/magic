import asyncio
from dataclasses import dataclass, field
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

from app.core.entity.aigc_metadata import AigcMetadataParams
from app.service.file_convert.base_convert_service import BaseConvertService
from agentlang.logger import get_logger
from magic_use.magic_browser import MagicBrowser
from playwright.async_api import ConsoleMessage, Request

logger = get_logger(__name__)


@dataclass(slots=True)
class SyntaxCheckResult:
    """语法检查结果。"""

    is_valid: bool
    errors: List[str] = field(default_factory=list)


class _SyntaxCheckConvertService(BaseConvertService):
    """复用 BaseConvertService 的本地 CDN 路由能力。"""

    def __init__(self) -> None:
        super().__init__("syntax-checker")

    async def _convert_projects(
        self,
        projects: Dict[str, Dict[str, object]],
        output_dir: Path,
        options: Optional[Dict[str, object]] = None,
        task_mgr: object = None,
        task_key: Optional[str] = None,
        valid_files_count: int = 0,
        optimal_concurrency: int = 1,
        aigc_params: Optional[AigcMetadataParams] = None,
    ) -> Tuple[List[Path], List[str]]:
        raise NotImplementedError("Syntax checker does not support project conversion.")

    async def _get_service_specific_result_data(
        self, file_keys: List[Dict[str, str]], projects: Dict[str, Dict[str, object]], converted_files: List[Path]
    ) -> Dict[str, object]:
        raise NotImplementedError("Syntax checker does not provide conversion result data.")


class SyntaxChecker:
    """
    语法检查器（异步版）。

    目前支持：
    - HTML 运行时检查（浏览器加载 + 控制台错误 + 本地 CDN 路由）
    - JSON 语法检查
    - JavaScript 语法检查（Node.js）
    - Python 语法检查（python -m py_compile）
    - TypeScript/TSX/JSX 语法检查（tsc）
    """

    _cdn_route_service: Optional[_SyntaxCheckConvertService] = None
    _MAX_ERROR_TOTAL_CHARS = 6000
    _MAX_ERROR_ITEM_CHARS = 1200
    _MAX_ERROR_ITEMS = 30

    @staticmethod
    def _get_cdn_route_service() -> _SyntaxCheckConvertService:
        if SyntaxChecker._cdn_route_service is None:
            SyntaxChecker._cdn_route_service = _SyntaxCheckConvertService()
        return SyntaxChecker._cdn_route_service

    @staticmethod
    async def check_syntax(file_path: str, content: str) -> SyntaxCheckResult:
        """根据文件类型检查内容语法。"""
        file_extension = os.path.splitext(file_path)[1].lower()
        result: SyntaxCheckResult

        if file_extension in [".html", ".htm"]:
            result = await SyntaxChecker.check_html_syntax(file_path)
        elif file_extension == ".json":
            result = SyntaxChecker.check_json_syntax(content)
        elif file_extension in [".js", ".jsx"]:
            result = await SyntaxChecker.check_javascript_syntax(content, file_extension)
        elif file_extension in [".css", ".scss", ".md", ".markdown"]:
            result = SyntaxCheckResult(is_valid=True)
        elif file_extension == ".py":
            result = await SyntaxChecker.check_python_syntax(content)
        elif file_extension in [".ts", ".tsx"]:
            result = await SyntaxChecker.check_typescript_syntax(content, file_extension)
        else:
            result = SyntaxCheckResult(is_valid=True)

        if result.is_valid:
            return SyntaxCheckResult(is_valid=True)
        return SyntaxCheckResult(is_valid=False, errors=SyntaxChecker._shrink_error_messages(result.errors))

    @staticmethod
    async def check_html_syntax(file_path: Optional[str] = None) -> SyntaxCheckResult:
        """在真实浏览器中加载 HTML，并收集运行时错误。"""
        if not file_path:
            return SyntaxCheckResult(is_valid=False, errors=["HTML浏览器检查失败: 缺少源文件路径，无法加载依赖资源"])

        html_path = Path(file_path).resolve()
        if not html_path.exists():
            return SyntaxCheckResult(is_valid=False, errors=[f"HTML浏览器检查失败: 源文件不存在: {html_path}"])

        console_errors: List[str] = []
        page_errors: List[str] = []
        request_failures: List[str] = []
        browser = await MagicBrowser.create_for_scraping()

        try:
            page_id = await browser.new_page()
            page = await browser.get_page_by_id(page_id)
            if page is None:
                return SyntaxCheckResult(is_valid=False, errors=["HTML浏览器检查失败: 无法创建页面"])

            # 复用已有 CDN->本地映射，减少外网请求导致的卡住问题。
            await SyntaxChecker._get_cdn_route_service()._setup_local_cdn_route(page, debug_info="syntaxCheck")

            def on_console(message: ConsoleMessage) -> None:
                if message.type == "error" and message.text:
                    console_errors.append(f"浏览器控制台错误: {message.text}")

            def on_page_error(error: Exception) -> None:
                page_errors.append(f"页面运行时错误: {error!s}")

            def on_request_failed(request: Request) -> None:
                failure_info = request.failure
                if isinstance(failure_info, str):
                    failure_text = failure_info
                elif failure_info is None:
                    failure_text = "未知错误"
                else:
                    failure_text = str(failure_info)
                request_failures.append(f"资源加载失败: {request.url} ({failure_text})")

            page.on("console", on_console)
            page.on("pageerror", on_page_error)
            page.on("requestfailed", on_request_failed)

            await page.goto(html_path.as_uri(), wait_until="domcontentloaded", timeout=12000)

            # 优先复用 MagicBrowser 的网络稳定等待逻辑，避免固定 sleep 带来的额外延迟。
            try:
                await browser._wait_for_stable_network(page, wait_time=0.1, max_wait_time=0.8)
            except Exception as wait_error:
                logger.debug(f"HTML 网络稳定等待失败，降级为短采样: {wait_error}")

            # 保留极短采样窗口，捕获刚刚完成加载后冒出的异步错误。
            sample_rounds = 2
            for _ in range(sample_rounds):
                if page_errors or console_errors or request_failures:
                    break
                await page.wait_for_timeout(80)

            merged = page_errors + console_errors + request_failures
            deduped = list(dict.fromkeys(merged))
            if deduped:
                return SyntaxCheckResult(is_valid=False, errors=deduped)
            return SyntaxCheckResult(is_valid=True)
        except Exception as e:
            logger.error(f"HTML 浏览器检查异常: {e}", exc_info=True)
            return SyntaxCheckResult(is_valid=False, errors=[f"HTML浏览器检查异常: {e!s}"])
        finally:
            await browser.close()

    @staticmethod
    def check_json_syntax(content: str) -> SyntaxCheckResult:
        """检查 JSON 语法。"""
        if not content.strip():
            return SyntaxCheckResult(is_valid=True)

        errors: List[str] = []
        try:
            json.loads(content)
            return SyntaxCheckResult(is_valid=True)
        except json.JSONDecodeError as e:
            errors.append(f"JSON语法错误 (行 {e.lineno}, 列 {e.colno}): {e.msg}")
            lines = content.split("\n")
            if 0 <= e.lineno - 1 < len(lines):
                context_line = lines[e.lineno - 1]
                pointer = " " * e.colno + "^"
                errors.append(f"出错位置: {context_line}")
                errors.append(f"          {pointer}")
            return SyntaxCheckResult(is_valid=False, errors=errors)
        except Exception as e:
            return SyntaxCheckResult(is_valid=False, errors=[f"JSON解析错误: {e!s}"])

    @staticmethod
    async def check_javascript_syntax(content: str, file_extension: str = ".js") -> SyntaxCheckResult:
        """检查 JavaScript/JSX 语法。"""
        if not content.strip():
            return SyntaxCheckResult(is_valid=True)

        # JSX 交给 tsc 解析，Node.js 原生 --check 不支持 JSX 语法。
        if file_extension == ".jsx":
            return await SyntaxChecker.check_typescript_syntax(content, ".jsx")

        node_path = shutil.which("node")
        if node_path is None:
            return SyntaxCheckResult(is_valid=False, errors=["JavaScript语法检查失败: 未找到 node 命令"])

        temp_dir, script_file = await SyntaxChecker._create_temp_source(content, ".js")
        module_file = str(Path(temp_dir) / "check.mjs")
        await SyntaxChecker._write_text_file(module_file, content)

        try:
            script_returncode, script_stdout, script_stderr = await SyntaxChecker._run_subprocess(
                [node_path, "--check", script_file], timeout_seconds=10, cwd=temp_dir
            )
            if script_returncode == 0:
                return SyntaxCheckResult(is_valid=True)

            module_returncode, module_stdout, module_stderr = await SyntaxChecker._run_subprocess(
                [node_path, "--check", module_file], timeout_seconds=10, cwd=temp_dir
            )
            if module_returncode == 0:
                return SyntaxCheckResult(is_valid=True)

            script_errors = SyntaxChecker._format_command_errors(
                prefix="JavaScript(script)语法错误",
                stdout=script_stdout,
                stderr=script_stderr,
                file_path=script_file,
                return_code=script_returncode,
            )
            module_errors = SyntaxChecker._format_command_errors(
                prefix="JavaScript(module)语法错误",
                stdout=module_stdout,
                stderr=module_stderr,
                file_path=module_file,
                return_code=module_returncode,
            )
            merged_errors = script_errors + [item for item in module_errors if item not in script_errors]
            return SyntaxCheckResult(is_valid=False, errors=merged_errors)
        except asyncio.TimeoutError:
            return SyntaxCheckResult(is_valid=False, errors=["JavaScript语法检查超时: node --check 执行超过 10 秒"])
        except Exception as e:
            logger.error(f"JavaScript语法检查异常: {e}", exc_info=True)
            return SyntaxCheckResult(is_valid=False, errors=[f"JavaScript语法检查异常: {e!s}"])
        finally:
            await SyntaxChecker._cleanup_temp_dir(temp_dir)

    @staticmethod
    async def check_python_syntax(content: str) -> SyntaxCheckResult:
        """使用命令行编译器检查 Python 语法。"""
        if not content.strip():
            return SyntaxCheckResult(is_valid=True)

        python_cmd = sys.executable or shutil.which("python3") or shutil.which("python")
        if not python_cmd:
            return SyntaxCheckResult(is_valid=False, errors=["Python语法检查失败: 未找到 Python 可执行文件"])

        temp_dir, temp_file = await SyntaxChecker._create_temp_source(content, ".py")
        try:
            return_code, stdout, stderr = await SyntaxChecker._run_subprocess(
                [python_cmd, "-m", "py_compile", temp_file],
                timeout_seconds=10,
                cwd=temp_dir,
            )
            if return_code == 0:
                return SyntaxCheckResult(is_valid=True)
            errors = SyntaxChecker._format_command_errors(
                prefix="Python语法错误",
                stdout=stdout,
                stderr=stderr,
                file_path=temp_file,
                return_code=return_code,
            )
            return SyntaxCheckResult(is_valid=False, errors=errors)
        except asyncio.TimeoutError:
            return SyntaxCheckResult(is_valid=False, errors=["Python语法检查超时: py_compile 执行超过 10 秒"])
        except Exception as e:
            logger.error(f"Python语法检查异常: {e}", exc_info=True)
            return SyntaxCheckResult(is_valid=False, errors=[f"Python语法检查异常: {e!s}"])
        finally:
            await SyntaxChecker._cleanup_temp_dir(temp_dir)

    @staticmethod
    async def check_typescript_syntax(content: str, file_extension: str = ".ts") -> SyntaxCheckResult:
        """使用 tsc 检查 TypeScript/TSX/JSX 语法。"""
        if not content.strip():
            return SyntaxCheckResult(is_valid=True)

        tsc_path = shutil.which("tsc")
        if tsc_path is None:
            return SyntaxCheckResult(is_valid=False, errors=["TypeScript语法检查失败: 未找到 tsc 命令"])

        suffix = file_extension if file_extension in [".ts", ".tsx", ".jsx"] else ".ts"
        temp_dir, temp_file = await SyntaxChecker._create_temp_source(content, suffix)

        command: List[str] = [
            tsc_path,
            temp_file,
            "--pretty",
            "false",
            "--noEmit",
            "--skipLibCheck",
            "--target",
            "ES2022",
        ]
        if suffix in [".tsx", ".jsx"]:
            command.extend(["--jsx", "preserve"])
        if suffix == ".jsx":
            command.extend(["--allowJs", "--checkJs", "false"])

        try:
            return_code, stdout, stderr = await SyntaxChecker._run_subprocess(command, timeout_seconds=15, cwd=temp_dir)
            if return_code == 0:
                return SyntaxCheckResult(is_valid=True)
            errors = SyntaxChecker._format_command_errors(
                prefix="TypeScript语法错误",
                stdout=stdout,
                stderr=stderr,
                file_path=temp_file,
                return_code=return_code,
            )
            return SyntaxCheckResult(is_valid=False, errors=errors)
        except asyncio.TimeoutError:
            return SyntaxCheckResult(is_valid=False, errors=["TypeScript语法检查超时: tsc 执行超过 15 秒"])
        except Exception as e:
            logger.error(f"TypeScript语法检查异常: {e}", exc_info=True)
            return SyntaxCheckResult(is_valid=False, errors=[f"TypeScript语法检查异常: {e!s}"])
        finally:
            await SyntaxChecker._cleanup_temp_dir(temp_dir)

    @staticmethod
    async def _run_subprocess(command: Sequence[str], timeout_seconds: int, cwd: Optional[str] = None) -> Tuple[int, str, str]:
        """异步执行命令并返回退出码和输出。"""
        process = await asyncio.create_subprocess_exec(
            *command,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout_bytes, stderr_bytes = await asyncio.wait_for(process.communicate(), timeout=timeout_seconds)
        stdout = stdout_bytes.decode("utf-8", errors="replace")
        stderr = stderr_bytes.decode("utf-8", errors="replace")
        return process.returncode, stdout, stderr

    @staticmethod
    def _format_command_errors(prefix: str, stdout: str, stderr: str, file_path: str, return_code: int) -> List[str]:
        """格式化命令错误输出。"""
        merged = "\n".join([stderr, stdout]).strip()
        if not merged:
            return [f"{prefix}: 退出码 {return_code}"]

        errors: List[str] = []
        for line in merged.splitlines():
            clean_line = line.replace(file_path, "<input>").strip()
            if clean_line:
                errors.append(f"{prefix}: {clean_line}")
        return errors

    @staticmethod
    def _truncate_middle_text(text: str, max_chars: int) -> str:
        """超过长度后对文本做中间截断，保留前后文。"""
        if max_chars <= 0 or len(text) <= max_chars:
            return text

        marker = f"\n...[已截断 {len(text) - max_chars} 字符]...\n"
        if len(marker) >= max_chars:
            return text[:max_chars]

        remain = max_chars - len(marker)
        head = int(remain * 0.6)
        tail = remain - head
        return f"{text[:head]}{marker}{text[-tail:]}"

    @staticmethod
    def _shrink_error_messages(errors: List[str]) -> List[str]:
        """压缩错误信息体积，避免超长输出影响可读性。"""
        cleaned = [msg.strip() for msg in errors if msg and msg.strip()]
        if not cleaned:
            return []

        item_limited = [
            SyntaxChecker._truncate_middle_text(msg, SyntaxChecker._MAX_ERROR_ITEM_CHARS) for msg in cleaned
        ]

        if len(item_limited) > SyntaxChecker._MAX_ERROR_ITEMS:
            keep_head = SyntaxChecker._MAX_ERROR_ITEMS // 2
            keep_tail = SyntaxChecker._MAX_ERROR_ITEMS - keep_head
            omitted = len(item_limited) - SyntaxChecker._MAX_ERROR_ITEMS
            item_limited = (
                item_limited[:keep_head]
                + [f"...[已省略 {omitted} 条错误]..."]
                + item_limited[-keep_tail:]
            )

        merged = "\n".join(item_limited)
        if len(merged) <= SyntaxChecker._MAX_ERROR_TOTAL_CHARS:
            return item_limited

        merged_limited = SyntaxChecker._truncate_middle_text(merged, SyntaxChecker._MAX_ERROR_TOTAL_CHARS)
        return [merged_limited]

    @staticmethod
    async def _create_temp_source(content: str, suffix: str) -> Tuple[str, str]:
        """创建临时源码文件。"""

        def _create() -> Tuple[str, str]:
            temp_dir = tempfile.mkdtemp(prefix="syntax_checker_")
            file_path = Path(temp_dir) / f"check{suffix}"
            file_path.write_text(content, encoding="utf-8")
            return temp_dir, str(file_path)

        return await asyncio.to_thread(_create)

    @staticmethod
    async def _write_text_file(file_path: str, content: str) -> None:
        """异步写入文本文件。"""

        def _write() -> None:
            Path(file_path).write_text(content, encoding="utf-8")

        await asyncio.to_thread(_write)

    @staticmethod
    async def _cleanup_temp_dir(temp_dir: str) -> None:
        """异步清理临时目录。"""
        await asyncio.to_thread(shutil.rmtree, temp_dir, True)
