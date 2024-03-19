# app/tools/remote/remote_tool_manager.py
from typing import Dict, List, Set
from agentlang.logger import get_logger
from app.infrastructure.sdk.magic_service.result.agent_details_result import Tool
from .remote_tool import RemoteTool

logger = get_logger(__name__)

# 延迟导入避免循环依赖
def get_tool_factory():
    """延迟导入工具工厂避免循环依赖"""
    from app.tools.core.tool_factory import tool_factory
    return tool_factory


class RemoteToolManager:
    """远程工具管理器

    管理动态远程工具的生命周期，类似于 MCP 工具管理器。
    在每次新 Agent 创建时，清空之前的远程工具，重新创建和注册新的远程工具。
    """

    _instance = None  # 单例模式实例

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RemoteToolManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self.remote_tool_instances: Dict[str, RemoteTool] = {}  # 远程工具实例字典：{effective_name: RemoteTool}
        self._initialized = True

        logger.debug("初始化远程工具管理器")

    @property
    def registered_tools(self) -> Set[str]:
        """获取已注册的工具名称集合（向后兼容属性）"""
        return set(self.remote_tool_instances.keys())

    def clear_all_remote_tools(self):
        """清空所有已注册的远程工具"""
        if not self.remote_tool_instances:
            return

        logger.info(f"开始清空 {len(self.remote_tool_instances)} 个远程工具")

        try:
            self.remote_tool_instances.clear()
            logger.info("远程工具清空完成")
        except Exception as e:
            logger.error(f"清空远程工具失败: {e}")

    def register_remote_tools(self, tools: List[Tool], agent_id: str = "unknown"):
        """注册远程工具

        Args:
            tools: 远程工具列表
            agent_id: Agent ID，用于日志记录
        """
        if not tools:
            logger.debug(f"Agent {agent_id} 没有远程工具需要注册")
            return

        # 过滤出远程工具（type=2 官方工具，type=3 自定义工具）
        remote_tools = [tool for tool in tools if tool.type in (2, 3)]

        if not remote_tools:
            logger.debug(f"Agent {agent_id} 没有远程工具（type=2或3）需要注册")
            return

        logger.info(f"开始为 Agent {agent_id} 注册 {len(remote_tools)} 个远程工具")

        registered_count = 0
        skipped_count = 0
        skipped_tools = []

        # 获取工具工厂实例，避免在循环中重复获取
        tool_factory = get_tool_factory()

        for tool in remote_tools:
            try:
                # 创建远程工具实例
                remote_tool = RemoteTool(tool)

                # 检查工具是否可用（有schema且有效）
                if not remote_tool.is_available():
                    logger.warning(f"跳过不可用的远程工具: {tool.code} (schema 验证失败)")
                    skipped_tools.append(tool.code)
                    skipped_count += 1
                    continue

                # 获取工具的有效名称
                effective_name = remote_tool.get_effective_name()

                # 检查本地工具是否已存在，如果存在则跳过远程工具
                if tool_factory.tool_exists(effective_name):
                    logger.info(f"跳过远程工具 '{tool.code}'，因为本地工具 '{effective_name}' 已存在")
                    skipped_tools.append(tool.code)
                    skipped_count += 1
                    continue

                # 检查是否已存在同名远程工具，如果存在则跳过（只保留第一个）
                if effective_name in self.remote_tool_instances:
                    logger.warning(f"跳过重复的远程工具: {tool.code} (名称 '{effective_name}' 已存在)")
                    skipped_tools.append(tool.code)
                    skipped_count += 1
                    continue

                # 存储远程工具实例到本地字典，使用effective_name作为键
                self.remote_tool_instances[effective_name] = remote_tool
                registered_count += 1

                logger.debug(f"成功注册远程工具: {tool.code} -> {effective_name}")

            except Exception as e:
                logger.error(f"注册远程工具 {tool.code} 失败: {e}")
                skipped_tools.append(tool.code)
                skipped_count += 1

        # 记录注册结果
        total_tools = len(remote_tools)
        if skipped_count > 0:
            logger.info(f"为 Agent {agent_id} 注册了 {registered_count}/{total_tools} 个远程工具，跳过 {skipped_count} 个不可用工具: {skipped_tools}")
        else:
            logger.info(f"为 Agent {agent_id} 成功注册了 {registered_count} 个远程工具")

    def reset_and_register(self, tools: List[Tool], agent_id: str = "unknown"):
        """重置并注册远程工具

        这是主要的入口方法，会先清空现有工具，再注册新工具。

        Args:
            tools: 远程工具列表
            agent_id: Agent ID，用于日志记录
        """
        logger.info(f"开始为 Agent {agent_id} 重置远程工具")

        # 1. 清空现有的远程工具
        self.clear_all_remote_tools()

        # 2. 注册新的远程工具
        self.register_remote_tools(tools, agent_id)

        logger.info(f"Agent {agent_id} 远程工具重置完成，当前已注册 {len(self.remote_tool_instances)} 个远程工具")

    def get_registered_tool_names(self) -> List[str]:
        """获取已注册的远程工具名称列表"""
        return list(self.remote_tool_instances.keys())

    def is_remote_tool(self, tool_name: str) -> bool:
        """检查是否为已注册的远程工具

        Args:
            tool_name: 工具的有效名称（通过get_effective_name()获取）或工具代码（向后兼容）

        Returns:
            bool: 是否存在该远程工具
        """
        # 首先检查是否是有效名称（新方式）
        if tool_name in self.remote_tool_instances:
            return True

        # 向后兼容：检查是否是某个工具的 tool.code
        for remote_tool in self.remote_tool_instances.values():
            if remote_tool.tool_code == tool_name:
                return True

        return False

    def get_remote_tool_instance(self, tool_name: str) -> RemoteTool:
        """获取远程工具实例

        Args:
            tool_name: 工具的有效名称（通过get_effective_name()获取）或工具代码（向后兼容）

        Returns:
            RemoteTool: 远程工具实例

        Raises:
            ValueError: 如果工具不存在
        """
        # 首先尝试通过有效名称获取（新方式）
        if tool_name in self.remote_tool_instances:
            return self.remote_tool_instances[tool_name]

        # 向后兼容：尝试通过 tool.code 获取
        for remote_tool in self.remote_tool_instances.values():
            if remote_tool.tool_code == tool_name:
                return remote_tool

        raise ValueError(f"远程工具 '{tool_name}' 不存在")

    def get_remote_tool_by_code(self, tool_code: str) -> RemoteTool:
        """通过工具代码查找远程工具实例（备用方法）

        Args:
            tool_code: 工具的原始代码

        Returns:
            RemoteTool: 远程工具实例

        Raises:
            ValueError: 如果工具不存在
        """
        for tool_instance in self.remote_tool_instances.values():
            if tool_instance.tool_code == tool_code:
                return tool_instance
        raise ValueError(f"远程工具代码 '{tool_code}' 不存在")

    def has_remote_tool(self, tool_name: str) -> bool:
        """检查是否有指定的远程工具（别名方法）"""
        return self.is_remote_tool(tool_name)


# 创建全局远程工具管理器实例
remote_tool_manager = RemoteToolManager()
