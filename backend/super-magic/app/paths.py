"""
路径相关的常量和工具函数，使用面向对象方式实现
"""

from datetime import datetime
from pathlib import Path
from typing import Optional, ClassVar

from agentlang.paths import PathManager as BasePathManager

class PathManager(BasePathManager):
    """
    应用层路径管理器，继承自基础框架并添加应用特有路径。

    目录层级说明（project_root 由父类管理）：
    - project_root/          ← 项目根目录
        .browser/            ← 浏览器数据（父类管理）
        .cache/              ← 缓存（父类管理）
        .chat_history/       ← 聊天记录（父类管理）
        .credentials/        ← 凭证（应用层，预创建）
        .project_schemas/    ← 项目架构（应用层，预创建）
        .client_message/     ← 客户端消息（应用层，预创建）
        .mcp/                ← MCP 配置（应用层，预创建）
        app/i18n/            ← 语言翻译（源码只读目录）
        .checkpoints/        ← 检查点（getter 内按需创建）
        .workspace/          ← 工作区（父类管理）
            .asr_states/     ← ASR 状态（按需创建）
            .magic/          ← Magic 配置（按需创建）
            .tmp/            ← 临时文件（按需创建）

    目录创建约定：
    - 框架层预创建目录由父类负责
    - 应用层预创建目录仅以 `_ensure_app_directories_exist()` 中显式创建的目录为准
    - 未在该方法中创建的目录一律视为按需创建，首次写入时由调用方自行创建
    - `get_*` 方法只返回路径，不隐式创建目录（`get_checkpoints_dir` / `get_checkpoint_dir` 除外，历史遗留）
    """

    # ── project_root 下 ───────────────────────────────────────────────────────

    # 凭证目录：project_root/.credentials（预创建）
    _credentials_dir_name: ClassVar[str] = ".credentials"
    _credentials_dir: ClassVar[Optional[Path]] = None
    _init_client_message_file: ClassVar[Optional[Path]] = None
    _chat_client_message_file: ClassVar[Optional[Path]] = None

    # 项目架构目录：project_root/.project_schemas（预创建）
    _project_schema_dir_name: ClassVar[str] = ".project_schemas"
    _project_schema_absolute_dir: ClassVar[Optional[Path]] = None

    # 项目归档（逻辑路径名称常量，不对应独立目录）
    _project_archive_dir_name: ClassVar[str] = "project_archive"
    _project_archive_info_file_relative_path: ClassVar[Optional[str]] = None
    _project_archive_info_file: ClassVar[Optional[Path]] = None

    # 客户端消息目录：project_root/.client_message（预创建）
    _client_message_dir_name: ClassVar[str] = ".client_message"
    _client_message_dir: ClassVar[Optional[Path]] = None
    _task_metadata_file: ClassVar[Optional[Path]] = None

    # MCP 配置目录：project_root/.mcp（预创建）
    _mcp_config_dir_name: ClassVar[str] = ".mcp"
    _mcp_config_dir: ClassVar[Optional[Path]] = None

    # 语言翻译目录：project_root/app/i18n（源码只读目录，不创建）
    _languages_dir_name: ClassVar[str] = "app/i18n"
    _languages_dir: ClassVar[Optional[Path]] = None
    _translations_dir: ClassVar[Optional[Path]] = None

    # 浏览器存储状态文件：project_root/.browser/storage_state.json（由父类目录承载）
    _browser_storage_state_file: ClassVar[Optional[Path]] = None

    # ── workspace（project_root/.workspace）下 ────────────────────────────────

    # ASR 任务状态目录：.workspace/.asr_states（按需创建）
    _asr_states_dir_name: ClassVar[str] = ".asr_states"
    _asr_states_dir: ClassVar[Optional[Path]] = None

    # Magic 全局配置目录：.workspace/.magic（按需创建，未来考虑迁移到 ~/.magic/）
    _magic_dir_name: ClassVar[str] = ".magic"
    _magic_config_dir_name: ClassVar[str] = "config"
    _magic_dir: ClassVar[Optional[Path]] = None
    _magic_config_dir: ClassVar[Optional[Path]] = None

    # 临时目录：.workspace/.tmp（按需创建）
    _tmp_dir_name: ClassVar[str] = ".tmp"
    _tmp_dir: ClassVar[Optional[Path]] = None


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

        # ── project_root 下 ───────────────────────────────────────────────────
        cls._credentials_dir = cls._project_root / cls._credentials_dir_name
        cls._init_client_message_file = cls.get_credentials_dir() / "init_client_message.json"
        cls._chat_client_message_file = cls.get_credentials_dir() / "chat_client_message.json"

        cls._project_schema_absolute_dir = cls._project_root / cls._project_schema_dir_name
        cls._project_archive_info_file_relative_path = f"{cls._project_schema_dir_name}/project_archive_info.json"
        cls._project_archive_info_file = cls.get_project_schema_absolute_dir() / "project_archive_info.json"

        cls._client_message_dir = cls._project_root / cls._client_message_dir_name
        cls._task_metadata_file = cls._client_message_dir / "task_metadata.json"

        cls._mcp_config_dir = cls._project_root / cls._mcp_config_dir_name

        cls._languages_dir = cls._project_root / cls._languages_dir_name
        cls._translations_dir = cls._languages_dir / "translations"

        cls._browser_storage_state_file = cls.get_browser_data_dir() / "storage_state.json"

        # ── workspace（project_root/.workspace）下 ────────────────────────────
        cls._asr_states_dir = cls.get_workspace_dir() / cls._asr_states_dir_name
        cls._magic_dir = cls.get_workspace_dir() / cls._magic_dir_name
        cls._magic_config_dir = cls._magic_dir / cls._magic_config_dir_name
        cls._tmp_dir = cls.get_workspace_dir() / cls._tmp_dir_name

        # 确保应用层预创建目录存在
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
        """
        预创建应用层目录。

        只有此处显式列出的目录才保证启动时存在，其余目录均为按需创建。
        """
        if cls._project_root is None:
            raise RuntimeError("必须先调用 set_project_root 设置项目根目录")

        # project_root 下的预创建目录
        for d in (
            cls._credentials_dir,
            cls._project_schema_absolute_dir,
            cls._client_message_dir,
            cls._mcp_config_dir,
        ):
            if d is not None:
                d.mkdir(exist_ok=True)

        # workspace 下无预创建目录，均由各业务按需创建

    # ── project_root 下的 getter ──────────────────────────────────────────────

    @classmethod
    def get_browser_storage_state_file(cls) -> Path:
        """获取浏览器存储状态文件路径（project_root/.browser/storage_state.json）"""
        cls._ensure_app_initialization()
        return cls._browser_storage_state_file

    @classmethod
    def get_credentials_dir_name(cls) -> str:
        return cls._credentials_dir_name

    @classmethod
    def get_credentials_dir(cls) -> Path:
        """获取凭证目录路径（project_root/.credentials）"""
        cls._ensure_app_initialization()
        return cls._credentials_dir

    @classmethod
    def get_init_client_message_file(cls) -> Path:
        cls._ensure_app_initialization()
        return cls._init_client_message_file

    @classmethod
    def get_chat_client_message_file(cls) -> Path:
        cls._ensure_app_initialization()
        return cls._chat_client_message_file

    @classmethod
    def get_upload_credentials_file(cls) -> Path:
        """获取上传凭证文件路径（project_root/.credentials/upload_credentials.json）"""
        cls._ensure_app_initialization()
        return cls.get_credentials_dir() / "upload_credentials.json"

    @classmethod
    def get_project_schema_dir_name(cls) -> str:
        return cls._project_schema_dir_name

    @classmethod
    def get_project_schema_absolute_dir(cls) -> Path:
        """获取项目架构目录路径（project_root/.project_schemas）"""
        cls._ensure_app_initialization()
        return cls._project_schema_absolute_dir

    @classmethod
    def get_project_archive_dir_name(cls) -> str:
        return cls._project_archive_dir_name

    @classmethod
    def get_project_archive_info_file_relative_path(cls) -> str:
        cls._ensure_app_initialization()
        return cls._project_archive_info_file_relative_path

    @classmethod
    def get_project_archive_info_file(cls) -> Path:
        cls._ensure_app_initialization()
        return cls._project_archive_info_file

    @classmethod
    def get_client_message_dir_name(cls) -> str:
        return cls._client_message_dir_name

    @classmethod
    def get_client_message_dir(cls) -> Path:
        """获取客户端消息目录路径（project_root/.client_message）"""
        cls._ensure_app_initialization()
        return cls._client_message_dir

    @classmethod
    def get_task_metadata_file(cls) -> Path:
        cls._ensure_app_initialization()
        return cls._task_metadata_file

    @classmethod
    def get_task_message_file(cls, task_id: str) -> Path:
        """获取指定任务的消息文件路径（project_root/.client_message/{task_id}.json）"""
        cls._ensure_app_initialization()
        return cls._client_message_dir / f"{task_id}.json"

    @classmethod
    def get_mcp_config_dir_name(cls) -> str:
        return cls._mcp_config_dir_name

    @classmethod
    def get_mcp_config_dir(cls) -> Path:
        """获取 MCP 配置目录路径（project_root/.mcp）"""
        cls._ensure_app_initialization()
        return cls._mcp_config_dir

    @classmethod
    def get_languages_dir_name(cls) -> str:
        return cls._languages_dir_name

    @classmethod
    def get_languages_dir(cls) -> Path:
        """获取语言目录路径（project_root/app/i18n，源码只读目录）"""
        cls._ensure_app_initialization()
        return cls._languages_dir

    @classmethod
    def get_translations_dir(cls) -> Path:
        """获取翻译文件目录路径（project_root/app/i18n/translations）"""
        cls._ensure_app_initialization()
        return cls._translations_dir

    @classmethod
    def get_agents_dir(cls) -> Path:
        """获取 agents 根目录路径（project_root/agents）"""
        cls._ensure_app_initialization()
        return cls.get_project_root() / "agents"

    @classmethod
    def get_compiled_agent_file(cls, agent_type: str) -> Path:
        """获取编译产物 .agent 文件路径（project_root/agents/{agent_type}.agent）"""
        normalized_type = cls._normalize_agent_identifier(agent_type, field_name="agent_type")
        return cls.get_agents_dir() / f"{normalized_type}.agent"

    @classmethod
    def get_crew_root_dir(cls) -> Path:
        """获取 crew 根目录路径（project_root/agents/crew）"""
        return cls.get_agents_dir() / "crew"

    @classmethod
    def get_crew_agent_dir(cls, agent_code: str) -> Path:
        """获取指定 crew agent 的目录路径（project_root/agents/crew/{agent_code}）"""
        normalized_code = cls._normalize_agent_identifier(agent_code, field_name="agent_code")
        return cls.get_crew_root_dir() / normalized_code

    @classmethod
    def get_crew_identity_file(cls, agent_code: str) -> Path:
        return cls.get_crew_agent_dir(agent_code) / "IDENTITY.md"

    @classmethod
    def get_crew_skills_dir(cls, agent_code: str) -> Path:
        return cls.get_crew_agent_dir(agent_code) / "skills"

    @classmethod
    def get_crew_template_file(cls) -> Path:
        return cls.get_agents_dir() / "crew.template.agent"

    @classmethod
    def get_claws_root_dir(cls) -> Path:
        """返回 claws 根目录：agents/claws/"""
        return cls.get_agents_dir() / "claws"

    @classmethod
    def get_claw_agent_dir(cls, claw_code: str) -> Path:
        """返回指定 claw 的定义目录：agents/claws/<claw_code>/"""
        return cls.get_claws_root_dir() / claw_code.strip().lower()

    @classmethod
    def get_claw_template_file(cls) -> Path:
        """返回 claw 编译模板路径：agents/claw.template.agent"""
        return cls.get_agents_dir() / "claw.template.agent"

    @classmethod
    def get_checkpoints_dir(cls) -> Path:
        """
        获取检查点存储目录（project_root/.checkpoints）。

        注意：此方法会在返回前创建目录，历史遗留行为，勿仿照。
        """
        cls._ensure_app_initialization()
        checkpoint_dir = cls.get_project_root() / ".checkpoints"
        checkpoint_dir.mkdir(exist_ok=True)
        return checkpoint_dir

    @classmethod
    def get_checkpoint_dir(cls, checkpoint_id: str) -> Path:
        """
        获取检查点实例目录（project_root/.checkpoints/{checkpoint_id}）。

        注意：此方法会在返回前创建目录，历史遗留行为，勿仿照。
        """
        cls._ensure_app_initialization()
        checkpoint_dir = cls.get_checkpoints_dir() / checkpoint_id
        checkpoint_dir.mkdir(exist_ok=True)
        return checkpoint_dir

    # ── workspace（project_root/.workspace）下的 getter ──────────────────────

    @classmethod
    def get_todos_file(cls) -> Path:
        """获取全局 todo 文件路径（.chat_history/todos.json，由父类管理的 chat_history_dir 承载）"""
        cls._ensure_app_initialization()
        return cls.get_chat_history_dir() / "todos.json"

    @classmethod
    def get_chat_session_file(cls, agent_name: str, agent_id: str) -> Path:
        """获取指定 Agent 会话的 .session.json 文件路径。"""
        cls._ensure_app_initialization()
        return cls.get_chat_history_dir() / f"{agent_name}<{agent_id}>.session.json"

    @classmethod
    def get_subagents_chat_history_dir(cls) -> Path:
        """获取子 Agent 聊天记录目录路径（.chat_history/subagents）"""
        cls._ensure_app_initialization()
        return cls.get_chat_history_dir() / "subagents"

    @classmethod
    def get_subagent_chat_session_file(cls, agent_name: str, agent_id: str) -> Path:
        """获取指定子 Agent 会话的 .session.json 文件路径。"""
        cls._ensure_app_initialization()
        return cls.get_subagents_chat_history_dir() / f"{agent_name}<{agent_id}>.session.json"

    @classmethod
    def get_asr_states_dir(cls) -> Path:
        """获取 ASR 任务状态目录路径（.workspace/.asr_states，按需创建）"""
        cls._ensure_app_initialization()
        return cls._asr_states_dir

    @classmethod
    def get_magic_dir(cls) -> Path:
        """获取 Magic 配置目录路径（.workspace/.magic，按需创建）"""
        cls._ensure_app_initialization()
        return cls._magic_dir

    @classmethod
    def get_magic_config_dir(cls) -> Path:
        """获取 Magic 全局配置目录路径（.workspace/.magic/config，按需创建）"""
        cls._ensure_app_initialization()
        return cls._magic_config_dir

    @classmethod
    def get_tmp_dir(cls) -> Path:
        """获取临时目录路径（.workspace/.tmp，按需创建）"""
        cls._ensure_app_initialization()
        return cls._tmp_dir

    # ── cron 相关路径（.workspace/.magic/cron/ 下，均为按需创建）──────────────

    @classmethod
    def get_cron_dir(cls) -> Path:
        """获取 cron 任务定义目录（.workspace/.magic/cron/，按需创建）"""
        cls._ensure_app_initialization()
        return cls.get_magic_dir() / "cron"

    @classmethod
    def get_cron_state_file(cls) -> Path:
        """获取 cron 运行时状态文件（.workspace/.magic/cron/.cron-state.json）"""
        return cls.get_cron_dir() / ".cron-state.json"

    @classmethod
    def get_cron_result_dir(cls) -> Path:
        """获取 cron 任务结果目录（.workspace/.magic/cron-result/，按需创建）"""
        cls._ensure_app_initialization()
        return cls.get_magic_dir() / "cron-result"

    @classmethod
    def get_cron_result_file(cls, job_id: str, run_at: datetime) -> Path:
        """获取单次 cron 任务结果文件路径（.workspace/.magic/cron-result/{job_id}-{ts}.md）"""
        ts = run_at.strftime("%Y%m%dT%H%M%S")
        return cls.get_cron_result_dir() / f"{job_id}-{ts}.md"

    # ── 内部工具方法 ──────────────────────────────────────────────────────────

    @classmethod
    def _normalize_agent_identifier(cls, value: str, field_name: str = "agent_code") -> str:
        """标准化并校验 agent 标识，避免路径穿越。"""
        normalized = (value or "").strip()
        if not normalized:
            raise ValueError(f"{field_name} cannot be empty")
        if ".." in normalized or "/" in normalized or "\\" in normalized:
            raise ValueError(f"Invalid {field_name}: {value}")
        return normalized
