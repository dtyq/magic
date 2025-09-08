import time
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field

from agentlang.event.event import EventType
from agentlang.utils.snowflake import Snowflake
from app.core.entity.attachment import Attachment
from app.core.entity.message.message import MessageType
from app.core.entity.project_archive import ProjectArchiveInfo
from agentlang.llms.token_usage.models import TokenUsageReport


class TaskStatus(str, Enum):
    """任务状态枚举"""

    WAITING = "waiting"
    RUNNING = "running"
    FINISHED = "finished"
    ERROR = "error"
    SUSPENDED = "suspended"

class ToolStatus(str, Enum):
    """工具调用状态枚举"""

    WAITING = "waiting"
    RUNNING = "running"
    FINISHED = "finished"
    ERROR = "error"


class DisplayType(str, Enum):
    """展示类型枚举"""

    TEXT = "text"
    MD = "md"
    HTML = "html"
    TERMINAL = "terminal"
    BROWSER = "browser"
    SEARCH = "search"
    SCRIPT = "script"
    CODE = "code"
    ASK_USER = "ask_user"  # 添加ASK_USER枚举值


class TaskStep(BaseModel):
    """任务步骤模型"""

    id: str  # 步骤ID，使用雪花ID
    title: str  # 步骤标题
    status: TaskStatus  # 步骤状态


class FileContent(BaseModel):
    """文本、Markdown、HTML文件内容模型"""

    file_name: str  # 文件名
    content: str  # 文件内容


class TerminalContent(BaseModel):
    """终端内容模型"""

    command: str  # 终端命令
    output: str  # 终端输出
    exit_code: int  # 终端退出码


class ScriptExecutionContent(BaseModel):
    """脚本执行内容模型"""

    code: str  # 执行的代码内容
    args: Optional[str] = None  # 命令行参数
    stdout: str  # 标准输出
    stderr: str  # 标准错误
    exit_code: int  # 退出码
    success: bool  # 执行是否成功


class BrowserContent(BaseModel):
    """浏览器内容模型"""

    url: str  # 浏览器URL
    title: str  # 浏览器标题
    file_key: Optional[str] = None  # 浏览器截图


class SearchResultItem(BaseModel):
    """搜索结果项模型"""

    title: str  # 搜索结果标题
    url: str  # 搜索结果URL
    snippet: str  # 搜索结果描述
    icon_url: Optional[str] = None  # 添加网站图标URL字段


class SearchGroupItem(BaseModel):
    """搜索分组模型"""

    keyword: str  # 搜索关键词
    results: List[SearchResultItem]  # 该关键词的搜索结果列表


class SearchContent(BaseModel):
    """搜索内容模型"""

    groups: List[SearchGroupItem]  # 多组搜索结果，每组对应一个关键词


class DeepWriteContent(BaseModel):
    """深度写作内容模型"""

    title: str  # 深度写作标题
    reasoning_content: str  # 深度写作过程内容
    content: str  # 深度写作结论


class AskUserContent(BaseModel):
    """用户提问内容模型"""

    content: str  # 提问内容
    question_type: Optional[str] = None  # 问题类型，可选参数

class ToolDetail(BaseModel):
    """工具详情模型"""

    type: DisplayType  # 展示类型
    data: Union[
        FileContent, TerminalContent, BrowserContent, SearchContent,
        ScriptExecutionContent, DeepWriteContent, AskUserContent, Dict[str, Any]
    ]  # 展示内容，根据type动态展示

    model_config = ConfigDict(use_enum_values=True)


class Tool(BaseModel):
    """工具模型"""

    id: str  # 工具调用id
    name: str  # 工具名称
    action: Optional[str] = None  # 工具执行操作
    status: ToolStatus  # 当前工具调用状态
    remark: Optional[str] = None  # 备注说明
    detail: Optional[ToolDetail] = None  # 工具详情
    attachments: Optional[List[Attachment]] = None  # 附件列表


class ServerMessagePayload(BaseModel):
    """任务消息模型"""

    message_id: str
    type: Union[MessageType, str]  # 消息类型
    task_id: str  # 当前任务id
    status: TaskStatus  # 任务状态
    content: str = Field(default="")  # 消息内容
    sandbox_id: Optional[str] = None  # 沙箱ID
    steps: Optional[List[TaskStep]] = None  # 任务步骤列表
    tool: Optional[Tool] = None  # 工具信息
    attachments: Optional[List[Attachment]] = None  # 附件列表
    send_timestamp: int  # 发送时间的秒级时间戳
    event: Optional[EventType] = None  # 事件类型，可选参数
    project_archive: Optional[ProjectArchiveInfo] = None  # 项目压缩包信息
    show_in_ui: bool = True  # 是否在UI中显示消息

    model_config = ConfigDict(use_enum_values=True)  # 使用枚举值而不是枚举对象

    @property
    def is_empty(self) -> bool:
        """
        判断消息是否为空

        Returns:
            bool: 如果消息内容为空且工具详情为空，则返回True，否则返回False
        """
        return not self.content and (not self.tool or (not self.tool.action and not self.tool.detail))

    @classmethod
    def create(
        cls,
        task_id: str,
        message_type: MessageType,
        status: TaskStatus,
        content: str,
        sandbox_id: Optional[str] = None,
        tool: Optional[Tool] = None,
        steps: Optional[List[TaskStep]] = None,
        attachments: Optional[List[Attachment]] = None,
        event: Optional[EventType] = None,
        project_archive: Optional[ProjectArchiveInfo] = None,
        show_in_ui: bool = True,  # 新增参数，默认为True
    ) -> "ServerMessagePayload":
        """
        创建任务消息的工厂方法

        Args:
            task_id: 任务ID
            message_type: 消息类型
            status: 任务状态
            content: 消息内容
            sandbox_id: 沙箱ID，可选
            tool: 可选的工具信息
            steps: 可选的任务步骤列表
            attachments: 可选的附件列表
            event: 可选的事件类型
            project_archive: 可选的项目压缩包信息
            show_in_ui: 是否在UI中显示，默认为True
        """
        # 使用雪花算法生成ID
        snowflake = Snowflake.create_default()

        return ServerMessagePayload(
            message_id=str(snowflake.get_id()),
            type=message_type,
            task_id=task_id,
            status=status,
            content=content,
            sandbox_id=sandbox_id,
            tool=tool,
            steps=steps,
            attachments=attachments,
            send_timestamp=int(time.time()),
            event=event,
            project_archive=project_archive,
            show_in_ui=show_in_ui,  # 传递显示标志
        )

class ServerMessage(BaseModel):
    """任务消息模型"""

    metadata: Dict[str, Any]
    payload: ServerMessagePayload
    token_usage_details: Optional[TokenUsageReport] = Field(default=None, description="Details of token usage for the current operation/LLM call")

    @classmethod
    def create(cls, metadata: Dict[str, Any], payload: ServerMessagePayload, token_usage_details: Optional[TokenUsageReport] = None) -> "ServerMessage":
        return ServerMessage(
            metadata=metadata,
            payload=payload,
            token_usage_details=token_usage_details
        )
