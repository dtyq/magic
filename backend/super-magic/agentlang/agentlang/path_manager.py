"""
路径相关的常量和工具函数，使用面向对象方式实现
"""

import os
from pathlib import Path
from typing import Optional, ClassVar

class PathManager:
    """
    路径管理器，提供项目中核心且通用的路径访问
    使用静态方法实现，不需要实例化
    """

    # 静态类变量 - 核心目录
    _project_root: ClassVar[Optional[Path]] = None
    _logs_dir_name: ClassVar[str] = "logs"
    _logs_dir: ClassVar[Optional[Path]] = None
    _workspace_dir_name: ClassVar[str] = ".workspace"
    _workspace_dir: ClassVar[Optional[Path]] = None
    _browser_data_dir_name: ClassVar[str] = ".browser"
    _browser_data_dir: ClassVar[Optional[Path]] = None
    _cache_dir_name: ClassVar[str] = ".cache"
    _cache_dir: ClassVar[Optional[Path]] = None
    _chat_history_dir_name: ClassVar[str] = ".chat_history"  # 使用应用层建议的顶级带点目录
    _chat_history_dir: ClassVar[Optional[Path]] = None
    _credentials_dir_name: ClassVar[str] = ".credentials" # 凭证目录路径
    _credentials_dir: ClassVar[Optional[Path]] = None

    _initialized: ClassVar[bool] = False

    @classmethod
    def _is_pyinstaller_environment(cls) -> bool:
        """
        检查是否在 PyInstaller 打包环境中

        Returns:
            bool: 是否在 PyInstaller 环境中
        """
        import sys
        return getattr(sys, 'frozen', False)

    @classmethod
    def _detect_project_root_in_pyinstaller(cls) -> Path:
        """
        在 PyInstaller 环境中检测项目根目录

        Returns:
            项目根目录路径

        Raises:
            RuntimeError: 无法检测到项目根目录时
        """
        import sys
        import os
        
        # 在 PyInstaller 环境中，可执行文件通常在 /app 目录下
        # 我们需要查找包含必要文件的目录
        current_dir = Path.cwd()
        
        # 在 PyInstaller 环境中，我们通常使用当前工作目录作为项目根目录
        # 因为所有必要的文件都被打包到了可执行文件中
        if current_dir.exists():
            # 检查是否有必要的目录结构
            if (current_dir / "logs").exists() or (current_dir / ".credentials").exists():
                return current_dir
            
            # 如果没有找到，尝试使用当前目录的父目录
            parent_dir = current_dir.parent
            if parent_dir.exists() and ((parent_dir / "logs").exists() or (parent_dir / ".credentials").exists()):
                return parent_dir
        
        # 如果都找不到，使用当前工作目录作为默认值
        return current_dir

    @classmethod
    def _auto_detect_project_root(cls) -> Path:
        """
        自动检测项目根目录

        Returns:
            项目根目录路径

        Raises:
            RuntimeError: 无法检测到项目根目录时
        """
        # 检查是否在 PyInstaller 打包环境中
        if cls._is_pyinstaller_environment():
            return cls._detect_project_root_in_pyinstaller()
        
        # 定义项目根目录的标识文件/目录
        project_markers = [
            '.git',
            'requirements.txt',
            'setup.py',
            'pyproject.toml',
            'app',           # 项目特有目录
            'bin',           # 项目特有目录
            'config',        # 项目特有目录
            'agentlang',     # 项目特有目录
            'README.md',
            'main.py'
        ]

        # 从当前工作目录开始向上查找
        current_dir = Path.cwd()

        # 最多向上查找10级目录（增加查找层级）
        for level in range(10):
            # 检查当前目录是否包含项目标识
            marker_count = 0
            found_markers = []

            for marker in project_markers:
                if (current_dir / marker).exists():
                    marker_count += 1
                    found_markers.append(marker)

            # 如果找到足够多的标识文件/目录，认为是项目根目录
            # 调整阈值：至少需要3个标识才确认为项目根目录
            if marker_count >= 3:
                return current_dir

            # 向上一级目录查找
            parent_dir = current_dir.parent
            if parent_dir == current_dir:  # 已经到根目录
                break
            current_dir = parent_dir

        # 如果无法自动检测，直接报错
        raise RuntimeError(
            f"无法自动检测项目根目录。请确保当前工作目录在项目内，或者手动调用 "
            f"PathManager.set_project_root() 设置项目根目录。\n"
            f"当前工作目录: {Path.cwd()}\n"
            f"预期的项目标识: {project_markers}"
        )

    @classmethod
    def _ensure_initialization(cls) -> None:
        """确保PathManager已初始化"""
        if not cls._initialized:
            # 尝试自动检测项目根目录
            auto_root = cls._auto_detect_project_root()
            cls.set_project_root(auto_root)

    @classmethod
    def set_project_root(cls, project_root: Path) -> None:
        """
        设置项目根目录并初始化所有核心路径

        Args:
            project_root: 项目根目录路径
        """
        if cls._initialized:
            return

        cls._project_root = project_root

        # 初始化所有核心路径
        cls._logs_dir = cls._project_root / cls._logs_dir_name
        cls._workspace_dir = cls._project_root / cls._workspace_dir_name
        cls._browser_data_dir = cls._project_root / cls._browser_data_dir_name
        cls._cache_dir = cls._project_root / cls._cache_dir_name
        cls._chat_history_dir = cls._project_root / cls._chat_history_dir_name
        cls._credentials_dir = cls._project_root / cls._credentials_dir_name

        # 确保必要的目录存在
        cls._ensure_directories_exist()

        cls._initialized = True

    @classmethod
    def _ensure_directories_exist(cls) -> None:
        """确保所有核心目录存在"""
        if cls._project_root is None:
            raise RuntimeError("必须先调用 set_project_root 设置项目根目录")

        cls._logs_dir.mkdir(exist_ok=True)
        cls._workspace_dir.mkdir(exist_ok=True)
        cls._browser_data_dir.mkdir(exist_ok=True)
        cls._cache_dir.mkdir(exist_ok=True)
        cls._chat_history_dir.mkdir(exist_ok=True)

    @classmethod
    def get_project_root(cls) -> Path:
        """获取项目根目录路径"""
        cls._ensure_initialization()
        return cls._project_root

    @classmethod
    def get_logs_dir_name(cls) -> str:
        """获取日志目录名称"""
        return cls._logs_dir_name

    @classmethod
    def get_logs_dir(cls) -> Path:
        """获取日志目录路径"""
        cls._ensure_initialization()
        return cls._logs_dir

    @classmethod
    def get_workspace_dir_name(cls) -> str:
        """获取工作空间目录名称"""
        return cls._workspace_dir_name

    @classmethod
    def get_workspace_dir(cls) -> Path:
        """获取工作空间目录路径"""
        cls._ensure_initialization()
        return cls._workspace_dir

    @classmethod
    def get_browser_data_dir_name(cls) -> str:
        """获取浏览器数据目录名称"""
        return cls._browser_data_dir_name

    @classmethod
    def get_browser_data_dir(cls) -> Path:
        """获取浏览器数据目录路径"""
        cls._ensure_initialization()
        return cls._browser_data_dir

    @classmethod
    def get_cache_dir_name(cls) -> str:
        """获取缓存目录名称"""
        return cls._cache_dir_name

    @classmethod
    def get_cache_dir(cls) -> Path:
        """获取缓存目录路径"""
        cls._ensure_initialization()
        return cls._cache_dir

    @classmethod
    def get_chat_history_dir_name(cls) -> str:
        """获取聊天历史记录目录名称"""
        return cls._chat_history_dir_name

    @classmethod
    def get_chat_history_dir(cls) -> Path:
        """获取聊天历史记录目录路径"""
        cls._ensure_initialization()
        return cls._chat_history_dir

    @classmethod
    def get_credentials_dir(cls) -> Path:
        """获取凭证目录路径"""
        cls._ensure_initialization()
        return cls._credentials_dir
