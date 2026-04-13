import time
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field

from agentlang.event.event import EventType
from agentlang.llms.token_usage.models import TokenUsageCollection
from agentlang.utils.snowflake import Snowflake
from app.core.entity.attachment import Attachment
from app.core.entity.message.message import MessageType
from app.core.entity.project_archive import ProjectArchiveInfo


class TaskStatus(str, Enum):
    """任务状态枚举"""

    WAITING = "waiting"
    RUNNING = "running"
    FINISHED = "finished"
    ERROR = "error"
    SUSPENDED = "suspended"
    WAITING_FOR_USER = "waiting_for_user"  # ask_user 等待态对前端暴露的通用任务状态

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
    CODE = "code"
    IMAGE = "image"  # 添加IMAGE枚举值
    MCP_TOOL_CALL = "mcp_tool_call"  # 添加MCP工具调用枚举值
    MCP_INIT = "mcp_init"  # 添加MCP初始化枚举值
    FILE_TREE = "file_tree"  # 添加文件树枚举值
    TODO = "todo"  # 添加TODO枚举值
    DESIGN = 'design'
    ASK_USER = "ask_user"  # ask_user 问答结果展示


class TodoOperationType(str, Enum):
    """Todo操作类型枚举"""

    CREATE = "create"
    UPDATE = "update"
    READ = "read"


class FileTreeNodeType(str, Enum):
    """文件树节点类型枚举"""

    DIRECTORY = "directory"
    FILE = "file"


class TaskStep(BaseModel):
    """任务步骤模型"""

    id: str  # 步骤ID，使用雪花ID
    title: str  # 步骤标题
    status: TaskStatus  # 步骤状态


class FileContent(BaseModel):
    """文本、Markdown、HTML文件内容模型"""

    file_name: str  # 文件名
    content: str  # 文件内容


class FileTreeNode(BaseModel):
    """文件树节点模型"""

    file_name: str  # 文件/目录名
    relative_file_path: str  # 相对路径
    is_directory: bool  # 是否为目录
    file_size: Optional[int] = None  # 文件大小（字节），目录为None
    updated_at: str  # 修改时间，格式为 "2025-07-31 21:46:26"
    children: Optional[List['FileTreeNode']] = None  # 子节点（仅目录有）
    type: FileTreeNodeType  # 节点类型枚举
    error: Optional[str] = None  # 错误信息（如权限错误、访问错误等）


class FileTreeContent(BaseModel):
    """文件树内容模型"""

    root_path: str  # 根路径
    level: int  # 扫描层级
    filter_binary: bool  # 是否过滤二进制文件
    total_files: int  # 总文件数
    total_dirs: int  # 总目录数
    total_size: int  # 总大小（字节）
    tree: List[FileTreeNode]  # 文件树结构


class CodeContent(BaseModel):
    """代码内容模型"""
    content: str  # 代码内容
    file_extension: str  # 文件扩展名

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


class TodoContent(BaseModel):
    """Todo内容模型

    用于在前端展示 todo 操作的详细信息。

    Attributes:
        type: 操作类型
            - CREATE: 创建新的 todo 项（来自 todo_create 工具）
            - UPDATE: 更新已存在的 todo 项状态（来自 todo_update 工具）
            - READ: 读取当前 todo 列表（来自 todo_read 工具）
        items: todo 项列表
            - 对于 CREATE: 包含新创建的完整 todo 项（id, content, status, created_at, updated_at）
            - 对于 UPDATE: 包含更新的项（id, status）
            - 对于 READ: 包含所有 todo 项
    """

    type: TodoOperationType  # 操作类型
    items: List[Dict[str, Any]]  # todo项列表


class DesignCanvasContent(BaseModel):
    """设计画布内容模型 - canvas 类型

    用于展示设计项目创建相关的信息

    Attributes:
        type: 固定为 "canvas"
        project_path: 设计项目的相对路径
    """

    type: str = Field(default="canvas")  # 固定为 "canvas"
    project_path: str  # 设计项目路径


class DesignElementContent(BaseModel):
    """设计元素内容模型 - element 类型

    用于展示画布元素操作（创建、更新、删除等）的详细信息

    Attributes:
        type: 固定为 "element"
        project_path: 设计项目的相对路径
        elements: 本次操作的所有元素详情列表，每个元素包含完整的属性信息
            - 通用属性：id, name, type, position, size, layer, status
            - 类型特定属性：image_properties, text_properties, shape_properties, container_properties
    """

    type: str = Field(default="element")  # 固定为 "element"
    project_path: str  # 设计项目路径
    elements: List[Dict[str, Any]]  # 元素详情列表


class AskUserQuestionContent(BaseModel):
    """ask_user 问题卡片内容模型

    用于在 BEFORE_TOOL_CALL 消息中向前端推送待回答的问题列表。

    Attributes:
        question_id: 本次问答的唯一 ID，前端用于关联后续 AFTER_TOOL_CALL 消息
        questions:   子问题列表（含 sub_id、question、interaction_type 等）
        expires_at:  问题过期时间戳（Unix 秒），前端用于显示倒计时
        status:      固定为 "pending"
    """

    question_id: str
    questions: List[Dict[str, Any]]
    expires_at: int
    status: str


class AskUserResultContent(BaseModel):
    """ask_user 问答结果内容模型

    用于在 AFTER_TOOL_CALL 消息中展示用户对 ask_user 问题的最终答案。

    Attributes:
        status:    处理结果状态：answered=已回答，skipped=已跳过，timeout=已超时，cancelled=被新消息打断
        questions: 原始问题列表（含 sub_id、question、interaction_type 等）；
                   timeout 消息由 Python 直接发送时提供，PHP 发送时可省略
        answers:   用户答案字典，key 为 sub_id，value 为对应答案；skipped/timeout 时为 {}
    """

    status: str
    questions: Optional[List[Dict[str, Any]]] = None
    answers: Dict[str, Any]


class ToolDetail(BaseModel):
    """工具详情模型"""

    type: DisplayType  # 展示类型
    data: Union[
        FileContent, FileTreeContent, TerminalContent, BrowserContent, SearchContent,
        ScriptExecutionContent, DeepWriteContent, TodoContent, DesignCanvasContent, DesignElementContent,
        AskUserQuestionContent, AskUserResultContent, Dict[str, Any]
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
    seq_id: int  # 任务内消息序列号
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
    correlation_id: Optional[str] = None  # 关联ID，用于关联相关消息
    parent_correlation_id: Optional[str] = None  # 父级关联ID，用于 Agent 循环周期分组（指向 THINK 容器的 correlation_id）
    content_type: Optional[str] = None  # 内容类型："reasoning"（思考内容）| "content"（回复内容），仅 agent_reply 消息使用
    token_used: Optional[int] = None    # 会话消耗的 token 总量，仅 AFTER_MAIN_AGENT_RUN 消息携带
    raw_content: Optional[Dict[str, Any]] = None  # V2 结构化消息内容（super_magic_message / super_magic_chunk）

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
        seq_id: int,  # 新增：消息序列号
        sandbox_id: Optional[str] = None,
        tool: Optional[Tool] = None,
        steps: Optional[List[TaskStep]] = None,
        attachments: Optional[List[Attachment]] = None,
        event: Optional[EventType] = None,
        project_archive: Optional[ProjectArchiveInfo] = None,
        show_in_ui: bool = True,  # 新增参数，默认为True
        correlation_id: Optional[str] = None,  # 关联ID，默认为None
        parent_correlation_id: Optional[str] = None,  # 父级关联ID，用于 Agent 循环周期分组
        content_type: Optional[str] = None,  # 内容类型："reasoning" | "content"，仅 agent_reply 消息使用
        token_used: Optional[int] = None,  # 会话消耗的 token 总量，仅 AFTER_MAIN_AGENT_RUN 消息携带
        raw_content: Optional[Dict[str, Any]] = None,  # V2 结构化消息内容
        message_id: Optional[str] = None,  # 预生成的消息ID（不传则自动雪花生成）
    ) -> "ServerMessagePayload":
        """
        创建任务消息的工厂方法

        Args:
            task_id: 任务ID
            message_type: 消息类型
            status: 任务状态
            content: 消息内容
            seq_id: 消息序列号
            sandbox_id: 沙箱ID，可选
            tool: 可选的工具信息
            steps: 可选的任务步骤列表
            attachments: 可选的附件列表
            event: 可选的事件类型
            project_archive: 可选的项目压缩包信息
            show_in_ui: 是否在UI中显示，默认为True
            correlation_id: 关联ID，用于关联相关消息，默认为None
            parent_correlation_id: 父级关联ID，用于 Agent 循环周期分组，默认为None
            content_type: 内容类型，"reasoning"（思考内容）或 "content"（回复内容），仅 agent_reply 消息使用，默认为 None

        Returns:
            ServerMessagePayload: 创建的任务消息载荷对象
        """
        # 使用雪花算法生成ID（如果没有预生成的 message_id）
        if message_id is None:
            snowflake = Snowflake.create_default()
            message_id = str(snowflake.get_id())

        return ServerMessagePayload(
            message_id=message_id,
            type=message_type,
            task_id=task_id,
            seq_id=seq_id,  # 传递序列号
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
            correlation_id=correlation_id,  # 传递关联ID
            parent_correlation_id=parent_correlation_id,  # 传递父级关联ID
            content_type=content_type,  # 传递内容类型
            token_used=token_used,  # 传递 token 总量
            raw_content=raw_content,  # 传递 V2 结构化消息内容
        )

class ServerMessage(BaseModel):
    """任务消息模型"""

    metadata: Dict[str, Any]
    payload: ServerMessagePayload
    # token_usage_details is excluded from JSON serialization (not sent to frontend)
    token_usage_details: Optional[TokenUsageCollection] = Field(default=None, exclude=True)

    @classmethod
    def create(cls, metadata: Dict[str, Any], payload: ServerMessagePayload, token_usage_details: Optional[TokenUsageCollection] = None) -> "ServerMessage":
        return ServerMessage(
            metadata=metadata,
            payload=payload,
            token_usage_details=token_usage_details
        )
