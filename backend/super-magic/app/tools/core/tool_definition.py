"""工具定义模块

用于支持预构建工具定义和按需加载工具实例
"""

import json
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from pathlib import Path

from agentlang.logger import get_logger
from app.path_manager import PathManager

logger = get_logger(__name__)


@dataclass
class ToolDefinition:
    """工具定义数据结构"""
    # 基本信息
    name: str
    description: str
    module_path: str  # 工具类所在模块路径，如 "app.tools.append_to_file"
    class_name: str   # 工具类名，如 "AppendToFile"

    # 参数定义（JSON Schema格式）
    parameters_schema: Optional[Dict[str, Any]] = None

    # 元数据
    created_at: Optional[str] = None
    version: str = "1.0"

    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ToolDefinition':
        """从字典创建"""
        return cls(**data)

    def is_valid(self) -> bool:
        """检查定义是否有效"""
        return bool(self.name and self.description and self.module_path and self.class_name)


class ToolDefinitionManager:
    """工具定义管理器"""

    def __init__(self, definition_file: Optional[Path] = None):
        if definition_file is None:
            # 优先使用PathManager获取项目根目录
            project_root = PathManager.get_project_root()
            self.definition_file = project_root / "config" / "tool_definitions.json"
            logger.debug(f"使用PathManager获取的项目根目录: {project_root}")
        else:
            self.definition_file = definition_file

        logger.debug(f"ToolDefinitionManager 初始化，定义文件路径: {self.definition_file}")
        self._definitions: Dict[str, ToolDefinition] = {}
        self._loaded = False

    def add_definition(self, definition: ToolDefinition) -> None:
        """添加工具定义"""
        if not definition.is_valid():
            raise ValueError(f"工具定义无效: {definition.name}")

        self._definitions[definition.name] = definition
        logger.debug(f"添加工具定义: {definition.name}")

    def get_definition(self, tool_name: str) -> Optional[ToolDefinition]:
        """获取工具定义"""
        if not self._loaded:
            self.load_definitions()
        return self._definitions.get(tool_name)

    def get_all_definitions(self) -> Dict[str, ToolDefinition]:
        """获取所有工具定义"""
        if not self._loaded:
            self.load_definitions()
        return self._definitions.copy()

    def get_tool_names(self) -> List[str]:
        """获取所有工具名称"""
        if not self._loaded:
            self.load_definitions()
        return list(self._definitions.keys())

    def save_definitions(self) -> None:
        """保存工具定义到文件"""
        start_time = time.time()

        # 确保目录存在
        self.definition_file.parent.mkdir(parents=True, exist_ok=True)

        # 转换为可序列化的格式
        data = {
            "version": "1.0",
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "tool_count": len(self._definitions),
            "tools": {name: definition.to_dict() for name, definition in self._definitions.items()}
        }

        # 保存到文件
        with open(self.definition_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        duration = time.time() - start_time
        logger.info(f"工具定义已保存到 {self.definition_file}，共 {len(self._definitions)} 个工具，耗时 {duration:.3f}s")

    def load_definitions(self) -> None:
        """从文件加载工具定义"""
        if not self.definition_file.exists():
            logger.warning(f"工具定义文件不存在: {self.definition_file}")
            self._loaded = True
            return

        start_time = time.time()

        try:
            with open(self.definition_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # 解析工具定义
            tools_data = data.get("tools", {})
            for tool_name, tool_data in tools_data.items():
                try:
                    definition = ToolDefinition.from_dict(tool_data)
                    self._definitions[tool_name] = definition
                except Exception as e:
                    logger.error(f"解析工具定义失败 {tool_name}: {e}")

            duration = time.time() - start_time
            logger.info(f"从 {self.definition_file} 加载了 {len(self._definitions)} 个工具定义，耗时 {duration:.3f}s")

        except Exception as e:
            logger.error(f"加载工具定义文件失败: {e}")

        self._loaded = True

    def clear_definitions(self) -> None:
        """清空工具定义"""
        self._definitions.clear()
        self._loaded = False

    def get_stats(self) -> Dict[str, Any]:
        """获取统计信息"""
        if not self._loaded:
            self.load_definitions()

        return {
            "total_tools": len(self._definitions),
            "definition_file": str(self.definition_file),
            "file_exists": self.definition_file.exists(),
            "tool_names": list(self._definitions.keys())
        }


# 创建全局实例
tool_definition_manager = ToolDefinitionManager()
