#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
工具调用脚本

简化调用测试脚本的过程，提供更方便的命令行界面。
"""

import sys
import os
import argparse
import asyncio
import json
import traceback
import inspect
from pathlib import Path
from dotenv import load_dotenv

# 加载环境变量
load_dotenv(override=True)

# 确保能够导入测试脚本
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

# 获取项目根目录
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(project_root))

# 设置项目根目录
from app.paths import PathManager
PathManager.set_project_root(project_root)

# 设置日志
from agentlang.logger import get_logger, setup_logger, configure_logging_intercept
# 从环境变量获取日志级别，默认为INFO
log_level = os.getenv("LOG_LEVEL", "INFO")
setup_logger(log_name="app", console_level=log_level)
configure_logging_intercept()

logger = get_logger(__name__)

# 导入工具相关模块
from app.tools.core.tool_factory import ToolFactory
from app.tools.core.tool_executor import ToolExecutor
from agentlang.context.tool_context import ToolContext
from app.core.context.agent_context import AgentContext
from agentlang.tools.tool_result import ToolResult


class ToolTester:
    """工具测试类

    提供列出工具、查看工具信息和执行工具的功能
    """

    def __init__(self):
        """初始化工具测试器"""
        self.tool_factory = ToolFactory()
        self.tool_factory.initialize()
        self.tool_executor = ToolExecutor()

        # 创建一个测试用的代理上下文
        self.agent_context = AgentContext()
        self.agent_context.is_main_agent = True
        # 如果需要设置更多上下文数据，可以在这里添加

    def list_tools(self) -> None:
        """列出所有可用工具"""
        tools = self.tool_factory.get_all_tools()
        print(f"发现 {len(tools)} 个工具:")

        for name, info in tools.items():
            description = info.description
            print(f"- {name}: {description}")

    def show_tool_info(self, tool_name: str) -> None:
        """显示工具的详细信息

        Args:
            tool_name: 工具名称
        """
        tool_info = self.tool_factory.get_tool(tool_name)
        if not tool_info:
            print(f"错误: 工具 '{tool_name}' 不存在")
            return

        print(f"工具名称: {tool_name}")
        print(f"描述: {tool_info.description}")

        # 获取参数信息
        params_class = tool_info.params_class
        if params_class:
            # 获取工具实例以查看参数模式
            tool_instance = self.tool_factory.get_tool_instance(tool_name)
            schema = tool_instance.to_param()

            # 打印参数信息
            print("\n参数信息:")

            # 输出必填参数
            if "required" in schema:
                print(f"必填参数: {', '.join(schema['required'])}")

            # 输出所有参数的详细信息
            if "properties" in schema:
                print("\n参数详情:")
                for param_name, param_info in schema["properties"].items():
                    param_type = param_info.get("type", "未知类型")
                    param_desc = param_info.get("description", "无描述")
                    required = "必填" if "required" in schema and param_name in schema["required"] else "可选"

                    print(f"  - {param_name} ({param_type}, {required}): {param_desc}")
        else:
            print("该工具没有定义参数类")

    def _print_tool_result(self, result: ToolResult) -> None:
        """打印工具执行结果

        Args:
            result: 工具执行结果
        """
        print("\n执行结果:")
        print(f"状态: {'成功' if result.ok else '失败'}")
        print(f"执行时间: {result.execution_time:.4f} 秒")

        if result.content:
            print("\n内容:")
            print(result.content)

        if result.extra_info:
            print("\n额外信息:")
            print(json.dumps(result.extra_info, ensure_ascii=False, indent=2))

        if result.system:
            print("\n系统信息:")
            print(result.system)


class EnhancedToolTester(ToolTester):
    """增强型工具测试类

    扩展基本工具测试类，添加详细的错误处理和调试信息
    """

    async def execute_tool(self, tool_name, params=None):
        """执行工具，增强错误处理和调试信息

        Args:
            tool_name: 工具名称
            params: 工具参数
        """
        if not params:
            params = {}

        # 检查工具是否存在
        tool_info = self.tool_factory.get_tool(tool_name)
        if not tool_info:
            logger.error(f"错误: 工具 '{tool_name}' 不存在")
            return

        # 创建工具上下文
        try:
            # 创建工具上下文，使用正确的参数
            tool_context = ToolContext(
                agent_context=self.agent_context,
                tool_call_id=f"test_{tool_name}",
                tool_name=tool_name,
                arguments=params
            )

            # 执行工具调用
            logger.info(f"正在执行工具 '{tool_name}'...")
            result = await self.tool_executor.execute_tool_call(tool_context, params)
            self._print_tool_result(result)
        except TypeError as e:
            # 如果参数不正确，打印错误信息以帮助调试
            logger.error(f"创建工具上下文时出错: {e}")
            logger.debug(f"ToolContext需要的参数: {inspect.signature(ToolContext.__init__)}")
            raise
        except Exception as e:
            logger.error(f"执行工具时出错: {e}")
            logger.error(f"错误详情: {traceback.format_exc()}")


async def main():
    """主函数"""
    # 创建命令行参数解析器
    parser = argparse.ArgumentParser(description="工具测试命令行工具")

    # 全局选项
    parser.add_argument("--config", "-c", help="配置文件路径")

    # 子命令
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    # 列出工具子命令
    list_parser = subparsers.add_parser("list", help="列出所有可用工具")

    # 查看工具信息子命令
    info_parser = subparsers.add_parser("info", help="显示工具详细信息")
    info_parser.add_argument("tool_name", help="工具名称")

    # 执行工具子命令
    exec_parser = subparsers.add_parser("exec", help="执行工具")
    exec_parser.add_argument("tool_name", help="工具名称")
    exec_parser.add_argument("--params", "-p", help="JSON 格式的工具参数，可以是字符串或文件路径")

    # 解析命令行参数
    args = parser.parse_args()

    # 如果没有指定子命令，显示帮助信息
    if not args.command:
        parser.print_help()
        return

    # 处理配置文件路径
    if args.config:
        os.environ['CONFIG_PATH'] = os.path.abspath(args.config)
        logger.info(f"使用指定的配置文件: {os.environ['CONFIG_PATH']}")

    try:
        # 创建工具测试器
        tester = EnhancedToolTester()

        # 处理子命令
        if args.command == "list":
            tester.list_tools()
        elif args.command == "info":
            tester.show_tool_info(args.tool_name)
        elif args.command == "exec":
            # 解析参数
            params = {}
            if args.params:
                try:
                    # 判断是文件路径还是直接的 JSON 字符串
                    if os.path.isfile(args.params):
                        with open(args.params, 'r', encoding='utf-8') as f:
                            params = json.load(f)
                    else:
                        params = json.loads(args.params)
                except json.JSONDecodeError:
                    logger.error("错误: 参数必须是有效的 JSON 格式")
                    sys.exit(1)
                except Exception as e:
                    logger.error(f"错误: 无法解析参数: {e}")
                    sys.exit(1)
            else:
                # 尝试加载与工具同名的参数文件
                params_dir = Path(__file__).resolve().parent / "params"
                params_file = params_dir / f"{args.tool_name}.json"

                if params_file.exists():
                    logger.info(f"使用默认参数文件: {params_file}")
                    try:
                        with open(params_file, 'r', encoding='utf-8') as f:
                            params = json.load(f)
                    except json.JSONDecodeError:
                        logger.error(f"错误: 默认参数文件 {params_file} 不是有效的 JSON 格式")
                        sys.exit(1)
                    except Exception as e:
                        logger.error(f"错误: 无法加载默认参数文件 {params_file}: {e}")
                        sys.exit(1)
                else:
                    logger.info(f"未找到默认参数文件，使用空参数")

            # 执行工具
            await tester.execute_tool(args.tool_name, params)
    except Exception as e:
        logger.error(f"执行测试脚本时出错: {e}")
        logger.error(f"错误详情: {traceback.format_exc()}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
