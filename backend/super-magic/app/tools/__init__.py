"""工具模块

包含各种可供智能体使用的工具。
"""

# 导出工具类
from app.tools.dummy_tool import DummyTool # DummyTool 必须在第一个位置导入，
from app.tools.ask_user import AskUserTool
from app.tools.web_search import WebSearch
from app.tools.call_subagent import CallSubagent
from app.tools.wait_for_subagents import WaitForSubagents
from app.tools.compact_chat_history import CompactChatHistory
from app.tools.core import BaseTool, BaseToolParams, tool, tool_factory
from app.tools.create_slide import CreateSlide
from app.tools.create_memory import CreateMemory
from app.tools.create_slide_project import CreateSlideProject

from app.tools.delete_files import DeleteFiles
from app.tools.delete_memory import DeleteMemory
from app.tools.download_from_markdown import DownloadFromMarkdown
from app.tools.download_from_url import DownloadFromUrl
from app.tools.download_from_urls import DownloadFromUrls
from app.tools.edit_file import EditFile
from app.tools.edit_file_range import EditFileRange
from app.tools.multi_edit_file import MultiEditFile
from app.tools.multi_edit_file_range import MultiEditFileRange
from app.tools.file_search import FileSearch
from app.tools.get_js_cdn_address import GetJsCdnAddress
from app.tools.grep_search import GrepSearch

from app.tools.generate_image import GenerateImage
from app.tools.generate_images import GenerateImages
from app.tools.generate_video import GenerateVideo, QueryVideoGeneration
from app.tools.image_search import ImageSearch
from app.tools.list_dir import ListDir
from app.tools.purify import Purify
from app.tools.markitdown_plugins import excel_plugin, docx_plugin

# 导出工具类
from app.tools.read_file import ReadFile
from app.tools.read_files import ReadFiles
from app.tools.read_webpages_as_markdown import ReadWebpagesAsMarkdown
from app.tools.reflection import Reflection
from app.tools.deep_write import DeepWrite
from app.tools.run_python_snippet import RunPythonSnippet
from app.tools.shell_exec import ShellExec
from app.tools.shell_await import ShellAwait
from app.tools.summarize import Summarize
from app.tools.thinking import Thinking
from app.tools.todo_read import TodoRead
from app.tools.todo_create import TodoCreate
from app.tools.todo_update import TodoUpdate
from app.tools.update_memory import UpdateMemory
from app.tools.upgrade_sandbox import UpgradeSandbox
from app.tools.use_browser import UseBrowser
from app.tools.write_file import WriteFile
from app.tools.manage_cron import ManageCron
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.append_to_file import AppendToFile
from app.tools.convert_pdf import ConvertPdf
from app.tools.convert_to_markdown import ConvertToMarkdown
from app.tools.visual_understanding import VisualUnderstanding
from app.tools.visual_understanding_webpage import VisualUnderstandingWebpage
from app.tools.video_understanding import VideoUnderstanding
from app.tools.analysis_slide_webpage import AnalysisSlideWebpage
from app.tools.channel import ConnectDingTalkBot, ConnectLarkBot, ConnectWecomBot, ConnectWechatBot, GetIMChannelStatus, WaitWechatLogin

# 数据分析看板工具
from app.tools.data_analyst_dashboard_tools import (
    CreateDashboardProject,
    ValidateDashboard,
    DownloadDashboardMaps,
    CreateDashboardCards,
    UpdateDashboardCards,
    DeleteDashboardCards,
    QueryDashboardCards,
)

# 视频项目工具
from app.tools.setup_video_project import SetupVideoProject
from app.tools.analyze_video_project import AnalyzeVideoProject
from app.tools.get_youtube_video_info import GetYoutubeVideoInfo
from app.tools.download_youtube_video_media import DownloadYoutubeVideoMedia
from app.tools.convert_video_to_audio import ConvertVideoToAudio

# 音频处理工具
from app.tools.split_audio import SplitAudio
from app.tools.audio_understanding import AudioUnderstanding
from app.tools.setup_audio_project import SetupAudioProject
from app.tools.analyze_audio_project import AnalyzeAudioProject

# 设计模式工具
import app.tools.design.manager  # pyright: ignore[reportUnusedImport]
import app.tools.design.utils  # pyright: ignore[reportUnusedImport]
import app.tools.design  # pyright: ignore[reportUnusedImport]
from app.tools.design.tools import (
    CreateCanvas,
    GenerateCanvasImages,
    GenerateCanvasVideos,
    SearchCanvasImages,
    SearchImagePrompts,
)

# 用户信息工具
from app.tools.get_user_info import GetUserInfo

# Skill 管理工具
from app.tools.read_skills import ReadSkills
from app.tools.run_sdk_snippet import RunSdkSnippet
from app.tools.skill_list import SkillList
from app.tools.search_knowledge import SearchKnowledge

# Import design package modules to ensure they are available in encrypted environment
import app.tools.design.manager
import app.tools.design.utils
import app.tools.design

__all__ = [
    "DummyTool",
    "AskUserTool",

    # 核心组件
    "BaseTool",
    "BaseToolParams",
    "tool",
    "tool_factory",

    # 工具类
    "AbstractFileTool",
    "AnalysisSlideWebpage",
    "AppendToFile",
    "WebSearch",
    "CallAgent",
    "WaitForSubagents",
    "ConnectDingTalkBot",
    "ConnectLarkBot",
    "ConnectWecomBot",
    "ConnectWechatBot",
    "WaitWechatLogin",
    "CompactChatHistory",
    "ConvertPdf",
    "ConvertToMarkdown",
    "CreateSlide",
    "CreateSlideProject",
    "CreateMemory",
    "DeepWrite",
    "DeleteFiles",
    "DeleteMemory",
    "DownloadFromMarkdown",
    "DownloadFromUrl",
    "DownloadFromUrls",
    "EditFile",
    "EditFileRange",
    "MultiEditFile",
    "MultiEditFileRange",
    "FileSearch",
    "GetJsCdnAddress",
    "GrepSearch",
    "ImageSearch",
    "GenerateImage",
    "GenerateImages",
    "GenerateVideo",
    "QueryVideoGeneration",
    "GetIMChannelStatus",
    "GetUserInfo",
    "ListDir",
    "Purify",
    "RunPythonSnippet",
    "ReadSkills",
    "RunSdkSnippet",
    "SkillList",
    "SearchKnowledge",
    "ReadFile",
    "ReadFiles",
    "ReadWebpagesAsMarkdown",
    "Reflection",
    "ShellExec",
    "ShellAwait",
    "Summarize",
    "Thinking",
    "TodoRead",
    "TodoCreate",
    "TodoUpdate",
    "UpdateMemory",
    "UseBrowser",
    "VisualUnderstanding",
    "VisualUnderstandingWebpage",
    "VideoUnderstanding",
    "WriteFile",
    "ManageCron",
    "excel_plugin",
    "docx_plugin",

    # 视频项目工具
    "SetupVideoProject",
    "AnalyzeVideoProject",
    "GetYoutubeVideoInfo",
    "DownloadYoutubeVideoMedia",
    "ConvertVideoToAudio",

    # 音频处理工具
    "SetupAudioProject",
    "AnalyzeAudioProject",
    "AudioUnderstanding",
    "SplitAudio",

    # 数据分析看板工具
    "CreateDashboardProject",
    "ValidateDashboard",
    "DownloadDashboardMaps",
    "CreateDashboardCards",
    "UpdateDashboardCards",
    "DeleteDashboardCards",
    "QueryDashboardCards",

    # Agent 管理工具
    "GetAgentInfo",
    "UpdateAgent",
    "CreateSkill",
    "EditSkill",
    "UploadSkill",

    # 设计模式工具
    "CreateCanvas",
    "GenerateCanvasImages",
    "GenerateCanvasVideos",
    "SearchCanvasImages",
    "SearchImagePrompts",
]
