"""Project directory mention handler"""
import json
import re
from pathlib import Path
from typing import Dict, List, Any, Optional
from agentlang.path_manager import PathManager
from app.service.mention.base import BaseMentionHandler, logger
from app.utils.async_file_utils import async_exists, async_read_text


class ProjectDirectoryHandler(BaseMentionHandler):
    """处理项目目录类型的mention

    判断目录是否为特定类型的项目（如设计画布项目）
    """

    # magic.project.js 文件名
    MAGIC_PROJECT_FILE = "magic.project.js"

    def get_type(self) -> str:
        return "project_directory"

    async def get_tip(self, mention: Dict[str, Any]) -> str:
        """项目目录类型的mention根据项目类型返回不同的提示文本"""
        directory_path = mention.get('directory_path', '')
        directory_path = self.normalize_path(directory_path)

        # 异步检测项目类型
        project_type = await self._detect_project_type(directory_path)

        if project_type == 'design':
            return "用户引用了 Canvas 画布项目，需要使用画布项目管理技能或工具进行 AI 图片生成、图片搜索或设计标记处理等操作"
        elif project_type == 'slide':
            return "用户引用了 Slide 幻灯片项目，需要使用幻灯片/PPT制作技能或工具进行演示文稿的创建、编辑或管理操作"
        else:
            # 其他目录共享 "优先查看、阅读或理解" 的提示
            return "请优先查看、阅读或理解上述被引用的文件或目录中的内容"

    async def handle(self, mention: Dict[str, Any], index: int) -> List[str]:
        """处理项目目录引用（异步）

        Args:
            mention: mention数据
            index: mention序号

        Returns:
            List[str]: 格式化的上下文行列表
        """
        directory_path = mention.get('directory_path', '')

        # 标准化目录路径
        directory_path = self.normalize_path(directory_path)

        # 检测项目类型（异步）
        project_type = await self._detect_project_type(directory_path)

        if project_type == 'design':
            # 设计画布项目
            context_lines = [
                f"{index}. [@design_canvas_project:{directory_path}]",
                f"   - 项目类型: 设计画布项目",
                f"   - 项目路径: {directory_path}"
            ]
            logger.info(f"用户prompt添加设计画布项目引用: {directory_path}")
        elif project_type == 'slide':
            # 幻灯片项目
            context_lines = [
                f"{index}. [@slide_project:{directory_path}]",
                f"   - 项目类型: 幻灯片项目",
                f"   - 项目路径: {directory_path}"
            ]
            logger.info(f"用户prompt添加幻灯片项目引用: {directory_path}")
        elif project_type:
            # 其他类型的项目（预留扩展）
            context_lines = [
                f"{index}. [@project_directory:{directory_path}]",
                f"   - 项目类型: {project_type}",
                f"   - 项目路径: {directory_path}"
            ]
            logger.info(f"用户prompt添加 {project_type} 项目引用: {directory_path}")
        else:
            # 普通目录
            context_lines = [
                f"{index}. [@directory:{directory_path}]",
                f"   - 目录路径: {directory_path}"
            ]
            logger.info(f"用户prompt添加目录引用: {directory_path}")

        return context_lines

    async def _detect_project_type(self, directory_path: str) -> Optional[str]:
        """检测项目类型（异步）

        通过读取 magic.project.js 文件判断项目类型

        Args:
            directory_path: 相对于工作区的目录路径

        Returns:
            Optional[str]: 项目类型（如 'design'），如果不是项目则返回 None
        """
        try:
            # 构建 magic.project.js 的绝对路径
            workspace_dir = PathManager.get_workspace_dir()
            project_file_path = workspace_dir / directory_path / self.MAGIC_PROJECT_FILE

            # 异步检查文件是否存在
            if not await async_exists(project_file_path):
                logger.debug(f"未找到 {self.MAGIC_PROJECT_FILE}，视为普通目录: {directory_path}")
                return None

            # 异步读取文件内容
            content = await async_read_text(project_file_path, encoding='utf-8')

            # 验证文件不为空
            if not content or len(content.strip()) == 0:
                logger.warning(f"{self.MAGIC_PROJECT_FILE} 为空，视为普通目录: {directory_path}")
                return None

            # 从 JSONP 格式提取 JSON: window.magicProjectConfig = {...}
            json_str = self._extract_json_from_jsonp(content)
            if not json_str:
                logger.warning(f"{self.MAGIC_PROJECT_FILE} 格式无效，视为普通目录: {directory_path}")
                return None

            # 解析 JSON
            data = json.loads(json_str)

            # 获取项目类型
            project_type = data.get('type')
            if project_type:
                logger.debug(f"检测到项目类型: {project_type}, 路径: {directory_path}")
                return project_type
            else:
                logger.warning(f"{self.MAGIC_PROJECT_FILE} 缺少 type 字段，视为普通目录: {directory_path}")
                return None

        except json.JSONDecodeError as e:
            logger.warning(f"解析 {self.MAGIC_PROJECT_FILE} JSON 失败: {e}, 视为普通目录: {directory_path}")
            return None
        except Exception as e:
            logger.warning(f"读取 {self.MAGIC_PROJECT_FILE} 失败: {e}, 视为普通目录: {directory_path}")
            return None

    @staticmethod
    def _extract_json_from_jsonp(content: str) -> Optional[str]:
        """从 JSONP 格式中提取 JSON 字符串

        Args:
            content: JSONP 文件内容

        Returns:
            Optional[str]: 提取的 JSON 字符串，失败返回 None
        """
        # 支持多种 JSONP 格式
        patterns = [
            # 优先匹配不带分号的
            r"window\.magicProjectConfig\s*=\s*({[\s\S]*})(?:\s*;|\s*$)",
            r"magicProjectConfig\s*=\s*({[\s\S]*})(?:\s*;|\s*$)",
            # 兼容旧格式：严格带分号的
            r"window\.magicProjectConfig\s*=\s*({[\s\S]*?});",
            r"magicProjectConfig\s*=\s*({[\s\S]*?});"
        ]

        for pattern in patterns:
            match = re.search(pattern, content)
            if match:
                return match.group(1)

        return None
