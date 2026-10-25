"""
客户端消息结构定义

定义客户端发送给服务端的WebSocket消息结构
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Union

from agentlang.environment import Environment
from pydantic import BaseModel, Field, root_validator, validator
from app.core.config.communication_config import MessageSubscriptionConfig, STSTokenRefreshConfig
from app.core.entity.message.message import MessageType
from app.core.entity.message.personal_preferences import PersonalPreferences


class Department(BaseModel):
    """部门信息"""

    id: Optional[str] = None
    name: Optional[str] = None
    path: Optional[str] = None


class User(BaseModel):
    """用户信息"""

    id: Optional[str] = None
    third_platform_id: str = Field(default="", strict=True)
    nickname: Optional[str] = None
    real_name: Optional[str] = None
    work_number: Optional[str] = None
    position: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    departments: Optional[List[Department]] = Field(default_factory=list)

    @validator("third_platform_id", pre=True)
    def normalize_third_platform_id(cls, value):
        """保留来源用户 ID，历史 null 按无法确定处理。"""
        return "" if value is None else value


class Metadata(BaseModel):
    """元数据信息"""

    agent_user_id: Optional[str] = None
    user_id: Optional[str] = None
    organization_code: Optional[str] = None
    chat_conversation_id: Optional[str] = None
    chat_topic_id: Optional[str] = None
    topic_id: Optional[str] = None
    instruction: Optional[str] = None
    sandbox_id: Optional[str] = None
    super_magic_task_id: Optional[str] = None
    project_id: Optional[str] = Field(default=None, description="沙箱所属项目ID")
    trace_id: Optional[str] = Field(default=None, description="Trace ID for distributed tracing")
    user: Optional[User] = None
    language: Optional[str] = Field(default="zh_CN", description="用户语言偏好，支持 zh_CN(中文) 和 en_US(英文)")
    channel_name: Optional[str] = Field(default=None, description="消息来源渠道名称")
    authorization: Optional[str] = Field(default=None, description="认证授权令牌")
    skip_init_messages: Optional[bool] = Field(
        default=None,
        description="是否跳过发送初始化相关的聊天消息（BEFORE_INIT 和 AFTER_INIT 事件的消息），存在且为 true 时才跳过",
    )
    personal_preferences: PersonalPreferences = Field(
        default_factory=PersonalPreferences,
        description="当前 CHAT 携带的用户个人偏好",
    )

    @root_validator(pre=True)
    def migrate_legacy_long_term_memory_field(cls, values):
        """将历史顶层长期记忆字段转换为个人偏好对象，仅用于输入兼容。"""
        if not isinstance(values, dict):
            return values
        if "personal_preferences" in values or "long_term_memory_enabled" not in values:
            return values

        migrated_values = dict(values)
        migrated_values["personal_preferences"] = {
            "long_term_memory_enabled": values["long_term_memory_enabled"],
        }
        return migrated_values

    @validator("personal_preferences", pre=True, always=True)
    def validate_personal_preferences(cls, value):
        """个人偏好缺失或结构非法时使用默认配置。"""
        if isinstance(value, PersonalPreferences) or isinstance(value, dict):
            return value
        return {}


class SuperMagicWorkspaceContext(BaseModel):
    """当前项目所属工作区。"""

    id: str
    name: str


class SuperMagicProjectContext(BaseModel):
    """当前项目。"""

    id: str
    name: str


class SuperMagicTopicContext(BaseModel):
    """当前话题。"""

    id: str
    name: str


class SuperMagicSandboxContext(BaseModel):
    """当前逻辑沙盒。"""

    id: str


class SuperMagicProductContext(BaseModel):
    """Super Magic 产品位置上下文。"""

    workspace: Optional[SuperMagicWorkspaceContext] = None
    project: SuperMagicProjectContext
    topic: SuperMagicTopicContext
    sandbox: SuperMagicSandboxContext


class ClientMessage(BaseModel):
    """任务消息模型"""

    message_id: str
    type: Union[MessageType, str]

    class Config:
        use_enum_values = True


class ContextType(str, Enum):
    """消息上下文类型枚举"""

    NORMAL = "normal"  # 正常消息
    FOLLOW_UP = "follow_up"  # 追问消息
    INTERRUPT = "interrupt"  # 中断消息
    CONTINUE = "continue"  # 继续执行消息


class TaskMode(str, Enum):
    """任务模式类型枚举"""

    CHAT = "chat"  # 聊天模式，使用magic.agent
    PLAN = "plan"  # 规划模式，使用super-magic.agent


class AgentMode(str, Enum):
    """Agent模式类型枚举"""

    GENERAL = "general"  # 通用模式，使用magic.agent (兼容外部传入接口的参数)
    MAGIC = "magic"  # 通用模式，使用magic.agent（默认）
    PPT = "ppt"  # PPT制作模式，使用slider.agent
    DATA_ANALYSIS = "data_analysis"  # 数据分析模式，使用data-analyst.agent
    SUMMARY = "summary"  # 音频纪要模式，使用audio.agent
    SUMMARY_CHAT = "summary-chat"  # 音频纪要聊天模式，使用audio-chat.agent
    SUMMARY_VIDEO = "summary-video"  # 视频分析模式，使用video.agent
    DESIGN = "design"         # 画布设计模式，使用design.agent
    CANVAS = "canvas"         # Canvas 管理模式，使用canvas.agent
    VIDEO_PRODUCTION = "video-production"  # 视频制作模式，使用video-production.agent
    TEST = "test"  # 工具模式，使用tool.agent
    CREW_CREATOR = "crew-creator"  # Crew管理模式，使用crew-creator.agent
    SKILL_CREATOR = "skill-creator"  # Skill 创作模式，使用skill-creator.agent
    MICRO_APP = "micro-app"  # 微应用开发模式，使用micro-app.agent
    PERSONA_RESEARCH = "persona_research"  # AI 消费者研究模式，使用persona-research.agent
    CUSTOM_AGENT = "custom_agent"  # 自定义 Agent 运行模式，需配合 agent_code
    MAGICLAW = "magiclaw"  # Magic Claw 模式，从 agents/claws/<claw_code>/ 编译运行

    def get_agent_type(self) -> str:
        """获取对应的 agent_type"""
        agent_type_mapping = {
            AgentMode.GENERAL: "magic",
            AgentMode.MAGIC: "magic",
            AgentMode.PPT: "slider",
            AgentMode.DATA_ANALYSIS: "data-analyst",
            AgentMode.SUMMARY: "audio",  # 模式名称保持summary，但使用audio.agent文件
            AgentMode.SUMMARY_CHAT: "audio-chat",  # 模式名称保持summary-chat，但使用audio-chat.agent文件
            AgentMode.SUMMARY_VIDEO: "video",  # 模式名称保持summary-video，但使用video.agent文件
            AgentMode.DESIGN: "design",  # 画布设计模式
            AgentMode.CANVAS: "canvas",  # Canvas 管理模式
            AgentMode.VIDEO_PRODUCTION: "video-production",  # 视频制作模式
            AgentMode.TEST: "test",
            AgentMode.CREW_CREATOR: "crew-creator",
            AgentMode.SKILL_CREATOR: "skill-creator",
            AgentMode.MICRO_APP: "micro-app",  # 微应用开发模式
            AgentMode.PERSONA_RESEARCH: "persona-research",  # AI 消费者研究模式
            AgentMode.CUSTOM_AGENT: "custom_agent",
            AgentMode.MAGICLAW: "magiclaw",
        }
        return agent_type_mapping.get(self, "magic")

    @classmethod
    def resolve_agent_type(cls, agent_mode: "Optional[Union[AgentMode, str]]") -> str:
        """Resolve an agent_mode (enum or string) to its canonical agent_type string.

        This is the single source of truth for mode/alias normalization, e.g. "ppt" -> "slider",
        "data_analysis" -> "data-analyst". Both the chat dispatch path and call_subagent reuse it
        so there is never a second mapping table.

        - Empty/None -> GENERAL's agent_type ("magic").
        - Known mode value -> mapped agent_type.
        - Unknown string (custom agent id / already-canonical name) -> returned trimmed as-is.
        """
        if not agent_mode:
            return cls.GENERAL.get_agent_type()
        try:
            return cls(agent_mode).get_agent_type()
        except ValueError:
            return str(agent_mode).strip() or cls.GENERAL.get_agent_type()


class ChatClientMessage(ClientMessage):
    """
    聊天消息类型

    用于处理用户发送的聊天消息
    """

    type: str = MessageType.CHAT.value
    prompt: str
    attachments: List[Dict[str, Any]] = []
    mentions: List[Dict[str, Any]] = []  # 新增mentions字段，支持file/mcp/agent等类型的mention
    context_type: ContextType = ContextType.NORMAL  # 默认为普通消息
    task_mode: TaskMode = TaskMode.PLAN  # 任务模式，默认为规划模式（保留但不再使用）
    agent_mode: Optional[Union[AgentMode, str]] = None  # Agent模式，支持枚举或自定义Agent ID；None 表示未显式携带，运行时归一化为 GENERAL
    remark: Optional[str] = None  # 备注信息，用于中断消息等场景
    mcp_config: Optional[Dict[str, Any]] = None  # MCP 服务器配置，格式与 config/mcp.json 保持一致
    metadata: Optional[Metadata] = None  # 元数据信息，使用强类型
    super_magic_product_context: Optional[SuperMagicProductContext] = Field(
        default=None,
        description="Current Super Magic workspace, project, topic, and logical sandbox context.",
    )
    channel_context: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Channel-specific payload, owned and interpreted by the originating channel plugin.",
    )

    # 文本模型与动态配置字段
    model_id: Optional[str] = Field(
        default=None, description="文本模型 ID：指定本次对话使用的模型；为空时由模型选择策略决定"
    )
    dynamic_config: Optional[Dict[str, Any]] = Field(
        default=None, description="动态配置（JSON格式），将转换为YAML格式写入config/dynamic_config.yaml"
    )
    agent: Optional["InitAgentConfig"] = Field(
        default=None,
        description="Agent config from server. Carries type and profile (name/description/role). Null for default agent."
    )
    update_session: bool = Field(
        default=False,
        description="是否在处理完本条消息后更新 session 配置（model_id/image_model 等）。仅前端 chat 消息设为 True，第三方 IM 渠道消息保持默认 False，避免覆盖已有配置。",
    )

    @property
    def web_search_enabled(self) -> Optional[bool]:
        """只解析显式布尔状态；旧消息不注入默认开启，以免抵消 prompt 中的关闭约束。"""
        value = (self.dynamic_config or {}).get("enable_web_search")
        return value if isinstance(value, bool) else None

    @validator("mcp_config", pre=True)
    def validate_mcp_config(cls, v):
        """安全地处理 mcp_config 字段"""
        # 如果是空数组，转换为 None
        if isinstance(v, list) and len(v) == 0:
            return None
        # 如果是字典或 None，直接返回
        if isinstance(v, dict) or v is None:
            return v
        # 其他情况转换为 None
        return None

    @validator("model_id")
    def validate_model_id(cls, v):
        """验证model_id格式"""
        if v is not None and not isinstance(v, str):
            raise ValueError("model_id必须是字符串类型")
        # 空字符串或只包含空白字符的字符串视为未设置，转换为None
        if v is not None and not v.strip():
            return None
        return v.strip() if v else None

    @validator("dynamic_config", pre=True)
    def validate_dynamic_config(cls, v):
        """安全地处理 dynamic_config 字段"""
        if isinstance(v, list) and len(v) == 0:
            return None
        if isinstance(v, dict) or v is None:
            return v
        return None

    @validator("attachments", each_item=True)
    def validate_attachment(cls, v):
        if not isinstance(v, dict):
            raise ValueError("附件必须是对象")

        required_fields = ["file_tag", "filename", "file_key", "file_size", "file_url"]

        for field in required_fields:
            if field not in v:
                raise ValueError(f"附件必须包含 '{field}' 字段")

        # 验证字符串类型字段
        string_fields = ["file_tag", "filename", "file_key", "file_url"]
        for field in string_fields:
            if not isinstance(v[field], str):
                raise ValueError(f"附件的 '{field}' 必须是字符串")

        # 验证文件大小必须是整数
        if not isinstance(v["file_size"], (int, float)):
            raise ValueError("附件的 'file_size' 必须是数字类型")

        return v

    @validator("mentions", each_item=True)
    def validate_mention(cls, v):
        """验证mentions字段的格式"""
        if not isinstance(v, dict):
            raise ValueError("Mention必须是对象")

        # 验证必须包含type字段
        if "type" not in v:
            raise ValueError("Mention必须包含'type'字段")

        mention_type = v["type"]
        if not isinstance(mention_type, str):
            raise ValueError("Mention的'type'必须是字符串")

        return v


class InitAgentProfile(BaseModel):
    """Claw / agent profile metadata attached to the agent config."""

    code: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    role: Optional[str] = None
    template_code: Optional[str] = None
    user_facing_name: Optional[str] = None


class InitAgentConfig(BaseModel):
    """Custom agent configuration carried in the INIT message.

    type indicates which agent variant to use (e.g. 'magiclaw').
    profile carries the agent identity: name, description, role, etc.
    Top-level name/description are deprecated but kept for backward compatibility.
    """

    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    profile: Optional[InitAgentProfile] = None


class InitClientMessage(ClientMessage):
    """
    初始化消息类型

    用于工作区初始化
    """

    type: str = MessageType.INIT.value
    message_subscription_config: List[MessageSubscriptionConfig] = Field(
        default_factory=list,
        description="Message subscription config list",
    )
    sts_token_refresh: Optional[STSTokenRefreshConfig] = None  # STS Token刷新配置，可选字段
    metadata: Optional[Metadata] = None  # 元数据信息，使用强类型
    super_magic_product_context: Optional[SuperMagicProductContext] = Field(
        default=None,
        description="Initial Super Magic workspace, project, topic, and logical sandbox context.",
    )
    upload_config: Optional[Dict[str, Any]] = None  # 上传配置，可包含平台类型和临时凭证
    magic_service_host: Optional[str] = None  # Magic Service主机地址，可选字段
    magic_service_ws_host: Optional[str] = None  # Magic Service WebSocket主机地址，可选字段
    chat_history_dir: Optional[str] = None  # 聊天历史目录，可选字段
    work_dir: Optional[str] = None  # 工作目录，可选字段
    fetch_history: bool = Field(
        default=True,
        description="Flag to decide whether remote chat history should be downloaded during initialization",
    )
    dynamic_config: Optional[Dict[str, Any]] = None  # 动态配置（如 message_version），由 PHP 侧 dynamic_params 透传
    agent_mode: Union[AgentMode, str] = AgentMode.GENERAL  # 沙箱运行模式，决定初始化后的生命周期策略
    agent: Optional["InitAgentConfig"] = Field(
        default=None,
        description="""<!--zh: 自定义 Agent 配置；type 标识类型，profile 携带名称/描述/角色等身份信息。外层 name/description 已废弃，仅做兜底兼容-->
Custom agent config. type identifies the agent variant; profile carries identity (name, description, role). Top-level name/description are deprecated fallbacks."""
    )

    @validator("message_subscription_config", pre=True)
    def normalize_message_subscription_config(cls, v):
        if v is None:
            return v
        if isinstance(v, dict):
            return [v]
        return v

    @validator("message_subscription_config")
    def validate_message_subscription_config(cls, v):
        if Environment.is_local():
            return v
        if not v:
            raise ValueError("消息订阅配置 'message_subscription_config' 不能为空")
        return v

    @validator("metadata")
    def validate_metadata(cls, v):
        if v is None:
            raise ValueError("元数据 'metadata' 不能为空")
        return v
