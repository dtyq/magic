"""
客户端消息结构定义

定义客户端发送给服务端的WebSocket消息结构
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Union

from agentlang.environment import Environment
from pydantic import BaseModel, Field, validator

from app.core.config.communication_config import MessageSubscriptionConfig, STSTokenRefreshConfig
from app.core.entity.message.message import MessageType


class Department(BaseModel):
    """部门信息"""

    id: Optional[str] = None
    name: Optional[str] = None
    path: Optional[str] = None


class User(BaseModel):
    """用户信息"""

    id: Optional[str] = None
    nickname: Optional[str] = None
    real_name: Optional[str] = None
    work_number: Optional[str] = None
    position: Optional[str] = None
    departments: Optional[List[Department]] = Field(default_factory=list)


class MemoryItem(BaseModel):
    """长期记忆项"""

    id: str = Field(..., description="记忆的唯一标识ID")
    content: str = Field(..., description="记忆的内容")


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
    authorization: Optional[str] = Field(default=None, description="认证授权令牌")
    skip_init_messages: Optional[bool] = Field(
        default=None,
        description="是否跳过发送初始化相关的聊天消息（BEFORE_INIT 和 AFTER_INIT 事件的消息），存在且为 true 时才跳过",
    )


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
    TEST = "test"  # 工具模式，使用tool.agent
    SKILL = "skill"  # Skill模式，使用skill.agent
    CREW_CREATOR = "crew-creator"  # Crew管理模式，使用crew-creator.agent
    SKILL_CREATOR = "skill-creator"  # Skill 创作模式，使用skill-creator.agent
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
            AgentMode.TEST: "test",
            AgentMode.SKILL: "skill",
            AgentMode.CREW_CREATOR: "crew-creator",
            AgentMode.SKILL_CREATOR: "skill-creator",
        }
        return agent_type_mapping.get(self, "magic")


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
    agent_mode: Union[AgentMode, str] = AgentMode.GENERAL  # Agent模式，支持枚举或自定义Agent ID
    remark: Optional[str] = None  # 备注信息，用于中断消息等场景
    mcp_config: Optional[Dict[str, Any]] = None  # MCP 服务器配置，格式与 config/mcp.json 保持一致
    metadata: Optional[Metadata] = None  # 元数据信息，使用强类型

    # 🔥 新增：动态模型选择和配置字段
    model_id: Optional[str] = Field(
        default=None, description="动态模型选择：指定本次对话使用的模型ID，会覆盖Agent默认模型选择"
    )
    dynamic_config: Optional[Dict[str, Any]] = Field(
        default=None, description="动态配置（JSON格式），将转换为YAML格式写入config/dynamic_config.yaml"
    )

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


class InitClientMessage(ClientMessage):
    """
    初始化消息类型

    用于工作区初始化
    """

    type: str = MessageType.INIT.value
    message_subscription_config: Optional[MessageSubscriptionConfig] = None  # 消息订阅配置，可选字段
    sts_token_refresh: Optional[STSTokenRefreshConfig] = None  # STS Token刷新配置，可选字段
    metadata: Optional[Metadata] = None  # 元数据信息，使用强类型
    upload_config: Optional[Dict[str, Any]] = None  # 上传配置，可包含平台类型和临时凭证
    magic_service_host: Optional[str] = None  # Magic Service主机地址，可选字段
    chat_history_dir: Optional[str] = None  # 聊天历史目录，可选字段
    work_dir: Optional[str] = None  # 工作目录，可选字段
    fetch_history: bool = Field(
        default=True,
        description="Flag to decide whether remote chat history should be downloaded during initialization",
    )
    memory: Optional[str] = None  # 长期记忆数据（旧格式，向后兼容），用于传递给 dynamic_context
    memories: Optional[List[MemoryItem]] = Field(
        default=None,
        description="长期记忆数据（新格式），数组格式，每个元素包含 id 和 content 字段"
    )  # 长期记忆数据，用于传递给 dynamic_context
    agent: Optional[Dict[str, str]] = Field(
        default=None,
        description="自定义 Agent 配置，包含 name(名称) 和 description(介绍)"
    )

    @validator('agent', pre=True)
    def validate_agent(cls, v):
        """验证 agent 配置格式"""
        if v is None:
            return None

        if not isinstance(v, dict):
            raise ValueError("agent 必须是对象类型")

        # 验证必需字段
        if 'name' not in v:
            raise ValueError("agent 必须包含 'name' 字段")

        # description 可选，提供默认值
        if 'description' not in v:
            v['description'] = "是一个专业的AI助手。"

        return v

    @validator("message_subscription_config")
    def validate_message_subscription_config(cls, v):
        if Environment.is_dev():
            return v
        if v is None:
            raise ValueError("消息订阅配置 'message_subscription_config' 不能为空")
        return v

    @validator("metadata")
    def validate_metadata(cls, v):
        if v is None:
            raise ValueError("元数据 'metadata' 不能为空")
        return v
