#!/usr/bin/env python3
"""
Git 服务模块

提供 Git 操作的核心功能，包括：
1. 目录变更检测
2. 自动提交
3. 配置管理
4. 多目录管理
"""
import os
import yaml
import logging
import subprocess
from pathlib import Path
from typing import List, Dict, Tuple, Optional

# 配置日志目录
root_dir = Path(__file__).parent.parent.parent
logs_dir = root_dir / 'logs'
logs_dir.mkdir(exist_ok=True)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(logs_dir / 'git_service.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

class GitService:
    """Git 服务：处理单个目录的 git 操作"""

    DEFAULT_CONFIG = {
        'monitored_directories': [
            {
                'path': '.chat_history',
                'ignore_patterns': ['*.tmp', '.git/*']
            },
            {
                'path': '.workspace',
                'ignore_patterns': ['*.tmp', '.git/*']
            }
        ],
        'logging': {
            'level': 'INFO',
            'file': 'git_service.log',
            'max_size': 10485760,  # 10MB
            'backup_count': 5
        },
        'git_user': {
            'name': 'Auto Git Service',
            'email': 'auto-git-service@example.com'
        }
    }

    def __init__(self, directory: str = None, config: Optional[Dict] = None):
        """
        初始化 Git 服务

        Args:
            directory: 要监控的目录路径，如果为 None 则使用配置中的所有目录
            config: 配置信息，如果为 None 则使用默认配置
        """
        self.config = config or self.load_config()
        self.directory = Path(directory) if directory else None
        self.git_services: Dict[str, 'GitService'] = {}

        if directory:
            self._ensure_directory_exists()
            self._init_repository()
            self._configure_git_user()
        else:
            self._initialize_all_directories()

    def _configure_git_user(self) -> None:
        """配置 Git 用户信息"""
        try:
            # 获取用户配置，如果配置文件中没有则使用默认值
            git_user = self.config.get('git_user', {
                'name': 'Auto Git Service',
                'email': 'auto-git-service@example.com'
            })

            # 设置环境变量以确保正确的编码处理
            env = os.environ.copy()
            env['LANG'] = 'en_US.UTF-8'
            env['LC_ALL'] = 'en_US.UTF-8'

            # 检查是否已配置用户信息
            result = subprocess.run(
                ['git', 'config', 'user.name'],
                cwd=self.directory,
                capture_output=True,
                text=True,
                encoding='utf-8',
                env=env
            )

            if result.returncode != 0 or not result.stdout.strip():
                # 如果未配置，则设置默认用户信息
                subprocess.run(
                    ['git', 'config', 'user.name', git_user['name']],
                    cwd=self.directory,
                    env=env,
                    check=True
                )
                logger.info(f"已配置 Git 用户名: {git_user['name']}")

            result = subprocess.run(
                ['git', 'config', 'user.email'],
                cwd=self.directory,
                capture_output=True,
                text=True,
                encoding='utf-8',
                env=env
            )

            if result.returncode != 0 or not result.stdout.strip():
                # 如果未配置，则设置默认邮箱
                subprocess.run(
                    ['git', 'config', 'user.email', git_user['email']],
                    cwd=self.directory,
                    env=env,
                    check=True
                )
                logger.info(f"已配置 Git 邮箱: {git_user['email']}")

        except subprocess.CalledProcessError as e:
            logger.error(f"配置 Git 用户信息失败: {e}")
            raise
        except Exception as e:
            logger.error(f"配置 Git 用户信息时发生错误: {e}")
            raise

    def _get_project_root(self) -> Path:
        """获取项目根目录的绝对路径"""
        try:
            # 尝试使用 PathManager 获取项目根目录
            from agentlang.path_manager import PathManager
            return PathManager.get_project_root()
        except Exception:
            # 如果 PathManager 不可用，使用项目标志文件查找项目根目录
            # 从当前文件位置开始向上查找
            current_path = Path(__file__).resolve().parent

            # 项目标志文件
            project_markers = ['main','requirements.txt', 'main.py', 'setup.py', '.git']

            # 向上查找项目根目录
            while current_path != current_path.parent:
                for marker in project_markers:
                    if (current_path / marker).exists():
                        logger.info(f"通过标志文件 {marker} 找到项目根目录: {current_path}")
                        return current_path
                current_path = current_path.parent

            #将当前目录的上一级目录作为项目根目录
            fallback_root = Path.cwd().parent
            logger.info(f"未找到项目标志文件，使用当前工作目录的上一级目录作为项目根: {fallback_root}")
            return fallback_root

    def _initialize_all_directories(self) -> None:
        """为每个配置的目录初始化 git 服务"""
        for directory_config in self.config['monitored_directories']:
            try:
                # 获取项目根目录的绝对路径
                project_root = self._get_project_root()
                directory_path = directory_config['path']

                # 如果是相对路径，转换为基于项目根目录的绝对路径
                if not Path(directory_path).is_absolute():
                    absolute_path = project_root / directory_path
                else:
                    absolute_path = Path(directory_path)

                git_service = GitService(str(absolute_path), directory_config)
                self.git_services[directory_config['path']] = git_service
                logger.info(f"初始化 {directory_config['path']} 的 git 服务，实际路径: {absolute_path}")
            except Exception as e:
                logger.error(f"初始化 {directory_config['path']} 的 git 服务失败: {e}")
                continue

    def commit_all_changes(self) -> Dict[str, Dict[str, any]]:
        """
        提交所有配置目录的变更

        Returns:
            Dict[str, Dict[str, any]]: 每个目录的提交结果，包含成功状态和commit号
            格式: {
                "path": {
                    "success": bool,
                    "commit_hash": str or None,
                    "message": str
                }
            }
        """
        if not self.git_services:
            return {str(self.directory): self.commit_changes()} if self.directory else {}

        results = {}
        for path, service in self.git_services.items():
            results[path] = service.commit_changes()
        return results

    def _ensure_directory_exists(self) -> None:
        """确保目录存在"""
        if not self.directory.exists():
            self.directory.mkdir(parents=True, exist_ok=True)
            logger.info(f"创建目录: {self.directory}")

    def _init_repository(self) -> None:
        """如果目录不是 git 仓库，则初始化一个"""
        try:
            # 设置环境变量以确保正确的编码处理
            env = os.environ.copy()
            env['LANG'] = 'en_US.UTF-8'
            env['LC_ALL'] = 'en_US.UTF-8'

            if not (self.directory / '.git').exists():
                subprocess.run(['git', 'init'], cwd=self.directory, env=env, check=True)
                logger.info(f"在 {self.directory} 中初始化 git 仓库")

            # 无论是否是新仓库，都确保配置正确的编码设置
            subprocess.run(['git', 'config', 'core.quotepath', 'false'], cwd=self.directory, env=env, check=True)
            subprocess.run(['git', 'config', 'core.precomposeunicode', 'true'], cwd=self.directory, env=env, check=True)
            logger.info(f"已配置 {self.directory} 的 git 编码设置")

        except subprocess.CalledProcessError as e:
            logger.error(f"初始化 git 仓库失败: {e}")
            raise

    def should_ignore(self, path: str) -> bool:
        """根据忽略模式检查文件是否应该被忽略"""
        for pattern in self.config['ignore_patterns']:
            if pattern.endswith('/*'):
                if pattern[:-2] in path:
                    return True
            elif path.endswith(pattern[1:] if pattern.startswith('*') else pattern):
                return True
        return False

    def get_changed_files(self) -> List[Tuple[str, str, Optional[str]]]:
        """
        获取已修改的文件列表及其状态

        Returns:
            List[Tuple[str, str, Optional[str]]]: 变更文件列表，每个元素为 (状态码, 文件路径, 新路径)
        """
        try:
            # 设置环境变量以确保正确的编码处理
            env = os.environ.copy()
            env['LANG'] = 'en_US.UTF-8'
            env['LC_ALL'] = 'en_US.UTF-8'

            result = subprocess.run(
                ['git', 'status', '--porcelain'],
                cwd=self.directory,
                capture_output=True,
                text=True,
                encoding='utf-8',
                env=env,
                check=True
            )

            changes = []
            for line in result.stdout.splitlines():
                if not line.strip():
                    continue

                # 解析状态码和文件路径
                status = line[:2]
                file_path = line[3:].strip()

                # 处理重命名的情况
                if ' -> ' in file_path:
                    old_path, new_path = file_path.split(' -> ')
                    changes.append((status, old_path, new_path))
                else:
                    changes.append((status, file_path, None))

            return changes
        except subprocess.CalledProcessError as e:
            logger.error(f"获取修改文件列表失败: {e}")
            return []

    def generate_commit_message(self) -> str:
        """
        根据文件变更生成提交信息

        Returns:
            str: 提交信息
        """
        changed_files = self.get_changed_files()
        if not changed_files:
            return "chore: 自动提交"

        # 分析文件变更
        changes = {
            'added': [],      # 新增文件
            'modified': [],   # 修改文件
            'deleted': [],    # 删除文件
            'renamed': [],    # 重命名文件
            'copied': [],     # 复制文件
            'untracked': []   # 未跟踪文件
        }

        for status, file_path, new_path in changed_files:
            # 解析状态码
            # 第一个字符表示暂存区状态
            # 第二个字符表示工作区状态
            # M = modified
            # A = added
            # D = deleted
            # R = renamed
            # C = copied
            # ? = untracked

            if status[0] == 'R' or status[1] == 'R':
                changes['renamed'].append((file_path, new_path))
            elif status[0] == 'C' or status[1] == 'C':
                changes['copied'].append((file_path, new_path))
            elif status[0] == 'A' or status[1] == 'A':
                changes['added'].append(file_path)
            elif status[0] == 'M' or status[1] == 'M':
                changes['modified'].append(file_path)
            elif status[0] == 'D' or status[1] == 'D':
                changes['deleted'].append(file_path)
            elif status[0] == '?' or status[1] == '?':
                changes['untracked'].append(file_path)

        # 生成提交信息
        message_parts = []

        # 添加变更类型统计
        total_changes = sum(len(files) for files in changes.values())
        if total_changes == 1:
            # 单个文件变更
            for change_type, files in changes.items():
                if files:
                    if change_type == 'added':
                        message_parts.append(f"feat: 新增文件 {files[0]}")
                    elif change_type == 'modified':
                        message_parts.append(f"feat: 修改文件 {files[0]}")
                    elif change_type == 'deleted':
                        message_parts.append(f"feat: 删除文件 {files[0]}")
                    elif change_type == 'renamed':
                        old_path, new_path = files[0]
                        message_parts.append(f"feat: 重命名文件 {old_path} -> {new_path}")
                    elif change_type == 'copied':
                        old_path, new_path = files[0]
                        message_parts.append(f"feat: 复制文件 {old_path} -> {new_path}")
                    elif change_type == 'untracked':
                        message_parts.append(f"feat: 添加未跟踪文件 {files[0]}")
        else:
            # 多个文件变更
            message_parts.append("feat: 批量更新")
            message_parts.append("")  # 空行分隔

            # 添加变更摘要
            if changes['added']:
                message_parts.append("新增文件:")
                for file in changes['added']:
                    message_parts.append(f"  - {file}")
                message_parts.append("")  # 空行分隔

            if changes['modified']:
                message_parts.append("修改文件:")
                for file in changes['modified']:
                    message_parts.append(f"  - {file}")
                message_parts.append("")  # 空行分隔

            if changes['deleted']:
                message_parts.append("删除文件:")
                for file in changes['deleted']:
                    message_parts.append(f"  - {file}")
                message_parts.append("")  # 空行分隔

            if changes['renamed']:
                message_parts.append("重命名文件:")
                for old_path, new_path in changes['renamed']:
                    message_parts.append(f"  - {old_path} -> {new_path}")
                message_parts.append("")  # 空行分隔

            if changes['copied']:
                message_parts.append("复制文件:")
                for old_path, new_path in changes['copied']:
                    message_parts.append(f"  - {old_path} -> {new_path}")
                message_parts.append("")  # 空行分隔

            if changes['untracked']:
                message_parts.append("添加未跟踪文件:")
                for file in changes['untracked']:
                    message_parts.append(f"  - {file}")

        return "\n".join(message_parts)

    def commit_changes(self) -> Dict[str, any]:
        """
        提交目录中的变更

        Returns:
            Dict[str, any]: 提交结果，包含成功状态、commit号和消息
            格式: {
                "success": bool,
                "commit_hash": str or None,
                "message": str
            }
        """
        result = {
            "success": False,
            "commit_hash": None,
            "message": ""
        }

        try:
            # 检查目录是否存在
            if not self.directory.exists():
                result["message"] = f"目录不存在: {self.directory}"
                logger.error(result["message"])
                return result

            # 检查是否是 git 仓库
            if not (self.directory / '.git').exists():
                result["message"] = f"目录不是 git 仓库: {self.directory}"
                logger.error(result["message"])
                return result

            # 获取变更状态
            changed_files = self.get_changed_files()
            if not changed_files:
                result["success"] = True
                result["message"] = f"没有需要提交的变更: {self.directory}"
                logger.info(result["message"])
                return result

            # 生成提交信息
            commit_message = self.generate_commit_message()
            if not commit_message:
                result["message"] = "生成提交信息失败"
                logger.error(result["message"])
                return result

            # 设置环境变量以确保正确的编码处理
            env = os.environ.copy()
            env['LANG'] = 'en_US.UTF-8'
            env['LC_ALL'] = 'en_US.UTF-8'

            # 添加所有文件
            subprocess.run(['git', 'add', '.'], cwd=self.directory, env=env, check=True)

            # 提交
            subprocess.run(['git', 'commit', '-m', commit_message], cwd=self.directory, env=env, check=True)

            # 获取commit hash
            commit_result = subprocess.run(
                ['git', 'rev-parse', 'HEAD'],
                cwd=self.directory,
                capture_output=True,
                text=True,
                encoding='utf-8',
                env=env,
                check=True
            )
            commit_hash = commit_result.stdout.strip()

            result["success"] = True
            result["commit_hash"] = commit_hash
            result["message"] = f"提交成功: {commit_message}"

            logger.info(f"在 {self.directory} 中提交更改成功，commit hash: {commit_hash}")
            return result

        except subprocess.CalledProcessError as e:
            if e.returncode == 1 and "nothing to commit" in str(e.stderr):
                result["success"] = True
                result["message"] = f"在 {self.directory} 中没有检测到变更"
                logger.info(result["message"])
                return result

            result["message"] = f"在 {self.directory} 中提交更改失败: {e.stderr}"
            logger.error(result["message"])
            return result
        except Exception as e:
            result["message"] = f"在 {self.directory} 中发生错误: {str(e)}"
            logger.error(result["message"])
            return result

    @classmethod
    def load_config(cls, config_path: Optional[str] = None) -> Dict:
        """
        从文件加载配置，如果文件不存在则创建默认配置

        Args:
            config_path: 配置文件路径，如果为 None 则使用默认路径

        Returns:
            Dict: 配置信息
        """
        if config_path is None:
            # 使用项目根目录下的 config 目录
            root_dir = Path(__file__).parent.parent.parent
            config_dir = root_dir / 'config'
            config_dir.mkdir(exist_ok=True)  # 确保配置目录存在
            config_path = config_dir / 'auto_git_config.yaml'
        else:
            config_path = Path(config_path)

        try:
            if config_path.exists():
                with open(config_path, 'r') as f:
                    return yaml.safe_load(f)
            else:
                cls.save_config(cls.DEFAULT_CONFIG, config_path)
                return cls.DEFAULT_CONFIG
        except Exception as e:
            logger.error(f"加载配置时出错: {e}")
            return cls.DEFAULT_CONFIG

    @classmethod
    def save_config(cls, config: Dict, config_path: Optional[str] = None) -> None:
        """
        保存配置到文件

        Args:
            config: 配置信息
            config_path: 配置文件路径，如果为 None 则使用默认路径
        """
        if config_path is None:
            root_dir = Path(__file__).parent.parent.parent
            config_dir = root_dir / 'config'
            config_dir.mkdir(exist_ok=True)
            config_path = config_dir / 'auto_git_config.yaml'
        else:
            config_path = Path(config_path)

        try:
            with open(config_path, 'w') as f:
                yaml.dump(config, f, default_flow_style=False)
        except Exception as e:
            logger.error(f"保存配置时出错: {e}")

    @classmethod
    def validate_config(cls, config: Dict) -> bool:
        """
        验证配置是否有效

        Args:
            config: 配置信息

        Returns:
            bool: 配置是否有效
        """
        try:
            required_keys = ['monitored_directories', 'logging']
            if not all(key in config for key in required_keys):
                return False

            for directory in config['monitored_directories']:
                if not all(key in directory for key in ['path', 'ignore_patterns']):
                    return False

            return True
        except Exception as e:
            logger.error(f"验证配置时出错: {e}")
            return False
