"""
路径相关的常量和工具函数，使用面向对象方式实现
"""

from pathlib import Path
from typing import Optional, ClassVar

from agentlang.paths import PathManager as BasePathManager

class PathManager(BasePathManager):
    """
    应用层路径管理器，继承自基础框架并添加应用特有路径。

    目录创建约定：
    - 框架层预创建目录由父类负责
    - 应用层预创建目录仅以 `_ensure_app_directories_exist()` 中显式创建的目录为准
    - 未在该方法中创建的目录一律视为按需创建，首次写入时由调用方自行创建
    - `get_*` 方法只返回路径，不隐式创建目录
    """

    # 浏览器存储状态文件
    _browser_storage_state_file: ClassVar[Optional[Path]] = None

    # 凭证目录
    _credentials_dir_name: ClassVar[str] = ".credentials"
    _credentials_dir: ClassVar[Optional[Path]] = None
    _init_client_message_file: ClassVar[Optional[Path]] = None
    _chat_client_message_file: ClassVar[Optional[Path]] = None

    # 项目架构目录
    _project_schema_dir_name: ClassVar[str] = ".project_schemas"
    _project_schema_absolute_dir: ClassVar[Optional[Path]] = None

    # 项目归档目录
    _project_archive_dir_name: ClassVar[str] = "project_archive"
    _project_archive_info_file_relative_path: ClassVar[Optional[str]] = None
    _project_archive_info_file: ClassVar[Optional[Path]] = None

    # 客户端消息目录
    _client_message_dir_name: ClassVar[str] = ".client_message"
    _client_message_dir: ClassVar[Optional[Path]] = None
    _task_metadata_file: ClassVar[Optional[Path]] = None

    # MCP 配置目录
    _mcp_config_dir_name: ClassVar[str] = ".mcp"
    _mcp_config_dir: ClassVar[Optional[Path]] = None

    # 语言翻译目录
    _languages_dir_name: ClassVar[str] = "app/i18n"
    _languages_dir: ClassVar[Optional[Path]] = None
    _translations_dir: ClassVar[Optional[Path]] = None

    # ASR 任务状态目录
    _asr_states_dir_name: ClassVar[str] = ".asr_states"
    _asr_states_dir: ClassVar[Optional[Path]] = None

    # MagicLaw 持久化配置目录（MagiClaw / 龙虾模式专用，位于 workspace 内）
    _magiclaw_dir_name: ClassVar[str] = ".magiclaw"
    _magiclaw_config_dir_name: ClassVar[str] = "config"
    _magiclaw_dir: ClassVar[Optional[Path]] = None
    _magiclaw_config_dir: ClassVar[Optional[Path]] = None

    # Agent Studio 工作目录
    _agent_studio_dir_name: ClassVar[str] = ".agent_studio"
    _agent_studio_dir: ClassVar[Optional[Path]] = None

    @classmethod
    def _ensure_app_initialization(cls) -> None:
        """确保应用层PathManager已初始化"""
        if not cls._initialized:
            # 调用父类的初始化方法
            cls._ensure_initialization()

            # 初始化应用层特有路径
            cls._initialize_app_paths()
        elif cls._credentials_dir is None:
            # 如果基础层已初始化但应用层路径未初始化，则初始化应用层路径
            cls._initialize_app_paths()

    @classmethod
    def _initialize_app_paths(cls) -> None:
        """初始化应用层特有的路径"""
        if cls._project_root is None:
            raise RuntimeError("必须先设置项目根目录")

        cls._credentials_dir = cls._project_root.joinpath(cls._credentials_dir_name)
        cls._browser_storage_state_file = cls.get_browser_data_dir() / "storage_state.json"
        cls._init_client_message_file = cls.get_credentials_dir() / "init_client_message.json"
        cls._chat_client_message_file = cls.get_credentials_dir() / "chat_client_message.json"
        cls._project_schema_absolute_dir = cls._project_root / cls._project_schema_dir_name
        cls._project_archive_info_file_relative_path = f"{cls._project_schema_dir_name}/project_archive_info.json"
        cls._project_archive_info_file = cls.get_project_schema_absolute_dir() / "project_archive_info.json"
        cls._mcp_config_dir = cls._project_root / cls._mcp_config_dir_name
        cls._languages_dir = cls._project_root / cls._languages_dir_name
        cls._translations_dir = cls._languages_dir / "translations"
        cls._client_message_dir = cls._project_root / cls._client_message_dir_name
        cls._task_metadata_file = cls._client_message_dir / "task_metadata.json"
        cls._asr_states_dir = cls.get_workspace_dir() / cls._asr_states_dir_name
        cls._magiclaw_dir = cls.get_workspace_dir() / cls._magiclaw_dir_name
        cls._magiclaw_config_dir = cls._magiclaw_dir / cls._magiclaw_config_dir_name
        cls._agent_studio_dir = cls.get_workspace_dir() / cls._agent_studio_dir_name

        # 确保应用层特有的目录存在
        cls._ensure_app_directories_exist()

    @classmethod
    def set_project_root(cls, project_root: Path) -> None:
        """
        设置项目根目录并初始化所有路径（框架层 + 应用层）

        Args:
            project_root: 项目根目录路径
        """
        super().set_project_root(project_root)

        # 确保父类已正确设置项目根目录
        if cls._project_root is None:
            raise RuntimeError("父类 set_project_root 调用失败")

        # 初始化应用层特有路径
        cls._initialize_app_paths()

    @classmethod
    def _ensure_app_directories_exist(cls) -> None:
        """确保应用层特有的目录存在 (核心目录由框架层保证)"""
        if cls._project_root is None:
            raise RuntimeError("必须先调用 set_project_root 设置项目根目录")

        # 只创建应用层自己管理的目录
        if cls._credentials_dir is not None:
            cls._credentials_dir.mkdir(exist_ok=True)
        if cls._project_schema_absolute_dir is not None:
            cls._project_schema_absolute_dir.mkdir(exist_ok=True)
        if cls._mcp_config_dir is not None:
            cls._mcp_config_dir.mkdir(exist_ok=True)
        if cls._client_message_dir is not None:
            cls._client_message_dir.mkdir(exist_ok=True)
        # ASR 状态目录改为按需创建（由 ASR 服务使用时自行创建）

    # 应用层特有路径的 getter 方法

    @classmethod
    def get_browser_storage_state_file(cls) -> Path:
        """获取浏览器存储状态文件路径"""
        cls._ensure_app_initialization()
        return cls._browser_storage_state_file

    @classmethod
    def get_project_archive_dir_name(cls) -> str:
        """获取项目归档目录名称"""
        return cls._project_archive_dir_name

    @classmethod
    def get_credentials_dir_name(cls) -> str:
        """获取凭证目录名称"""
        return cls._credentials_dir_name

    @classmethod
    def get_credentials_dir(cls) -> Path:
        """获取凭证目录路径"""
        cls._ensure_app_initialization()
        return cls._credentials_dir

    @classmethod
    def get_init_client_message_file(cls) -> Path:
        """获取初始客户端消息文件路径"""
        cls._ensure_app_initialization()
        return cls._init_client_message_file

    @classmethod
    def get_chat_client_message_file(cls) -> Path:
        """获取聊天客户端消息文件路径"""
        cls._ensure_app_initialization()
        return cls._chat_client_message_file

    @classmethod
    def get_project_schema_dir_name(cls) -> str:
        """获取项目架构目录名称"""
        return cls._project_schema_dir_name

    @classmethod
    def get_project_schema_absolute_dir(cls) -> Path:
        """获取项目架构绝对目录路径"""
        cls._ensure_app_initialization()
        return cls._project_schema_absolute_dir

    @classmethod
    def get_project_archive_info_file_relative_path(cls) -> str:
        """获取项目归档信息文件相对路径"""
        cls._ensure_app_initialization()
        return cls._project_archive_info_file_relative_path

    @classmethod
    def get_project_archive_info_file(cls) -> Path:
        """获取项目归档信息文件路径"""
        cls._ensure_app_initialization()
        return cls._project_archive_info_file

    @classmethod
    def get_client_message_dir_name(cls) -> str:
        """获取客户端消息目录名称"""
        return cls._client_message_dir_name

    @classmethod
    def get_client_message_dir(cls) -> Path:
        """获取客户端消息目录路径"""
        cls._ensure_app_initialization()
        return cls._client_message_dir

    @classmethod
    def get_task_metadata_file(cls) -> Path:
        """获取任务元数据文件路径"""
        cls._ensure_app_initialization()
        return cls._task_metadata_file

    @classmethod
    def get_mcp_config_dir_name(cls) -> str:
        """获取 MCP 配置目录名称"""
        return cls._mcp_config_dir_name

    @classmethod
    def get_mcp_config_dir(cls) -> Path:
        """获取 MCP 配置目录路径"""
        cls._ensure_app_initialization()
        return cls._mcp_config_dir

    @classmethod
    def get_languages_dir_name(cls) -> str:
        """获取语言目录名称"""
        return cls._languages_dir_name

    @classmethod
    def get_languages_dir(cls) -> Path:
        """获取语言目录路径"""
        cls._ensure_app_initialization()
        return cls._languages_dir

    @classmethod
    def get_translations_dir(cls) -> Path:
        """获取翻译文件目录路径"""
        cls._ensure_app_initialization()
        return cls._translations_dir

    @classmethod
    def get_upload_credentials_file(cls) -> Path:
        """
        获取上传凭证文件路径

        Returns:
            Path: 上传凭证文件路径
        """
        cls._ensure_app_initialization()
        return cls.get_credentials_dir() / "upload_credentials.json"

    @classmethod
    def get_todos_file(cls) -> Path:
        """
        获取全局todo文件路径

        Returns:
            Path: todo文件路径 (.chat_history/todos.json)
        """
        cls._ensure_app_initialization()
        return cls.get_chat_history_dir() / "todos.json"

    @classmethod
    def get_chat_session_file(cls, agent_name: str, agent_id: str) -> Path:
        """获取指定 Agent 会话的 .session.json 文件路径。"""
        cls._ensure_app_initialization()
        return cls.get_chat_history_dir() / f"{agent_name}<{agent_id}>.session.json"

    @classmethod
    def get_subagents_chat_history_dir(cls) -> Path:
        """获取子 Agent 聊天记录目录路径。"""
        cls._ensure_app_initialization()
        return cls.get_chat_history_dir() / "subagents"

    @classmethod
    def get_subagent_chat_session_file(cls, agent_name: str, agent_id: str) -> Path:
        """获取指定子 Agent 会话的 .session.json 文件路径。"""
        cls._ensure_app_initialization()
        return cls.get_subagents_chat_history_dir() / f"{agent_name}<{agent_id}>.session.json"

    @classmethod
    def get_task_message_file(cls, task_id: str) -> Path:
        """
        获取指定任务的消息文件路径

        Args:
            task_id: 任务ID

        Returns:
            Path: 任务消息文件路径 (.client_message/{task_id}.json)
        """
        cls._ensure_app_initialization()
        return cls._client_message_dir / f"{task_id}.json"

    @classmethod
    def _normalize_agent_identifier(cls, value: str, field_name: str = "agent_code") -> str:
        """标准化并校验 agent 标识，避免路径穿越。"""
        normalized = (value or "").strip()
        if not normalized:
            raise ValueError(f"{field_name} cannot be empty")
        if ".." in normalized or "/" in normalized or "\\" in normalized:
            raise ValueError(f"Invalid {field_name}: {value}")
        return normalized

    @classmethod
    def get_agents_dir(cls) -> Path:
        """获取 agents 根目录路径。"""
        cls._ensure_app_initialization()
        return cls.get_project_root() / "agents"

    @classmethod
    def get_compiled_agent_file(cls, agent_type: str) -> Path:
        """获取编译产物 .agent 文件路径。"""
        normalized_type = cls._normalize_agent_identifier(agent_type, field_name="agent_type")
        return cls.get_agents_dir() / f"{normalized_type}.agent"

    @classmethod
    def get_crew_root_dir(cls) -> Path:
        """获取 crew 根目录路径（agents/crew）。"""
        return cls.get_agents_dir() / "crew"

    @classmethod
    def get_crew_agent_dir(cls, agent_code: str) -> Path:
        """获取指定 crew agent 的目录路径（agents/crew/{agent_code}）。"""
        normalized_code = cls._normalize_agent_identifier(agent_code, field_name="agent_code")
        return cls.get_crew_root_dir() / normalized_code

    @classmethod
    def get_crew_identity_file(cls, agent_code: str) -> Path:
        """获取 crew IDENTITY.md 文件路径。"""
        return cls.get_crew_agent_dir(agent_code) / "IDENTITY.md"

    @classmethod
    def get_crew_skills_dir(cls, agent_code: str) -> Path:
        """获取 crew 私有 skills 目录路径。"""
        return cls.get_crew_agent_dir(agent_code) / "skills"

    @classmethod
    def get_crew_template_file(cls) -> Path:
        """获取 crew.agent.template 模板文件路径。"""
        return cls.get_agents_dir() / "crew.agent.template"

    @classmethod
    def get_checkpoints_dir(cls) -> Path:
        """
        获取checkpoint存储目录

        Returns:
            Path: checkpoint存储目录路径
        """
        cls._ensure_app_initialization()
        checkpoint_dir = cls.get_project_root() / ".checkpoints"
        checkpoint_dir.mkdir(exist_ok=True)
        return checkpoint_dir

    @classmethod
    def get_checkpoint_dir(cls, checkpoint_id: str) -> Path:
        """
        获取检查点实例目录

        Args:
            checkpoint_id: 检查点ID

        Returns:
            Path: 检查点实例目录路径
        """
        cls._ensure_app_initialization()
        checkpoint_dir = cls.get_checkpoints_dir() / checkpoint_id
        checkpoint_dir.mkdir(exist_ok=True)
        return checkpoint_dir

    @classmethod
    def get_asr_states_dir(cls) -> Path:
        """
        获取 ASR 任务状态目录

        Returns:
            Path: ASR 任务状态目录路径
        """
        cls._ensure_app_initialization()
        # 注意：目录本身不在启动时创建，由 ASR 相关服务按需创建
        return cls._asr_states_dir

    @classmethod
    def get_magiclaw_dir(cls) -> Path:
        """获取 workspace 内的 .magiclaw 目录（MagiClaw / 龙虾模式持久化配置）"""
        cls._ensure_app_initialization()
        return cls._magiclaw_dir

    @classmethod
    def get_magiclaw_config_dir(cls) -> Path:
        """获取 .magiclaw/config/ 目录，存放 MagiClaw / 龙虾模式持久化配置"""
        cls._ensure_app_initialization()
        return cls._magiclaw_config_dir

    @classmethod
    def get_agent_studio_dir(cls, agent_code: Optional[str] = None) -> Path:
        """
        获取 Agent Studio 工作目录

        Args:
            agent_code: Agent 编码，若指定则返回该 Agent 的子目录

        Returns:
            Path: Agent Studio 目录路径
        """
        cls._ensure_app_initialization()
        base_dir = cls._agent_studio_dir
        if agent_code:
            agent_dir = base_dir / agent_code
            agent_dir.mkdir(parents=True, exist_ok=True)
            return agent_dir
        base_dir.mkdir(parents=True, exist_ok=True)
        return base_dir
