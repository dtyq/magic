"""
音频理解工具

此工具使用 Magic Service API 提供音频转文本的转录功能。
它支持提交音频文件进行转录并查询结果。
"""

from app.i18n import i18n
import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

import aiofiles
import httpx
from mutagen import File as MutagenFile
from pydantic import Field

from agentlang.config.config import Config
from agentlang.context.tool_context import ToolContext
from agentlang.event import EventPairType, get_correlation_manager
from agentlang.event.data import PendingToolCallEventData
from agentlang.event.event import EventType
from agentlang.tools.tool_result import ToolResult
from agentlang.utils.metadata import MetadataUtil
from app.core.entity.message.server_message import DisplayType, ToolDetail
from app.infrastructure.magic_service.config import MagicServiceConfigLoader
from app.service.asr.asr_merge_task_manager import AsrMergeTaskManager
from app.service.file_service import FileService
from app.tools.core.base_tool import BaseTool
from app.tools.core.base_tool_params import BaseToolParams


class AudioUnderstandingError(Exception):
    """Audio Understanding 工具的自定义异常"""

    def __init__(self, message: str, error_code: str = None):
        self.message = message
        self.error_code = error_code
        super().__init__(message)


@dataclass
class TranscriptionResult:
    """转录结果数据类"""

    text: str
    duration_ms: Optional[int] = None


class AudioUnderstandingParams(BaseToolParams):
    audio_path: str = Field(
        ...,
        description="""<!--zh: [输入] 音频文件路径（相对于工作区根目录，包含文件夹和文件名）。线上生成的录音通常在 '{智能总结名}_{时间戳}' 格式的文件夹中。示例：'产品评审会议_20251121_170158/录音.wav' / 'meeting-summary_20251121_170158/audio.mp3' / '会議要約_20251121_170158/音声.m4a'-->
[Input] Audio file path (relative to workspace root, includes folder and filename). Online generated recordings typically in '{Summary_Name}_{timestamp}' format folder. Examples: 'Product_Review_Meeting_20251121_170158/audio.wav' / 'Meeting_Summary_20251121_170158/audio.mp3' / 'Meeting_Summary_20251121_170158/audio.m4a'""",
    )
    transcript_filename: str = Field(
        ...,
        description="""<!--zh: [输出] 录音文字稿文件名（纯文件名，不含路径，禁止包含 / 符号），转录结果将输出到音频文件同目录。格式为 '{主题名}-录音文字稿.md'（中文）/ '{topic-name}-transcript.md'（英文）/ '{トピック名}-文字起こし.md'（日文）。示例：'产品评审会议-录音文字稿.md' / 'meeting-transcript.md' / '会議-文字起こし.md'-->
[Output] Transcript filename (filename only, no path, no / symbol). Transcription result outputs to same directory as audio file. Format: '{topic-name}-transcript.md' (English) / '{主题名}-录音文字稿.md' (Chinese) / '{トピック名}-文字起こし.md' (Japanese). Examples: 'meeting-transcript.md' / '产品评审会议-录音文字稿.md' / '会議-文字起こし.md'""",
    )
    timeout: int = 60 * 60 * 3  # 长音频文件超时时间3小时


class AudioUnderstanding(BaseTool[AudioUnderstandingParams]):
    """<!--zh: 使用音频理解将音频文件转换为文本。支持多种音频格式，包括 wav、mp3、mp4、ogg、m4a 等。-->
    Convert audio files to text using audio understanding. Supports multiple audio formats including wav, mp3, mp4, ogg, m4a, etc."""

    # Constants
    PLATFORM_TYPE_VOLCENGINE = "volcengine"
    HTTP_TIMEOUT = 30
    # 进度报告间隔：固定30秒，无论音频多长，保持用户体验一致
    # 频繁的进度更新可以减少用户等待时的焦虑感
    PROGRESS_REPORT_INTERVAL = 30

    def __init__(self, **kwargs):
        self.logger = logging.getLogger(__name__)
        super().__init__(**kwargs)
        self.config = Config()
        self.api_key = None
        self.api_base_url = None
        self.magic_service_config = None
        self._initialized = False

    def _initialize_service(self):
        """延迟初始化服务，只在需要时进行"""
        if self._initialized:
            return

        try:
            self.api_key = self.config.get("audio_understanding.api_key")
            self.api_base_url = self.config.get("audio_understanding.api_base_url", "")

            if not self.api_key:
                raise ValueError("audio_understanding.api_key not configured in config.yaml")

            # Load magic service configuration
            self.magic_service_config = MagicServiceConfigLoader.load_with_fallback()
            self.logger.info("Successfully loaded Magic Service configuration")
            self._initialized = True
            self.logger.info("AudioUnderstanding工具服务初始化成功")

        except Exception as e:
            self.logger.warning(f"AudioUnderstanding工具服务初始化失败: {e}")
            raise

    def is_available(self) -> bool:
        """
        检查工具是否可用，验证所需配置是否存在

        Returns:
            bool: 工具是否可用
        """
        try:
            # 检查API key配置
            api_key = self.config.get("audio_understanding.api_key")
            if not api_key:
                return False

            # 尝试加载Magic Service配置
            try:
                MagicServiceConfigLoader.load_with_fallback()
                return True
            except Exception as e:
                return False

        except Exception as e:
            self.logger.warning(f"检查AudioUnderstanding工具可用性失败: {e}")
            return False

    async def _generate_presigned_url_for_uploaded_file(self, file_path: str) -> Optional[str]:
        """
        为已上传的文件生成预签名 URL
        支持多个存储平台：TOS、阿里云 OSS、本地存储

        Args:
            file_path: 已上传文件的存储键

        Returns:
            str: 文件的预签名 URL，失败则返回 None
        """
        try:
            # 创建文件服务实例
            file_service = FileService()

            # 获取文件下载链接
            download_result = await file_service.get_file_download_url(file_path, expires_in=7200, options={})

            # 提取下载URL
            presigned_url = download_result.get("download_url")
            platform = download_result.get("platform")

            self.logger.info(f"Generated presigned URL for {platform} storage file_path: {file_path}")
            self.logger.info(f"Generated presigned URL: {presigned_url}")
            return presigned_url

        except Exception as e:
            self.logger.error(f"Failed to generate presigned URL for uploaded file {file_path}: {e}")
            return None

    async def _run(self, params: AudioUnderstandingParams, correlation_id: str) -> str:
        """
        将音频文件转换为文本

        Args:
            params: 包含 audio_path 和 transcript_filename 的 AudioUnderstandingParams
            correlation_id: 用于追踪整个工具调用的关联ID

        Returns:
            str: 转录的文本或错误消息
        """
        try:
            # 验证文件路径
            file_path = Path(params.audio_path)
            audio_filename = file_path.name
            # 检查文件是否存在（异步执行以避免阻塞）
            file_exists = await asyncio.to_thread(file_path.exists)
            if not file_exists:
                raise AudioUnderstandingError(
                    i18n.translate("audio_understanding.file_not_found", category="tool.messages", file_path=params.audio_path),
                    "FILE_NOT_FOUND",
                )

            # 获取真实音频时长（异步执行，不阻塞事件循环）
            audio_duration = await self._get_audio_duration(file_path)

            # 获取文件大小用于日志记录（异步执行以避免阻塞）
            file_stat = await asyncio.to_thread(file_path.stat)
            file_size_mb = file_stat.st_size / (1024 * 1024)  # 转换为 MB

            # 前置检查：判断是否需要拆分音频
            # 默认阈值：400MB 或 4小时
            max_size_mb = 400
            max_duration_hours = 4.0
            max_duration_seconds = max_duration_hours * 3600
            
            duration_hours = (audio_duration / 3600) if audio_duration else 0
            needs_split = file_size_mb > max_size_mb or (audio_duration and audio_duration > max_duration_seconds)
            
            if needs_split:
                # 格式化时长显示
                if audio_duration and audio_duration > 0:
                    hours = int(audio_duration // 3600)
                    minutes = int((audio_duration % 3600) // 60)
                    seconds = int(audio_duration % 60)
                    if hours > 0:
                        duration_str = f"{hours}小时{minutes}分钟{seconds}秒"
                    elif minutes > 0:
                        duration_str = f"{minutes}分钟{seconds}秒"
                    else:
                        duration_str = f"{seconds}秒"
                else:
                    duration_str = "未知"
                
                # 构建拆分建议提示
                split_suggestion = f"""⚠️ 音频文件过大，建议先拆分后再转录

📊 当前文件信息：
- 文件名：{audio_filename}
- 文件大小：{file_size_mb:.2f}MB (阈值: {max_size_mb}MB)
- 时长：{duration_str} (阈值: {max_duration_hours}小时)

💡 处理建议：
音频文件大小超过 {max_size_mb}MB 或时长超过 {max_duration_hours}小时，建议使用 split_audio 工具先拆分成多个小文件，然后分别转录各个片段。

🎯 操作步骤：
1. 使用 split_audio 工具拆分音频文件：
   - audio_path: '{params.audio_path}'
   - max_size_mb: {max_size_mb}
   - max_duration_hours: {max_duration_hours}

2. 拆分完成后，对每个拆分的音频文件分别使用 audio_understanding 进行转录

这样可以提高转录成功率，避免因文件过大导致的超时或失败问题。"""
                
                raise AudioUnderstandingError(
                    split_suggestion,
                    "FILE_TOO_LARGE"
                )

            # 估算转录处理时长（注意：这是处理时间，不是音频播放时长）
            # BUG FIX: 检查 audio_duration 不仅要 not None，还要 > 0
            # 因为某些情况下可能返回 0.0（如元数据损坏），这会导致估算时长为 0
            if audio_duration is not None and audio_duration > 0:
                # 根据经验：转录处理时间约为音频时长的 1/10
                # 例如：1小时音频大约需要6分钟处理
                estimated_transcription_duration = audio_duration / 10.0
                self.logger.info(
                    f"Audio file size: {file_size_mb:.2f}MB, audio duration: {audio_duration:.1f}s ({audio_duration / 60:.1f} minutes), estimated transcription time: {estimated_transcription_duration:.1f}s ({estimated_transcription_duration / 60:.1f} minutes)"
                )
            else:
                # 回退方案：基于文件大小估算转录处理时间
                # 经验值：40MB 音频文件需要约 180 秒完成转录
                estimated_transcription_duration = (file_size_mb / 40.0) * 180.0
                self.logger.info(
                    f"Audio file size: {file_size_mb:.2f}MB, estimated transcription time (fallback based on file size): {estimated_transcription_duration:.1f}s ({estimated_transcription_duration / 60:.1f} minutes)"
                )

            # 存储以供轮询使用
            self._file_size_mb = file_size_mb
            self._audio_duration = audio_duration  # 保存音频播放时长（用于日志）
            self._estimated_transcription_duration = (
                estimated_transcription_duration  # 保存估算的转录处理时长（用于进度计算）
            )

            # 确定音频格式（从文件扩展名提取）
            audio_format = file_path.suffix.lstrip(".")
            if not audio_format:
                raise AudioUnderstandingError(
                    i18n.translate("audio_understanding.format_not_supported", category="tool.messages", format="未知格式"),
                    "FORMAT_NOT_SUPPORTED",
                )

            self.logger.info(f"Generated file_key for storage: {file_path}")

            # 生成预签名 URL (将 Path 对象转换为字符串)
            file_url = await self._generate_presigned_url_for_uploaded_file(str(file_path))
            if not file_url:
                raise AudioUnderstandingError(
                    i18n.translate("audio_understanding.transcription_error", category="tool.messages", error="生成预签名URL失败"),
                    "URL_GENERATION_FAILED",
                )

            # 提交转录任务
            task_id = await self._submit_transcription_task(file_url, audio_format)
            if not task_id:
                raise AudioUnderstandingError(
                    i18n.translate("audio_understanding.transcription_error", category="tool.messages", error="Submit audio transcription task failed"),
                    "TASK_SUBMISSION_FAILED",
                )

            # 轮询结果，获取转录文本和API返回的准确时长（使用传入的 correlation_id）
            transcription_result = await self._poll_transcription_result(task_id, params.timeout, correlation_id)

            # 使用API返回的准确时长覆盖本地读取的不准确值
            if transcription_result.duration_ms is not None and transcription_result.duration_ms > 0:
                api_duration_seconds = transcription_result.duration_ms / 1000.0
                self.logger.info(
                    f"Using accurate duration from API: {api_duration_seconds:.1f}s ({api_duration_seconds / 60:.1f} minutes)"
                )

                # 如果本地读取的时长明显不准确（差异超过5秒或本地时长<5秒），则使用API时长
                if audio_duration is None or abs(audio_duration - api_duration_seconds) > 5 or audio_duration < 5:
                    if audio_duration is not None:
                        self.logger.warning(
                            f"Local duration ({audio_duration:.1f}s) significantly differs from API duration ({api_duration_seconds:.1f}s), using API duration"
                        )
                    else:
                        self.logger.info(
                            f"Local duration not available, using API duration ({api_duration_seconds:.1f}s)"
                        )

                    # 覆盖本地读取的不准确值
                    self._audio_duration = api_duration_seconds
                    audio_duration = api_duration_seconds
            else:
                self.logger.warning("API did not return duration information, using local duration estimation")

            # 从音频文件路径提取目录，构造完整的转录文件路径
            audio_file_path = Path(params.audio_path)
            transcript_full_path = audio_file_path.parent / params.transcript_filename

            # 确保目录存在
            await asyncio.to_thread(transcript_full_path.parent.mkdir, parents=True, exist_ok=True)

            # 将转录文本写入到与音频文件相同目录下的转录文件
            async with aiofiles.open(transcript_full_path, "w", encoding="utf-8") as f:
                await f.write(transcription_result.text)

            self.logger.info(
                i18n.translate("audio_understanding.transcription_success", category="tool.messages", content=str(transcript_full_path))
            )
            # self.logger.info(f"Transcription result: {result}")
            return i18n.translate("audio_understanding.transcription_success", category="tool.messages", content=str(transcript_full_path))

        except AudioUnderstandingError:
            # 重新抛出自定义异常
            raise
        except Exception as e:
            raise AudioUnderstandingError(
                i18n.translate("audio_understanding.transcription_error", category="tool.messages", error=f"Audio transcription processing failed - {str(e)}",
                ),
                "GENERAL_ERROR",
            )

    def _build_api_headers(self) -> Dict[str, str]:
        """使用 Magic 元数据构建 API 请求头，遵循 generate_image.py 的模式"""
        # 构建默认请求头
        headers = {"Content-Type": "application/json", "api-key": self.api_key}

        # 添加 Magic-Authorization 与 User-Authorization
        MetadataUtil.add_magic_and_user_authorization_headers(headers)

        # 如果 MetadataUtil 已初始化，添加 Magic 元数据请求头
        if MetadataUtil.is_initialized():
            # 将 task_id 添加到请求头
            task_id = MetadataUtil.get_metadata().get("super_magic_task_id")
            if task_id:
                headers["Magic-Task-Id"] = task_id

            # 将 topic_id 添加到请求头
            topic_id = MetadataUtil.get_metadata().get("topic_id")
            if topic_id:
                headers["Magic-Topic-Id"] = topic_id

            # 将 chat_topic_id 添加到请求头
            chat_topic_id = MetadataUtil.get_metadata().get("chat_topic_id")
            if chat_topic_id:
                headers["Magic-Chat-Topic-Id"] = chat_topic_id

            # 将 language 添加到请求头
            language = MetadataUtil.get_metadata().get("language")
            if language:
                headers["Magic-Language"] = language

        self.logger.info(f"构建的 API 请求头: {headers}")
        return headers

    async def _submit_transcription_task(self, file_url: str, audio_format: str) -> Optional[str]:
        """
        提交音频文件进行转录

        Args:
            file_url: 音频文件的预签名 URL
            audio_format: 音频格式（wav、mp3、ogg、m4a 等）

        Returns:
            str: 成功则返回任务 ID，否则返回 None
        """
        try:
            url = f"{self.api_base_url}/speech/large-model/submit"
            headers = self._build_api_headers()

            payload = {
                "type": self.PLATFORM_TYPE_VOLCENGINE,
                "audio": {"url": file_url, "format": audio_format},
                "request": {"enable_speaker_info": True},
            }

            self.logger.info(f"Submitting transcription task for {audio_format} file")
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=payload, timeout=self.HTTP_TIMEOUT)
                response.raise_for_status()

                result = response.json()
                self.logger.info(f"Submit transcription result: {result}")
                if result.get("request_id"):
                    task_id = result.get("request_id")
                    self.logger.info(f"Transcription task submitted successfully, task_id: {task_id}")
                    return task_id
                else:
                    self.logger.error(f"Submit transcription failed: {result}")
                    return None

        except httpx.HTTPError as e:
            self.logger.error(f"Request failed: {e}")
            return None
        except Exception as e:
            self.logger.error(f"Submit transcription error: {e}")
            return None

    async def _poll_transcription_result(self, task_id: str, timeout: int, correlation_id: str) -> TranscriptionResult:
        """
        轮询转录结果

        Args:
            task_id: 提交后返回的任务 ID
            timeout: 最大等待时间（秒）

        Returns:
            TranscriptionResult: 转录结果，包含文本和音频时长
        """
        async with httpx.AsyncClient() as client:
            try:
                url = f"{self.api_base_url}/speech/large-model/query/{task_id}?type={self.PLATFORM_TYPE_VOLCENGINE}"

                headers = self._build_api_headers()

                start_time = time.time()
                poll_count = 0
                last_progress_time = start_time
                last_percentage = 1  # 跟踪上次报告的百分比

                # 使用固定的进度报告间隔（30秒）
                progress_interval = self.PROGRESS_REPORT_INTERVAL
                estimated_transcription_duration = getattr(self, "_estimated_transcription_duration", 0)
                self.logger.info(
                    f"Using progress interval: {progress_interval} seconds for estimated transcription duration: {estimated_transcription_duration:.1f} seconds"
                )

                # 发送初始进度事件
                initial_percentage = 1
                last_percentage = initial_percentage
                # correlation_id 随机字符串
                await self._dispatch_transcription_progress_event(task_id, 0, 0, initial_percentage, correlation_id)

                while time.time() - start_time < timeout:
                    # 在每次循环开始时让出控制权，允许事件循环处理其他请求
                    await asyncio.sleep(0)

                    current_time = time.time()
                    elapsed_seconds = int(current_time - start_time)

                    # 根据估算的转录处理时长计算进度百分比
                    if (
                        hasattr(self, "_estimated_transcription_duration")
                        and self._estimated_transcription_duration > 0
                    ):
                        # 使用已经过的时间与估算的转录处理时长的比例计算进度，最高到 80%
                        time_based_percentage = min(
                            int((elapsed_seconds / self._estimated_transcription_duration) * 80), 80
                        )
                        # 确保最小进度为 1%
                        time_based_percentage = max(time_based_percentage, 1)

                        # 80% 之后，每次进度事件增加 1%，最高 99%（经典做法：最后卡在99%）
                        if last_percentage >= 80:
                            percentage = min(last_percentage + 1, 99)
                        else:
                            # 确保进度只增不减
                            percentage = max(time_based_percentage, last_percentage)
                    else:
                        # 如果估算不可用，则回退到原始逻辑，但也限制在 99%
                        if last_percentage >= 80:
                            percentage = min(last_percentage + 1, 99)
                        else:
                            percentage = min(max(elapsed_seconds // progress_interval, 1), 80)
                            # 确保进度只增不减
                            percentage = max(percentage, last_percentage)

                    # 根据音频时长动态发送进度事件
                    if current_time - last_progress_time >= progress_interval:
                        poll_count += 1
                        await self._dispatch_transcription_progress_event(
                            task_id, elapsed_seconds, poll_count, percentage, correlation_id
                        )
                        last_progress_time = current_time
                        last_percentage = percentage  # 更新上次报告的百分比

                        # 增强日志记录，包含文件大小和估算的转录处理时间
                        if hasattr(self, "_file_size_mb") and hasattr(self, "_estimated_transcription_duration"):
                            self.logger.info(
                                f"Polling transcription result for {self._file_size_mb:.2f}MB file (attempt {poll_count}, progress {percentage}%, estimated transcription time: {self._estimated_transcription_duration:.1f}s) for task_id: {task_id}"
                            )
                        else:
                            self.logger.info(
                                f"Polling transcription result (attempt {poll_count}, progress {percentage}%) for task_id: {task_id}"
                            )

                        self.logger.debug(f"Request URL: {url}")

                        response = await client.post(url, headers=headers, json={}, timeout=self.HTTP_TIMEOUT)
                        response.raise_for_status()
                        self.logger.debug(f"Response status: {response.status_code}")

                        # 从响应头获取状态信息
                        logid = response.headers.get("X-Volcengine-Log-Id", "")
                        status_code = response.headers.get("X-Volcengine-Status-Code", "")
                        status_message = response.headers.get("X-Volcengine-Message", "")

                        self.logger.info(
                            f"Response headers - Logid: {logid}, Status Code: {status_code}, Message: {status_message}"
                        )

                        result = response.json()

                        # 检查响应头中的状态码
                        if status_code == "20000000":  # 成功
                            # audio_info 不为空，表示任务已完成
                            if result.get("audio_info"):
                                self.logger.info(f"Found audio_info in response: {result.get('audio_info')}")
                                # 任务完成时发送最终进度事件，进度为100%
                                await self._dispatch_transcription_progress_event(
                                    task_id, elapsed_seconds, poll_count, 100, correlation_id, "completed"
                                )
                                # 提取转录文本和时长
                                transcription_result = self._extract_transcribed_text(result)
                                self.logger.info(f"Transcription completed successfully for task_id: {task_id}")
                                return transcription_result
                            else:
                                self.logger.warning(
                                    f"Success status but no audio_info in response for task_id: {task_id}"
                                )
                                self.logger.debug(f"Full response: {result}")
                                return TranscriptionResult(
                                    text=i18n.translate("audio_understanding.task_success_no_audio_info", category="tool.messages")
                                )

                        elif status_code == "20000001":  # 处理中
                            self.logger.info(
                                f"Transcription still processing for task_id: {task_id}, waiting {progress_interval} seconds..."
                            )
                            await asyncio.sleep(progress_interval)
                            continue

                        elif status_code == "20000002":  # 队列中
                            self.logger.info(
                                f"Transcription task in queue for task_id: {task_id}, waiting {progress_interval} seconds..."
                            )
                            await asyncio.sleep(progress_interval)
                            continue

                        elif status_code == "20000003":  # 静音音频
                            self.logger.warning(f"Silent audio detected for task_id: {task_id}")
                            return TranscriptionResult(
                                text=i18n.translate("audio_understanding.transcription_error", category="tool.messages", error="Silent audio detected, please resubmit task",)
                            )

                        elif status_code == "45000001":  # 无效参数
                            self.logger.error(f"Invalid parameters for task_id: {task_id}")
                            return TranscriptionResult(
                                text=i18n.translate("audio_understanding.invalid_parameters", category="tool.messages", status_message=status_message)
                            )

                        elif status_code == "45000002":  # 空音频
                            self.logger.error(f"Empty audio for task_id: {task_id}")
                            return TranscriptionResult(
                                text=i18n.translate("audio_understanding.transcription_error", category="tool.messages", error="Empty audio file")
                            )

                        elif status_code == "45000151":  # 无效音频格式
                            self.logger.error(f"Invalid audio format for task_id: {task_id}")
                            return TranscriptionResult(
                                text=i18n.translate("audio_understanding.format_not_supported", category="tool.messages", format="audio format")
                            )

                        elif status_code == "45000006":  # 文件无法下载
                            self.logger.error(f"file cannot download for task_id: {task_id}")
                            return TranscriptionResult(
                                text=i18n.translate("audio_understanding.transcription_error", category="tool.messages", error="File cannot be downloaded")
                            )

                        elif status_code.startswith("550"):  # 内部服务器错误
                            self.logger.error(
                                f"Internal server error for task_id: {task_id}, status_code: {status_code}"
                            )
                            if status_code == "55000031":
                                return TranscriptionResult(
                                    text=i18n.translate("audio_understanding.transcription_error", category="tool.messages", error="Server busy, please try again later",)
                                )
                            else:
                                return TranscriptionResult(
                                    text=i18n.translate("audio_understanding.internal_server_error", category="tool.messages", status_code=status_code,
                                        status_message=status_message,)
                                )

                        else:
                            # 未知状态码，检查 audio_info 是否存在
                            if result.get("audio_info"):
                                # 任务完成时发送最终进度事件，进度为100%
                                await self._dispatch_transcription_progress_event(
                                    task_id, elapsed_seconds, poll_count, 100, correlation_id, "completed"
                                )
                                # 提取转录文本和时长
                                transcription_result = self._extract_transcribed_text(result)
                                self.logger.info(f"Transcription completed successfully for task_id: {task_id}")
                                return transcription_result
                            elif result.get("audio_info") == []:
                                # audio_info 为空数组，表示任务正在处理
                                self.logger.info(
                                    f"Transcription still processing for task_id: {task_id}, waiting {progress_interval} seconds..."
                                )
                                await asyncio.sleep(progress_interval)
                                continue
                            else:
                                self.logger.warning(f"Unknown status code '{status_code}' for task_id: {task_id}")
                                return TranscriptionResult(
                                    text=i18n.translate("audio_understanding.unknown_status_code", category="tool.messages", status_code=status_code,
                                        status_message=status_message,)
                                )

                self.logger.error(f"Transcription timeout after {timeout} seconds for task_id: {task_id}")
                return TranscriptionResult(text=i18n.translate("audio_understanding.task_timeout", category="tool.messages", timeout=timeout))

            except httpx.HTTPError as e:
                self.logger.error(f"Request failed while polling: {e}")
                return TranscriptionResult(
                    text=i18n.translate("audio_understanding.query_request_failed", category="tool.messages", error=str(e))
                )
            except Exception as e:
                self.logger.error(f"Exception while polling transcription result: {e}")
                return TranscriptionResult(text=i18n.translate("audio_understanding.query_exception", category="tool.messages", error=str(e)))

    def _extract_transcribed_text(self, data: Dict[str, Any]) -> TranscriptionResult:
        """
        Extract transcribed text from API response data and format to Markdown (no Front Matter)
        Also extract audio duration from API response for accurate metadata

        Args:
            data: Response data from API

        Returns:
            TranscriptionResult: 转录结果，包含文本和音频时长（毫秒）
        """
        try:
            utterances = None
            duration_ms = None

            # Try to extract utterances and duration from audio_info field (new format)
            if "audio_info" in data:
                audio_info = data["audio_info"]

                if isinstance(audio_info, list) and len(audio_info) > 0:
                    # audio_info is a list of audio segments
                    all_utterances = []

                    for segment in audio_info:
                        if isinstance(segment, dict):
                            # Extract duration from first segment that has it
                            if duration_ms is None and "duration" in segment:
                                duration_ms = segment.get("duration")
                                self.logger.info(
                                    f"Extracted audio duration from API: {duration_ms}ms ({duration_ms / 1000:.1f}s)"
                                )

                            if "utterances" in segment:
                                filtered = self._filter_utterances(segment["utterances"])
                                if isinstance(filtered, list):
                                    all_utterances.extend(filtered)
                                else:
                                    all_utterances.append(filtered)

                    if all_utterances:
                        utterances = all_utterances

                elif isinstance(audio_info, dict):
                    # audio_info is a single dictionary
                    if "duration" in audio_info:
                        duration_ms = audio_info.get("duration")
                        self.logger.info(
                            f"Extracted audio duration from API: {duration_ms}ms ({duration_ms / 1000:.1f}s)"
                        )

                    if "utterances" in audio_info:
                        utterances = self._filter_utterances(audio_info["utterances"])

            # Fallback: check result field (old format)
            if utterances is None and "result" in data:
                result = data["result"]

                if isinstance(result, dict):
                    # Extract duration from result if not found yet
                    if duration_ms is None and "duration" in result:
                        duration_ms = result.get("duration")
                        self.logger.info(
                            f"Extracted audio duration from API (result field): {duration_ms}ms ({duration_ms / 1000:.1f}s)"
                        )

                    if "utterances" in result:
                        utterances = self._filter_utterances(result["utterances"])

                elif isinstance(result, list):
                    # result is a list of items
                    all_utterances = []

                    for item in result:
                        if isinstance(item, dict):
                            # Extract duration from first item that has it
                            if duration_ms is None and "duration" in item:
                                duration_ms = item.get("duration")
                                self.logger.info(
                                    f"Extracted audio duration from API (result list): {duration_ms}ms ({duration_ms / 1000:.1f}s)"
                                )

                            if "utterances" in item:
                                filtered = self._filter_utterances(item["utterances"])
                                if isinstance(filtered, list):
                                    all_utterances.extend(filtered)
                                else:
                                    all_utterances.append(filtered)

                    if all_utterances:
                        utterances = all_utterances

            # Fallback: extract duration from last utterance timestamp if still not found
            if duration_ms is None and utterances:
                last_timestamp_ms = self._extract_last_timestamp(utterances)
                if last_timestamp_ms:
                    duration_ms = last_timestamp_ms
                    self.logger.info(
                        f"Fallback: Extracted duration from last utterance timestamp: {duration_ms}ms ({duration_ms / 1000:.1f}s)"
                    )

            # Format result in Markdown format (no Front Matter)
            if utterances:
                formatted_result = []
                formatted_result.append("## 📝 Dialogue Content")
                formatted_result.append("")  # Empty line after title
                utterances_lines = self._format_utterances_to_lines(utterances)
                formatted_result.extend(utterances_lines)
                return TranscriptionResult(text="\n".join(formatted_result), duration_ms=duration_ms)

            # No utterances found, return raw data for debugging
            self.logger.warning(f"Could not extract utterances from response data: {data}")
            return TranscriptionResult(text=json.dumps(data, ensure_ascii=False, indent=2), duration_ms=duration_ms)

        except Exception as e:
            self.logger.error(f"Error extracting transcribed text: {e}")
            return TranscriptionResult(text=i18n.translate("audio_understanding.extract_text_error", category="tool.messages", error=str(e)))

    def _extract_last_timestamp(self, utterances: Any) -> Optional[int]:
        """
        Extract the last timestamp from utterances as a fallback duration

        Args:
            utterances: Utterances data (list or dict)

        Returns:
            Optional[int]: Last timestamp in milliseconds, or None if not found
        """
        try:
            last_timestamp = None

            if isinstance(utterances, list) and utterances:
                # Get the last utterance
                for utterance in reversed(utterances):
                    if isinstance(utterance, dict):
                        # Try start_time + duration if both exist
                        if "start_time" in utterance:
                            start_time = utterance.get("start_time", 0)
                            # If there's a duration field in the utterance, add it
                            if "duration" in utterance:
                                last_timestamp = start_time + utterance.get("duration", 0)
                            else:
                                # Otherwise just use start_time as approximation
                                last_timestamp = start_time
                            break
            elif isinstance(utterances, dict):
                # Single utterance
                if "start_time" in utterances:
                    start_time = utterances.get("start_time", 0)
                    if "duration" in utterances:
                        last_timestamp = start_time + utterances.get("duration", 0)
                    else:
                        last_timestamp = start_time

            return last_timestamp

        except Exception as e:
            self.logger.warning(f"Error extracting last timestamp: {e}")
            return None

    def _format_utterances_to_lines(self, utterances: Any) -> list:
        """
        Format utterances to Markdown lines: [MM:SS] Speaker-N:\ntext

        Args:
            utterances: Utterances data (list or dict)

        Returns:
            List of formatted utterance strings
        """
        lines = []

        if isinstance(utterances, list):
            for utterance in utterances:
                if isinstance(utterance, dict):
                    line = self._format_single_utterance(utterance)
                    if line:
                        lines.append(line)
        elif isinstance(utterances, dict):
            line = self._format_single_utterance(utterances)
            if line:
                lines.append(line)

        return lines

    def _format_single_utterance(self, utterance: dict) -> str:
        """
        Format single utterance to Markdown format: [MM:SS] Speaker-N:\ntext

        Args:
            utterance: Single utterance dictionary

        Returns:
            Formatted utterance string in Markdown format
        """
        try:
            # Extract speaker from additions or use default value
            speaker = "Unknown"
            if "additions" in utterance and isinstance(utterance["additions"], dict):
                speaker = "Speaker-" + utterance["additions"].get("speaker", "Unknown")
            elif "speaker" in utterance:
                speaker = "Speaker-" + utterance["speaker"]
            else:
                speaker = "Speaker-Unknown"

            start_time = utterance.get("start_time", 0)
            text = utterance.get("text", "")

            if not text:
                return ""

            # Convert milliseconds to MM:SS format
            time_str = self._milliseconds_to_mm_ss(start_time)

            # ⚠️ 【格式规范 - 三处同步】生成文字稿时的格式化
            # 格式：[MM:SS] Speaker-N:\n对话内容\n\n
            # 同步修改：analyze_audio_project._extract_transcript_segment()、index.html.parseTranscriptMarkdown()
            return f"[{time_str}] {speaker}:\n{text}\n"

        except Exception as e:
            self.logger.error(f"Error formatting utterance: {e}")
            return ""

    def _milliseconds_to_mm_ss(self, milliseconds: int) -> str:
        """
        将毫秒转换为 MM:SS 格式

        Args:
            milliseconds: 时间（毫秒）

        Returns:
            MM:SS 格式的时间字符串
        """
        try:
            total_seconds = milliseconds // 1000
            minutes = total_seconds // 60
            seconds = total_seconds % 60
            return f"{minutes:02d}:{seconds:02d}"
        except Exception as e:
            self.logger.error(f"Error converting time format: {e}")
            return "00:00"

    def _filter_utterances(self, utterances: Any) -> Any:
        """
        过滤话语以移除 words 字段并确保保留说话人信息

        Args:
            utterances: 话语数据（可以是列表或字典）

        Returns:
            不包含 words 字段但包含说话人信息的过滤后的话语
        """
        if isinstance(utterances, list):
            filtered_list = []
            for utterance in utterances:
                if isinstance(utterance, dict):
                    # 创建不包含 words 字段的副本
                    filtered_utterance = {k: v for k, v in utterance.items() if k != "words"}

                    # 如果存在，从 additions 提取说话人信息
                    if "additions" in filtered_utterance and isinstance(filtered_utterance["additions"], dict):
                        speaker = filtered_utterance["additions"].get("speaker")
                        if speaker:
                            filtered_utterance["speaker"] = speaker
                        # 保留原始 additions 作为备份
                        filtered_utterance["additions"] = filtered_utterance["additions"]

                    filtered_list.append(filtered_utterance)
                else:
                    filtered_list.append(utterance)
            return filtered_list
        elif isinstance(utterances, dict):
            # 创建不包含 words 字段的副本
            filtered_utterance = {k: v for k, v in utterances.items() if k != "words"}

            # 如果存在，从 additions 提取说话人信息
            if "additions" in filtered_utterance and isinstance(filtered_utterance["additions"], dict):
                speaker = filtered_utterance["additions"].get("speaker")
                if speaker:
                    filtered_utterance["speaker"] = speaker
                # 保留原始 additions 作为备份
                filtered_utterance["additions"] = filtered_utterance["additions"]

            return filtered_utterance
        else:
            return utterances

    async def _dispatch_transcription_progress_event(
        self,
        task_id: str,
        elapsed_seconds: int,
        poll_count: int,
        percentage: int = 1,
        correlation_id: str = "",
        status: str = "processing",
    ) -> None:
        """发送音频转录进度事件"""
        try:
            if hasattr(self, "_current_tool_context") and self._current_tool_context:
                agent_context = self._current_tool_context.get_extension("agent_context")

                if agent_context:
                    if status == "completed":
                        percentage = 100
                    elif status == "failed":
                        percentage = 0

                    # 进度消息直接使用百分比数字的字符串形式
                    # progress_message = str(percentage)
                    file_path = getattr(self, "_current_file_path", "")
                    audio_filename = Path(file_path).name if file_path else ""
                    # 构造进度参数 - 复用现有的参数字段来传递进度信息，增加百分比进度
                    progress_arguments = {
                        "name": "audio_understanding",
                        "correlation_id": correlation_id,
                        "file_name": audio_filename,
                        "action": i18n.translate("audio_understanding", category="tool.actions"),
                        "detail": {
                            "type": "text",
                            "data": {
                                "file_name": audio_filename,
                                "progress": percentage,
                                "message": i18n.translate("audio_understanding.transcription_progress_message", category="tool.messages", percentage=percentage),
                            },
                        },
                        "status": status,
                        # "file_path": getattr(self, '_current_file_path', ''),
                    }

                    # 添加日志 - 检查 correlation_id 的值
                    self.logger.info(
                        f"[进度事件] 准备发送进度事件，correlation_id: {correlation_id}, percentage: {percentage}%"
                    )

                    # 创建事件数据
                    event_data = PendingToolCallEventData(
                        tool_context=self._current_tool_context,
                        tool_name="audio_understanding",
                        arguments=progress_arguments,
                        tool_instance=self,
                        correlation_id=correlation_id,  # Set correlation_id to keep consistency with before/after events
                    )

                    # 添加日志 - 检查事件数据中的 correlation_id
                    self.logger.info(
                        f"[进度事件] PendingToolCallEventData 已创建，event_data.correlation_id: {event_data.correlation_id}"
                    )

                    agent_context.update_activity_time()

                    # 分发事件 - 会被现有的监听器处理并发送到客户端
                    await agent_context.dispatch_event(EventType.PENDING_TOOL_CALL, event_data)

                    self.logger.info(
                        f"已发送音频转录进度事件: 任务{task_id}, 已耗时{elapsed_seconds}秒, 进度{percentage}%, 轮询{poll_count}次"
                    )

        except Exception as e:
            self.logger.error(f"发送音频转录进度事件失败: {e}")

    async def _get_audio_duration(self, file_path: Path) -> Optional[float]:
        """
        Get accurate audio duration using ffprobe (fallback to mutagen if unavailable)

        Uses ffprobe as primary method because it's more reliable for:
        - VBR (Variable Bit Rate) encoded MP3 files
        - Files with incomplete or corrupted metadata
        - All audio formats (MP3, M4A, WAV, OGG, FLAC, etc.)

        Args:
            file_path: Path to audio file

        Returns:
            float: Duration in seconds, or None if all methods fail
        """
        # Method 1: Try ffprobe first (most reliable) - using async subprocess
        try:
            process = await asyncio.create_subprocess_exec(
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(file_path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10.0)

                if process.returncode == 0 and stdout:
                    duration = float(stdout.decode().strip())
                    if duration > 0:
                        self.logger.info(f"Audio duration (ffprobe): {duration:.1f}s ({duration / 60:.1f} minutes)")
                        return duration
                    else:
                        self.logger.warning(f"ffprobe returned invalid duration: {duration}, trying mutagen")
            except asyncio.TimeoutError:
                self.logger.warning("ffprobe timeout, trying mutagen fallback")
                try:
                    process.kill()
                    await process.wait()
                except Exception:
                    pass
        except FileNotFoundError:
            self.logger.warning("ffprobe not found, trying mutagen fallback")
        except Exception as e:
            self.logger.warning(f"ffprobe failed: {e}, trying mutagen fallback")

        # Method 2: Fallback to mutagen (run in thread pool to avoid blocking)
        try:

            def _read_mutagen():
                audio = MutagenFile(str(file_path))
                if audio is not None and hasattr(audio.info, "length"):
                    return audio.info.length
                return None

            duration = await asyncio.to_thread(_read_mutagen)

            if duration is not None and duration > 0:
                self.logger.info(f"Audio duration (mutagen): {duration:.1f}s ({duration / 60:.1f} minutes)")
                return duration
            elif duration is not None:
                self.logger.warning(f"Mutagen returned invalid duration: {duration}")
        except Exception as e:
            self.logger.warning(f"Mutagen failed: {e}")

        # All methods failed
        self.logger.warning(f"Could not get audio duration from file: {file_path}, will use file size estimation")
        return None

    async def _get_recording_start_time(self, tool_context: ToolContext) -> str:
        """
        Get recording start time from ASR task

        Retrieves the recording start time from dynamic_config.asr_task_key,
        reading the created_at field as the recording start time.
        Returns "未知" if not available.

        Args:
            tool_context: Tool context

        Returns:
            str: Formatted start time string (YYYY-MM-DD HH:MM:SS) or "未知"
        """
        try:
            # Get asr_task_key from dynamic_config
            agent_context = tool_context.get_extension("agent_context")
            if not agent_context:
                self.logger.debug("No agent_context found in tool_context")
                return "未知"

            chat_message = agent_context.get_chat_client_message()
            if not chat_message or not chat_message.dynamic_config:
                self.logger.debug("No dynamic_config found in chat_message")
                return "未知"

            asr_task_key = chat_message.dynamic_config.get("asr_task_key")
            if not asr_task_key:
                self.logger.debug("No asr_task_key found in dynamic_config")
                return "未知"

            self.logger.debug(f"Found asr_task_key from dynamic_config: {asr_task_key}")

            # Get task info from ASR task manager
            task = await AsrMergeTaskManager.instance().get_task(asr_task_key)

            if task and task.created_at:
                # Use created_at as recording start time
                start_time = task.created_at.strftime("%Y-%m-%d %H:%M:%S")
                self.logger.info(f"Found recording start time from ASR task: {start_time} (task_key: {asr_task_key})")
                return start_time
            else:
                self.logger.debug(f"No task found for asr_task_key: {asr_task_key}")
                return "未知"

        except Exception as e:
            self.logger.warning(f"Failed to get recording start time: {e}")
            return "未知"

    async def execute(self, tool_context: ToolContext, params: AudioUnderstandingParams) -> ToolResult:
        """执行音频到文本的转换"""
        try:
            # 延迟初始化服务
            self._initialize_service()

            # 保存当前工具上下文和文件路径，供事件分发使用
            self._current_tool_context = tool_context
            self._current_file_path = params.audio_path

            # 获取当前活跃的 tool_call correlation_id，确保 before/pending/after 事件使用同一个 ID
            correlation_manager = get_correlation_manager()
            correlation_id = correlation_manager.get_active_correlation_id(EventPairType.TOOL_CALL)

            self.logger.info(f"[_transcribe] 从 correlation_manager 获取的 correlation_id: {correlation_id}")

            # 如果没有活跃的 correlation_id（不应该发生，但作为备用），使用 tool_call_id
            if not correlation_id:
                correlation_id = tool_context.tool_call_id or str(uuid.uuid4())
                self.logger.warning(f"No active correlation_id found for TOOL_CALL, using fallback: {correlation_id}")

            # 保存 correlation_id 供 get_tool_detail 使用
            self._current_correlation_id = correlation_id
            self.logger.info(f"[_transcribe] 最终使用的 correlation_id: {correlation_id}")

            # 执行音频到文本的转换（传入 correlation_id）
            result_message = await self._run(params, correlation_id)

            # 构造完整的转录文件路径（直接从参数构造，不依赖字符串解析）
            audio_file_path = Path(params.audio_path)
            transcription_file_path = str(audio_file_path.parent / params.transcript_filename)

            # 获取音频元数据
            audio_duration = getattr(self, "_audio_duration", 0)
            file_size_mb = getattr(self, "_file_size_mb", 0)
            duration_seconds = int(audio_duration) if audio_duration else 0
            duration_minutes = duration_seconds // 60
            duration_remain_seconds = duration_seconds % 60

            # 获取当前日期时间
            current_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            # 获取录音开始时间
            start_time = await self._get_recording_start_time(tool_context)

            # 返回文件路径以便 LLM 可以读取
            return ToolResult(
                ok=True,
                content=f"""音频转录完成！

音频文件：{params.audio_path}
转录文件：{transcription_file_path}
音频时长：{duration_seconds}秒（{duration_minutes}分{duration_remain_seconds}秒）
文件大小：{file_size_mb:.2f}MB
转录日期：{current_date}
录音开始时间：{start_time}

下一步：使用 setup_audio_project 工具搭建项目结构。""",
                extra_info={
                    "audio_path": params.audio_path,
                    "transcription_file_path": transcription_file_path,
                    "duration": duration_seconds,
                    "file_size_mb": file_size_mb,
                    "date": current_date,
                    "recording_start_time": start_time,
                },
            )

        except AudioUnderstandingError as e:
            self.logger.error(f"Audio transcription failed: {e.message}")
            return ToolResult(
                ok=False,
                content=e.message,
                extra_info={
                    "error": e.message,
                    "error_code": e.error_code,
                    "audio_path": params.audio_path,
                    "transcribed_text": "",
                },
            )
        except Exception as e:
            self.logger.error(f"Audio transcription failed: {e}")
            error_message = i18n.translate("audio_understanding.transcription_error", category="tool.messages", error=str(e))
            return ToolResult(
                ok=False,
                content=error_message,
                extra_info={"error": str(e), "audio_path": params.audio_path, "transcribed_text": ""},
            )
        finally:
            # 清理上下文引用
            if hasattr(self, "_current_tool_context"):
                delattr(self, "_current_tool_context")
            if hasattr(self, "_current_file_path"):
                delattr(self, "_current_file_path")

    def _parse_transcription_result(self, result_text: str) -> Dict[str, Any]:
        """
        解析转录结果以提取结构化数据

        Args:
            result_text: 格式化的结果文本

        Returns:
            包含文本、附加信息和话语的字典
        """
        try:
            result_data = {}

            # 按部分拆分
            sections = result_text.split("\n")
            current_section = None
            current_content = []

            for line in sections:
                if line.startswith("转录文本："):
                    current_section = "text"
                    current_content = []
                elif line.startswith("附加信息："):
                    # 保存上一部分
                    if current_section == "text" and current_content:
                        result_data["text"] = "\n".join(current_content).strip()
                    current_section = "additions"
                    current_content = []
                elif line.startswith("话语信息："):
                    # 保存上一部分
                    if current_section == "additions" and current_content:
                        try:
                            result_data["additions"] = json.loads("\n".join(current_content))
                        except:
                            result_data["additions"] = current_content
                    current_section = "utterances"
                    current_content = []
                elif line.strip() and current_section:
                    current_content.append(line)

            # 保存最后一部分
            if current_section == "text" and current_content:
                result_data["text"] = "\n".join(current_content).strip()
            if current_section == "additions" and current_content:
                try:
                    result_data["additions"] = json.loads("\n".join(current_content))
                except:
                    result_data["additions"] = current_content
            elif current_section == "utterances" and current_content:
                try:
                    result_data["utterances"] = json.loads("\n".join(current_content))
                except:
                    result_data["utterances"] = current_content

                # 从话语中提取实际文本内容供 LLM 使用
                if "utterances" in result_data and result_data["utterances"]:
                    utterances_text = []
                    if isinstance(result_data["utterances"], list):
                        for utterance in result_data["utterances"]:
                            if isinstance(utterance, str):
                                # 提取时间戳后的文本
                                if ": " in utterance:
                                    text_part = utterance.split(": ", 1)[1]
                                    utterances_text.append(text_part)
                                else:
                                    utterances_text.append(utterance)

                    # 将提取的文本设置为主要文本内容
                    if utterances_text:
                        result_data["text"] = " ".join(utterances_text)

            return result_data

        except Exception as e:
            self.logger.error(f"Error parsing transcription result: {e}")
            return {"text": result_text}

    async def get_tool_detail(
        self, tool_context: ToolContext, result: ToolResult, arguments: Dict[str, Any] = None
    ) -> Optional[ToolDetail]:
        """获取前端预览的工具详情"""
        if not result.ok or not result.extra_info:
            return None

        try:
            # Extract metadata from extra_info
            audio_path = result.extra_info.get("audio_path", "")
            # Get audio filename
            audio_filename = Path(audio_path).name if audio_path else "unknown"
            return ToolDetail(
                type=DisplayType.TEXT, data={"message": "100%", "progress": 100, "file_name": audio_filename}
            )
        except Exception as e:
            self.logger.error(f"生成工具详情失败: {e}")
            return None

    async def get_after_tool_call_friendly_content(
        self, tool_context: ToolContext, result: ToolResult, execution_time: float, arguments: Dict[str, Any] = None
    ) -> str:
        """获取工具执行后的友好输出内容"""
        if not result.ok:
            return ""

        transcribed_text = str(result)
        if transcribed_text:
            # 如果文本太长，从50个字符串开始，截取前200个字符
            preview_text = transcribed_text[50:200] + "..." if len(transcribed_text) > 200 else transcribed_text
            return i18n.translate("audio_understanding.transcription_preview", category="tool.messages", preview=preview_text)

        return i18n.translate("audio_understanding.transcription_completed", category="tool.messages")

    async def get_after_tool_call_friendly_action_and_remark(
        self,
        tool_name: str,
        tool_context: ToolContext,
        result: ToolResult,
        execution_time: float,
        arguments: Dict[str, Any] = None,
    ) -> Dict:
        """获取工具执行后的友好动作和备注"""
        if not result.ok:
            return {
                "action": i18n.translate("audio_understanding", category="tool.actions"),
                "remark": i18n.translate("audio_understanding.transcription_error", category="tool.messages", error=result.content),
            }

        if not arguments:
            return {
                "action": i18n.translate("audio_understanding", category="tool.actions"),
                "remark": i18n.translate("audio_understanding.unknown_file", category="tool.messages"),
            }

        audio_path = arguments.get("audio_path", "")
        if audio_path:
            file_name = Path(audio_path).name
            return {
                "action": i18n.translate("audio_understanding", category="tool.actions"),
                "remark": i18n.translate("audio_understanding.processing_audio_file", category="tool.messages", file_name=file_name),
            }

        return {
            "action": i18n.translate("audio_understanding", category="tool.actions"),
            "remark": i18n.translate("audio_understanding.transcription_completed", category="tool.messages"),
        }
