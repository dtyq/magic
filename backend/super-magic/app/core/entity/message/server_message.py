import time
from enum import Enum
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field

from agentlang.event.event import EventType
from agentlang.llms.token_usage.models import TokenUsageCollection
from agentlang.utils.snowflake import Snowflake
from app.core.entity.attachment import Attachment, AttachmentStorageType, AttachmentTag
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
    SCRIPT_EXECUTION = "script_execution"
    BROWSER = "browser"
    SEARCH = "search"
    CODE = "code"
    IMAGE = "image"  # 添加IMAGE枚举值
    MCP_TOOL_CALL = "mcp_tool_call"  # 添加MCP工具调用枚举值
    MCP_INIT = "mcp_init"  # 添加MCP初始化枚举值
    FILE_TREE = "file_tree"  # 添加文件树枚举值
    TODO = "todo"  # 添加TODO枚举值
    SUBAGENTS = "subagents"  # 等待子 Agent 的进度与结果，在消息卡片内展开
    DESIGN = 'design'
    ASK_USER = "ask_user"  # ask_user 问答结果展示
    PLAN = "plan"  # 开发计划确认展示
    GENERATION_PROGRESS = "generation_progress"  # 生成进度：只带预期完成时间，百分比由前端换算
    OPERATION_RESULT_LIST = "operation_result_list"  # 简短操作结果，在消息卡片内展开
    FILE_DOWNLOAD = "file_download"
    STUDY_PROGRESS = "study_progress"  # AI 研究的阶段进度（update_study）
    PERSONA_CHAT = "persona_chat"  # AI 研究访谈的一轮问答（persona_chat）
    STUDY_PERSONAS = "study_personas"  # AI 研究保存的人设名单（save_personas）


class BrowserDetailStatus(str, Enum):
    """Browser 工具面向用户的结果状态。"""

    SUCCEEDED = "succeeded"
    FAILED = "failed"


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
    relative_file_path: Optional[str] = None  # 工作区内文件的相对路径
    storage_type: Optional[AttachmentStorageType] = None  # 文件生命周期所属的存储类型
    target_file_id: Optional[str] = None  # 实际操作文件的 ID；不与回放正文的 file_id 混用
    target_file_path: Optional[str] = None  # 实际目标：工作区内相对路径，用户空间绝对路径


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


class UnexpansionReason(str, Enum):
    """某个目录没有被完整读出来的原因。

    四种原因的共同含义只有一个：**该目录的真实内容没有被观测到**。区分原因是给
    消费方和排查用的，不是给消费方推断"里面有什么"用的。

    这个类型存在的原因是此前的节点预算会把"没读到"表达成"不存在"：被截断的子树
    从条目集合里消失，上一层据此认为这些路径被删除了。任何一次未完整读取都必须
    留下记录，消费方才能把"目录是空的"和"目录没被读过"分开。
    """

    NODE_BUDGET = "node_budget"  # 达到条目数预算
    BYTE_BUDGET = "byte_budget"  # 达到输出体积预算
    TIME_BUDGET = "time_budget"  # 达到扫描时间预算
    UNREADABLE = "unreadable"    # 目录打不开


class UnexpandedDirectory(BaseModel):
    """本次扫描未能完整读取的一个目录。"""

    path: str  # 相对 root_path 的路径；根目录本身为 root_path 的取值
    reason: UnexpansionReason


class DirectoryScanFailure(str, Enum):
    """整次扫描未能开始或中途失败的原因；None 表示扫描本身跑完了。"""

    NOT_FOUND = "not_found"              # 路径不存在
    NOT_A_DIRECTORY = "not_a_directory"  # 路径存在但不是目录
    UNREADABLE = "unreadable"            # 扫描过程中抛出未预期的错误


class FileTreeContent(BaseModel):
    """文件树内容模型

    `tree` 只保证包含"已观测到"的节点。判断一份结果能不能当作完整事实使用，看
    `complete`，不要看 `total_files`/`total_dirs`（它们统计的是已观测到的数量）。
    """

    root_path: str  # 根路径
    level: int  # 扫描层级
    filter_binary: bool  # 是否过滤二进制文件
    total_files: int  # 已观测到的文件数
    total_dirs: int  # 已观测到的目录数
    total_size: int  # 已观测到的文件总大小（字节）
    tree: List[FileTreeNode]  # 文件树结构
    unexpanded: List[UnexpandedDirectory] = []  # 未完整读取的目录；空表示没有预算缺口
    failure: Optional[DirectoryScanFailure] = None  # 整次扫描的失败原因
    failure_detail: Optional[str] = None  # 失败的原始错误文本，仅用于日志和排查

    @property
    def complete(self) -> bool:
        """扫描深度内，是否每个存在的路径都出现在 `tree` 里。

        注意 `level` 造成的深度边界**不算**不完整：那是调用方要求的语义，不是预算
        缺口。只有预算缺口和读取失败才算——这是"集合差能不能用来推断增删"的唯一依据。
        """
        return self.failure is None and not self.unexpanded


class CodeContent(BaseModel):
    """代码内容模型"""
    content: str  # 代码内容
    file_extension: str  # 文件扩展名

class TerminalContent(BaseModel):
    """终端内容模型"""

    command: str  # 终端命令
    output: str  # 终端输出
    exit_code: int  # 终端退出码


class SubagentsPhase(str, Enum):
    """子 Agent 卡片所处阶段：同一张卡片先显示等待进度，工具调用结束后变成结果。"""

    WAITING = "waiting"
    SETTLED = "settled"


class SubagentItemContent(BaseModel):
    """子 Agent 卡片里的一行。"""

    agent_id: str
    label: str
    # 取值同 SubagentQueryStatus：done / error / interrupted / running / pending / not_found / ambiguous
    status: str
    # 运行中为已用时，已结束为总耗时；没有开始时间时为空。由前端按用户语言格式化
    elapsed_seconds: Optional[int] = None
    last_activity: Optional[str] = None
    result: Optional[str] = None
    error: Optional[str] = None


class SubagentsContent(BaseModel):
    """等待子 Agent 卡片的数据。

    | 字段 | 服务谁 |
    | message | 收起时的单行头部，也作为 remark；必须短，不放名单 |
    | progress / indeterminate | 头部进度：已结束个数 / 总数；只等一个时为不确定态 |
    | agents | 展开后的逐行列表，名单、状态和结果只放这里 |
    """

    progress: int
    indeterminate: bool
    message: str
    total_agents: int
    finished_agents: int
    elapsed_seconds: int
    phase: SubagentsPhase
    agents: List[SubagentItemContent]


class StudyPhaseItemContent(BaseModel):
    """研究阶段的一格。key 取 clarify / plan / desk_research / interview / report / validation。"""

    key: str
    # done / running / pending / skipped / failed
    status: str


class StudyProgressContent(BaseModel):
    """update_study 卡片：本次事件后的 6 个阶段快照。阶段名由前端按研究页文案显示。"""

    phase: str  # 当前阶段；全部完成时为 done
    phases: List[StudyPhaseItemContent]


class PersonaPortraitHint(BaseModel):
    """前端画人设头像用的性别和年龄原文，与研究页读 demographics 的口径一致；缺失时为空。"""

    gender: str = ""
    age: str = ""


class PersonaChatAnswerContent(PersonaPortraitHint):
    persona_id: str
    name: str
    text: str


class PersonaChatFailureContent(PersonaPortraitHint):
    persona_id: str
    name: str
    reason: str  # 已按用户语言翻译、脱敏的原因


class PersonaChatContent(BaseModel):
    """persona_chat 卡片：主持人问题和受访者回答。

    | 情况 | answers | failed | error |
    | 全部回答 | 有 | 空 | 空 |
    | 小组部分失败 | 有 | 有 | 空 |
    | 整次请求被拒（路径、轮次不对） | 空 | 空 | 有 |
    round_number 只在写入访谈记录时有值；round_limit 是这份记录允许的最多轮数。
    error_reason 是 error 对应的原因码（invalid_request、profile_unavailable、model_error、empty_answer），
    没有整体错误时为空。前端据此区分「AI 自己改问法」（invalid_request，可预期）和真正的失败，不必比对翻译文案。
    """

    question: str
    round_number: Optional[int] = None
    round_limit: Optional[int] = None
    answers: List[PersonaChatAnswerContent]
    failed: List[PersonaChatFailureContent]
    error: str = ""
    error_reason: str = ""


class StudyPersonaItemContent(PersonaPortraitHint):
    persona_id: str
    name: str
    tagline: str
    segment: str
    reused: bool


class StudyPersonasContent(BaseModel):
    """save_personas 卡片：头像组加「新建 X · 复用 Y」，名单按访谈顺序。"""

    panel_name: str
    new_count: int
    reused_count: int
    personas: List[StudyPersonaItemContent]


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
    file_size: int = Field(default=0, ge=0)  # 截图文件大小
    file_url: Optional[str] = None  # 仅本地调试即时预览使用
    storage_type: AttachmentStorageType = AttachmentStorageType.TOPIC  # 截图生命周期归属
    file_tag: AttachmentTag = AttachmentTag.BROWSER  # 文件业务类型
    action: Optional[str] = None  # 用户可理解的操作名称
    summary: Optional[str] = None  # 本次操作结果摘要
    detail: Optional[str] = None  # 脱敏后供用户查看的结构化 Markdown 详情
    page_title: Optional[str] = None  # 当前页面标题
    target: Optional[str] = None  # 本次操作对象
    status: Optional[BrowserDetailStatus] = None  # 本次操作状态


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
    query: str | None = None  # 实际查询词；旧详情缺失时仍由 keyword 完整展示


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
        question_id: 本次问答的唯一 ID，前端用于匹配 BEFORE_TOOL_CALL 时创建的卡片并就地更新
        status:    处理结果状态：answered=已回答，skipped=已跳过，timeout=已超时，cancelled=被新消息打断
        questions: 原始问题列表（含 sub_id、question、interaction_type 等）；
                   timeout 消息由 Python 直接发送时提供，PHP 发送时可省略
        answers:   用户答案字典，key 为 sub_id，value 为对应答案；skipped/timeout 时为 {}
        remark:    用户提交答案时填写的追加备注，没有备注时省略
    """

    question_id: Optional[str] = None
    status: str
    questions: Optional[List[Dict[str, Any]]] = None
    answers: Dict[str, Any]
    # 用户提交答案时填写的追加备注，可选且不影响旧版消息结构。
    remark: Optional[str] = None


class PlanFileContent(BaseModel):
    """开发计划中的文件项。"""

    path: str
    purpose: str


class PlanDataModelContent(BaseModel):
    """开发计划中的数据模型项。"""

    table_name: str
    purpose: str
    fields: List[Union[str, Dict[str, Any]]] = Field(default_factory=list)


class PlanToolContent(BaseModel):
    """开发计划确认卡片内容模型。

    用于 plan 工具在 BEFORE/AFTER_TOOL_CALL 消息中向前端展示方案、
    用户确认状态和修改意见。
    """

    plan_id: Optional[str] = None
    status: str
    title: str
    summary: str
    app_type: str = ""
    requirements: List[str] = Field(default_factory=list)
    implementation_steps: List[str] = Field(default_factory=list)
    files: List[PlanFileContent] = Field(default_factory=list)
    data_model: List[PlanDataModelContent] = Field(default_factory=list)
    acceptance_criteria: List[str] = Field(default_factory=list)
    assumptions: List[str] = Field(default_factory=list)
    response: Optional[str] = None
    expires_at: int = 0


class OperationResultKind(str, Enum):
    FILE = "file"
    DIRECTORY = "directory"
    TEXT = "text"


class OperationResultStatus(str, Enum):
    SUCCESS = "success"
    ERROR = "error"
    SKIPPED = "skipped"


class OperationResultTargetType(str, Enum):
    CANVAS_ELEMENT = "canvas_element"
    FILE = "file"
    URL = "url"


class OperationResultTarget(BaseModel):
    """结果项的可选导航目标。"""

    type: Literal[OperationResultTargetType.CANVAS_ELEMENT]
    project_path: str
    element_id: str
    content_id: str | None = None
    content_type: Literal["image", "video", "audio"] | None = None


class OperationResultFileTarget(BaseModel):
    """当前项目文件的预览目标，不包含沙盒绝对路径或临时下载地址。"""

    type: Literal[OperationResultTargetType.FILE]
    relative_file_path: str


class OperationResultUrlTarget(BaseModel):
    """原网页入口；展示来源与导航 URL 分开处理。"""

    type: Literal[OperationResultTargetType.URL] = OperationResultTargetType.URL
    url: str


class OperationResultChanges(BaseModel):
    added_lines: int = Field(ge=0)
    deleted_lines: int = Field(ge=0)
    modified_lines: int = Field(default=0, ge=0)


OperationResultStage = Literal["read", "edit", "find", "download", "analyze", "load"]


class OperationResultSummary(BaseModel):
    stage: OperationResultStage | None = None
    total_count: int | None = Field(default=None, ge=0)
    success_count: int | None = Field(default=None, ge=0)
    failed_count: int | None = Field(default=None, ge=0)
    skipped_count: int | None = Field(default=None, ge=0)
    omitted_count: int | None = Field(default=None, ge=0)


class OperationResultItem(BaseModel):
    """已执行对象的展示结果；target 仅在工具提供可靠导航目标时存在。"""

    label: str
    kind: OperationResultKind
    status: OperationResultStatus
    message: str
    description: str = ""
    target: OperationResultTarget | OperationResultFileTarget | OperationResultUrlTarget | None = None
    changes: OperationResultChanges | None = None
    started_at: str | None = None
    expected_finished_at: str | None = None
    is_processing: bool | None = None


class OperationResultListContent(OperationResultSummary):
    """有限的逐项结果随消息保存；大报告仍使用原有文件正文持久化。"""

    items: list[OperationResultItem] = Field(min_length=1)


class OperationResultListReportContent(FileContent, OperationResultSummary):
    """图片清单随消息保存；报告正文保留在顶层，沿用既有文件化出口。"""

    items: list[OperationResultItem] = Field(min_length=1)
    file_id: str | None = None
    file_extension: str | None = None
    report_type: DisplayType | None = None


class FileDownloadItem(BaseModel):
    """原文件引用；下载时按 ID 授权，路径只用于 ZIP 内目录。"""

    file_id: str
    relative_file_path: str
    file_name: str
    file_size: int = Field(ge=0)


class FileDownloadContent(BaseModel):
    """完整下载集合随消息保存，不包含正文、临时地址或存储凭证。"""

    title: str
    archive_name: str
    project_id: str
    total_bytes: int = Field(ge=0)
    items: list[FileDownloadItem] = Field(min_length=1)


class ToolDetail(BaseModel):
    """工具详情模型"""

    type: DisplayType  # 展示类型
    data: Union[
        OperationResultListReportContent, FileDownloadContent, FileContent, FileTreeContent, TerminalContent, BrowserContent, SearchContent,
        ScriptExecutionContent, DeepWriteContent, TodoContent, DesignCanvasContent, DesignElementContent,
        AskUserQuestionContent, AskUserResultContent, PlanToolContent, SubagentsContent, OperationResultListContent,
        StudyProgressContent, PersonaChatContent, StudyPersonasContent, Dict[str, Any]
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
