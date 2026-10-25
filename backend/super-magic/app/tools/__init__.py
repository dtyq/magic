"""工具模块

包含各种可供智能体使用的工具。
"""

# 导出工具类
from app.tools.dummy_tool import DummyTool # DummyTool 必须在第一个位置导入，
from app.tools.ask_user import AskUserTool
from app.tools.micro_app_plan import MicroAppPlanTool
from app.tools.update_html_app_memory import UpdateHtmlAppMemory
from app.tools.web_search import WebSearch
from app.tools.find_agents import FindAgentsTool
from app.tools.get_html_design_style_source import GetHtmlDesignStyleSource
from app.tools.call_subagent import CallSubagent
from app.tools.wait_for_subagents import WaitForSubagents
from app.tools.compact_chat_history import CompactChatHistory
from app.tools.list_chat_history import ListChatHistory
from app.tools.search_chat_history import SearchChatHistory
from app.tools.read_chat_history import ReadChatHistory
from app.tools.core import BaseTool, BaseToolParams, tool, tool_factory
from app.tools.create_slide import CreateSlide
from app.tools.create_slide_project import CreateSlideProject
from app.tools.update_slide_transitions import UpdateSlideTransitions
from app.tools.slide_template_builder import (
    CreateSlideTemplateProject,
    FinalizeSlideTemplate,
    PrepareSlideTemplateSource,
    QuerySlideTemplateTaxonomy,
    ReviewSlideTemplateSource,
    SelectSlideTemplateSourceAssets,
)

from app.tools.delete_files import DeleteFiles
from app.tools.download_from_markdown import DownloadFromMarkdown
from app.tools.download_from_url import DownloadFromUrl
from app.tools.download_from_urls import DownloadFromUrls
from app.tools.edit_file import EditFile
from app.tools.edit_file_ranges import EditFileRanges
from app.tools.find_file_ranges import FindFileRanges
from app.tools.multi_edit_file import MultiEditFile
from app.tools.file_search import FileSearch
from app.tools.get_js_cdn_address import GetJsCdnAddress
from app.tools.get_sandbox_info import GetSandboxInfo
from app.tools.get_user_language import GetUserLanguage
from app.tools.grep_search import GrepSearch

from app.tools.generate_images import GenerateImages
from app.tools.generate_video import GenerateVideo
from app.tools.get_video import GetVideo
from app.tools.image_search import ImageSearch
from app.tools.list_dir import ListDir
from app.tools.purify import Purify

# 导出工具类
from app.tools.read_file import ReadFile
from app.tools.read_files import ReadFiles
from app.tools.create_client_side_file_bundle import CreateClientSideFileBundle
# Code Mode 也依赖模块显式导入完成工具注册；仅写 Skill 示例不会让运行时找到这个工具。
from app.tools.inspect_memory import InspectMemory
from app.tools.inspect_path_storage import InspectPathStorage
from app.tools.read_webpages_as_markdown import ReadWebpagesAsMarkdown
from app.tools.reflection import Reflection
from app.tools.deep_write import DeepWrite
from app.tools.run_python_snippet import RunPythonSnippet
from app.tools.shell_exec import ShellExec
from app.tools.shell_await import ShellAwait
from app.tools.summarize import Summarize
from app.tools.persona_chat import PersonaChat
# Persona research file tools (Code Mode only); imported here so the image bundles them.
from app.tools.persona_research import (
    CheckInterviews,
    FinishPersonaTranscript,
    SavePersonas,
    AttachPersonaPortrait,
    AssignPersonaPortraits,
    EmbedPersonaPortraits,
    SaveStudySynthesis,
    SaveValidationQuestionnaire,
    UpdateStudy,
)
from app.tools.thinking import Thinking
from app.tools.todo_read import TodoRead
from app.tools.todo_create import TodoCreate
from app.tools.todo_update import TodoUpdate
from app.tools.restart_sandbox import RestartSandbox
from app.tools.upgrade_sandbox import UpgradeSandbox
from app.tools.browser import (
    BrowserSelectInstance,
    BrowserSelectTab,
    BrowserActivateTab,
    BrowserAddInitScript,
    BrowserCheck,
    BrowserClick,
    BrowserCloseTab,
    BrowserEvaluate,
    BrowserFill,
    BrowserFindVisual,
    BrowserFind,
    BrowserReadHtml,
    BrowserHover,
    BrowserKeepAlive,
    BrowserListTabs,
    BrowserListInstances,
    BrowserNavigate,
    BrowserNewTab,
    BrowserPress,
    BrowserReadConsole,
    BrowserReadNetwork,
    BrowserReadPage,
    BrowserScreenshot,
    BrowserScroll,
    BrowserSelect,
    BrowserListElements,
    BrowserUploadFile,
    BrowserVisualQuery,
    BrowserWait,
)
from app.tools.write_file import WriteFile
from app.tools.manage_cron import ManageCron
from app.tools.magic_calendar import ManageCalendar, CreateCalendarProject
from app.tools.abstract_file_tool import AbstractFileTool
from app.tools.document_parse import (
    BuildDocumentIndex,
    ConvertDocumentFormat,
    ExportDocumentMarkdown,
    ExtractDocumentContent,
    InspectDocument,
    PlanDocumentReading,
    SampleDocumentContent,
    SummarizeDocument,
    UnderstandDocumentImages,
)
from app.tools.cli_manager import CliManagerApply, CliManagerList, CliManagerRemove
from app.tools.startup_task import (
    StartupTaskCreate,
    StartupTaskDelete,
    StartupTaskList,
    StartupTaskRun,
    StartupTaskUpdate,
)
from app.tools.env_manager import GetEnv, ListEnv, SetEnv, UnsetEnv
from app.tools.share import (
    CreateFileShare,
    CreateProjectShare,
    CreateTopicShare,
    DeleteShare,
    GetShare,
    InspectFileShare,
    ListFileShares,
    ListProjectShares,
    ListTopicShares,
    UpdateFileShare,
    UpdateProjectShare,
    UpdateTopicShare,
)
from app.tools.visual_understanding import VisualUnderstanding
from app.tools.visual_understanding_webpage import VisualUnderstandingWebpage
from app.tools.video_understanding import VideoUnderstanding
from app.tools.analysis_slide_webpage import AnalysisSlideWebpage
from app.tools.channel import ConnectDingTalkBot, ConnectLarkBot, ConnectWecomBot, ConnectWechatBot, GetIMChannelStatus, WaitWechatLogin, SendWechatMessage

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

# 独立 Canvas Agent 工具集；不复用旧 Design Canvas 工具实现
from app.tools.canvas import (
    QueryCanvasLayout,
    ArrangeCanvasElements,
    RenameCanvasElements,
    UnframeCanvasElements,
    DeleteCanvasElements,
    AddCanvasContents,
    AddCanvasElements,
    FrameCanvasElements,
    InitializeCanvas,
    LayoutCanvasElements,
    ManageCanvasConnections,
    QueryCanvasElementDetails,
    QueryCanvasOverview,
    RetryCanvasContentGeneration,
    SelectCanvasMainContent,
    WaitCanvasGeneration,
    EstimateCanvasContentPoints,
    SearchCanvasImages as CanvasSearchCanvasImages,
    SearchCanvasImagePrompts,
)

# 用户信息工具
from app.tools.get_user_info import GetUserInfo
# CodeModeOnly MagicBase tools: see agents/skills/use-magicbase/SKILL.md.
from app.tools.magicbase_tools import (
    BatchCreateMagicRows,
    BatchDeleteMagicRows,
    BatchGetMagicRows,
    CreateMagicColumn,
    CreateMagicTable,
    CreateMagicRow,
    DeleteMagicColumn,
    DeleteMagicRow,
    DeleteMagicTable,
    GetMagicRow,
    GetMagicTable,
    QueryMagicRows,
    QueryMagicTables,
    QueryMagicTablesAllMentionedApps,
    UpdateMagicColumn,
    UpdateMagicRow,
    UpdateMagicTablePermissions,
)

# Skill 管理工具
from app.tools.find_skills import FindSkillsTool
from app.tools.install_skills import InstallSkillsTool
from app.tools.read_skills import ReadSkills
from app.tools.run_sdk_snippet import RunSdkSnippet
from app.tools.search_knowledge import SearchKnowledge
from app.tools.install_slides_template import InstallSlidesTemplate

# MCP 工具集（@tool(code_mode_only=True)，只允许通过 sdk.tool.call 调用）
from app.tools.mcp import (
    McpAddServer,
    McpCallTool,
    McpConnectServer,
    McpGetToolSchema,
    McpListServers,
    McpListTools,
)

# OAuth2 工具集（@tool(code_mode_only=True)，只允许通过 sdk.tool.call 调用）
from app.tools.oauth2 import (
    OAuth2CheckAuthorization,
    OAuth2GetApiDoc,
    OAuth2GetRedirectUri,
    OAuth2ListApiDocs,
    OAuth2ListApps,
    OAuth2RemoveApiDoc,
    OAuth2RemoveApp,
    OAuth2Request,
    OAuth2StartAuthorization,
    OAuth2UpsertApiDoc,
    OAuth2UpsertApp,
)

# 定时任务工具集（code_mode_only=True，只允许通过 sdk.tool.call 调用）
from app.tools.scheduled_task import (
    ScheduledTaskCreate,
    ScheduledTaskDelete,
    ScheduledTaskGet,
    ScheduledTaskList,
    ScheduledTaskUpdate,
)

# Remote 工具集（将 magic-service mention 中的 tool / assistant 以本地工具形态转发）
from app.tools.remote import (
    CallAssistant,
    CallSimpleAgent,
    CallSimpleTool,
)

# Code Mode 产品工具也需进入加密打包的显式导入链。
from app.tools.super_magic import (
    ListSkills,
    GetSkill,
    CreateSkill,
    PrepareSkillPublish,
    PublishSkill,
    GetSkillPublishResult,

    ArchiveTopic,
    ArchiveWorkspace,
    CancelTopicTask,
    CopyProjectFiles,
    CreateProject,
    CreateProjectDirectory,
    CreateTopic,
    CreateWorkspace,
    DeleteProject,
    DeleteProjectFiles,
    DeleteTopic,
    DeleteTopicQueuedMessage,
    DeleteWorkspace,
    GetFileBatchStatus,
    GetProject,
    GetProjectFile,
    GetTopic,
    GetTopicTask,
    GetWorkspace,
    ListProjectFiles,
    ListProjects,
    ListTopicQueuedMessages,
    ListTopics,
    ListWorkspaces,
    MoveProject,
    MoveProjectFiles,
    PrepareProjectFiles,
    ReadTopicMessages,
    RenameProjectFile,
    SearchProjectFiles,
    SearchUsers,
    SearchDepartments,
    SendTopicMessage,
    StartTopicTask,
    UpdateProject,
    UpdateTopic,
    UpdateWorkspace,
)

__all__ = [
    "ListSkills",
    "GetSkill",
    "CreateSkill",
    "PrepareSkillPublish",
    "PublishSkill",
    "GetSkillPublishResult",

    "DummyTool",
    "AskUserTool",
    "MicroAppPlanTool",
    "UpdateHtmlAppMemory",

    # 核心组件
    "BaseTool",
    "BaseToolParams",
    "tool",
    "tool_factory",

    # 工具类
    "AbstractFileTool",
    "AnalysisSlideWebpage",
    "WebSearch",
    "FindAgentsTool",
    "GetHtmlDesignStyleSource",
    "CallSubagent",
    "WaitForSubagents",
    "ConnectDingTalkBot",
    "ConnectLarkBot",
    "ConnectWecomBot",
    "ConnectWechatBot",
    "WaitWechatLogin",
    "SendWechatMessage",
    "CompactChatHistory",
    "ListChatHistory",
    "SearchChatHistory",
    "ReadChatHistory",
    "BuildDocumentIndex",
    "ConvertDocumentFormat",
    "ExportDocumentMarkdown",
    "ExtractDocumentContent",
    "InspectDocument",
    "PlanDocumentReading",
    "SampleDocumentContent",
    "SummarizeDocument",
    "UnderstandDocumentImages",
    "CliManagerApply",
    "CliManagerList",
    "CliManagerRemove",
    "StartupTaskCreate",
    "StartupTaskDelete",
    "StartupTaskList",
    "StartupTaskRun",
    "StartupTaskUpdate",
    "GetEnv",
    "ListEnv",
    "SetEnv",
    "UnsetEnv",
    "CreateFileShare",
    "CreateProjectShare",
    "CreateTopicShare",
    "DeleteShare",
    "GetShare",
    "InspectFileShare",
    "ListFileShares",
    "ListProjectShares",
    "ListTopicShares",
    "UpdateFileShare",
    "UpdateProjectShare",
    "UpdateTopicShare",
    "CreateSlide",
    "CreateSlideProject",
    "UpdateSlideTransitions",
    "CreateSlideTemplateProject",
    "FinalizeSlideTemplate",
    "PrepareSlideTemplateSource",
    "QuerySlideTemplateTaxonomy",
    "ReviewSlideTemplateSource",
    "SelectSlideTemplateSourceAssets",
    "DeepWrite",
    "DeleteFiles",
    "DownloadFromMarkdown",
    "DownloadFromUrl",
    "DownloadFromUrls",
    "EditFile",
    "EditFileRanges",
    "FindFileRanges",
    "MultiEditFile",
    "FileSearch",
    "GetJsCdnAddress",
    "GetSandboxInfo",
    "GetUserLanguage",
    "GrepSearch",
    "ImageSearch",
    "GenerateImages",
    "GenerateVideo",
    "GetIMChannelStatus",
    "FindSkillsTool",
    "GetUserInfo",
    "QueryMagicTables",
    "QueryMagicTablesAllMentionedApps",
    "GetMagicTable",
    "BatchGetMagicRows",
    "CreateMagicTable",
    "CreateMagicColumn",
    "InstallSkillsTool",
    "ListDir",
    "Purify",
    "RunPythonSnippet",
    "ReadSkills",
    "RunSdkSnippet",
    "SearchKnowledge",
    "InstallSlidesTemplate",
    "ReadFile",
    "InspectMemory",
    "InspectPathStorage",
    "ReadFiles",
    "CreateClientSideFileBundle",
    "ReadWebpagesAsMarkdown",
    "Reflection",
    "ShellExec",
    "ShellAwait",
    "Summarize",
    "PersonaChat",
    "CheckInterviews",
    "FinishPersonaTranscript",
    "SavePersonas",
    "AttachPersonaPortrait",
    "AssignPersonaPortraits",
    "EmbedPersonaPortraits",
    "SaveStudySynthesis",
    "SaveValidationQuestionnaire",
    "UpdateStudy",
    "Thinking",
    "TodoRead",
    "TodoCreate",
    "TodoUpdate",
    "RestartSandbox",
    "UpgradeSandbox",
    "BrowserSelectInstance",
    "BrowserSelectTab",
    "BrowserActivateTab",
    "BrowserAddInitScript",
    "BrowserCheck",
    "BrowserClick",
    "BrowserCloseTab",
    "BrowserEvaluate",
    "BrowserFill",
    "BrowserFindVisual",
    "BrowserFind",
    "BrowserHover",
    "BrowserKeepAlive",
    "BrowserListTabs",
    "BrowserListInstances",
    "BrowserNavigate",
    "BrowserNewTab",
    "BrowserPress",
    "BrowserReadConsole",
    "BrowserReadHtml",
    "BrowserReadNetwork",
    "BrowserReadPage",
    "BrowserScreenshot",
    "BrowserScroll",
    "BrowserSelect",
    "BrowserListElements",
    "BrowserUploadFile",
    "BrowserVisualQuery",
    "BrowserWait",
    "VisualUnderstanding",
    "VisualUnderstandingWebpage",
    "VideoUnderstanding",
    "WriteFile",
    "ManageCron",
    "ManageCalendar",
    "CreateCalendarProject",
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

    # 独立 Canvas Agent 工具
    "QueryCanvasLayout",
    "ArrangeCanvasElements",
    "RenameCanvasElements",
    "UnframeCanvasElements",
    "DeleteCanvasElements",
    "AddCanvasContents",
    "AddCanvasElements",
    "InitializeCanvas",
    "LayoutCanvasElements",
    "ManageCanvasConnections",
    "QueryCanvasElementDetails",
    "QueryCanvasOverview",
    "RetryCanvasContentGeneration",
    "SelectCanvasMainContent",
    "WaitCanvasGeneration",
    "EstimateCanvasContentPoints",
    "CanvasSearchCanvasImages",
    "SearchCanvasImagePrompts",

    # MCP 工具集
    "McpAddServer",
    "McpCallTool",
    "McpConnectServer",
    "McpGetToolSchema",
    "McpListServers",
    "McpListTools",

    # OAuth2 工具集
    "OAuth2CheckAuthorization",
    "OAuth2GetApiDoc",
    "OAuth2GetRedirectUri",
    "OAuth2ListApiDocs",
    "OAuth2ListApps",
    "OAuth2RemoveApiDoc",
    "OAuth2RemoveApp",
    "OAuth2Request",
    "OAuth2StartAuthorization",
    "OAuth2UpsertApiDoc",
    "OAuth2UpsertApp",

    # 定时任务工具集
    "ScheduledTaskCreate",
    "ScheduledTaskDelete",
    "ScheduledTaskGet",
    "ScheduledTaskList",
    "ScheduledTaskUpdate",

    # Remote 工具集
    "CallAssistant",
    "CallSimpleAgent",
    "CallSimpleTool",
    # Super Magic 产品工具集
    "ArchiveTopic",
    "ArchiveWorkspace",
    "CancelTopicTask",
    "CopyProjectFiles",
    "CreateProject",
    "CreateProjectDirectory",
    "CreateTopic",
    "CreateWorkspace",
    "DeleteProject",
    "DeleteProjectFiles",
    "DeleteTopic",
    "DeleteTopicQueuedMessage",
    "DeleteWorkspace",
    "GetFileBatchStatus",
    "GetProject",
    "GetProjectFile",
    "GetTopic",
    "GetTopicTask",
    "GetWorkspace",
    "ListProjectFiles",
    "ListProjects",
    "ListTopicQueuedMessages",
    "ListTopics",
    "ListWorkspaces",
    "MoveProject",
    "MoveProjectFiles",
    "PrepareProjectFiles",
    "ReadTopicMessages",
    "RenameProjectFile",
    "SearchProjectFiles",
    "SearchUsers",
    "SearchDepartments",
    "SendTopicMessage",
    "StartTopicTask",
    "UpdateProject",
    "UpdateTopic",
    "UpdateWorkspace",
]
