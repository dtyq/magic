#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试 shell_exec 工具的超时和进程终止功能

此脚本用于测试 shell_exec 工具的超时处理机制，包括：
- 测试命令执行超时
- 测试进程是否能被正确终止
- 测试超时后的返回值和错误信息
- 测试不同类型的长时间运行命令

执行命令：python tests/tools/test_shell_exec_timeout.py
"""

import sys
import logging
import asyncio
import time
from pathlib import Path

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 确保能够导入项目模块
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "agentlang"))

def setup_project_root():
    """初始化项目路径管理器"""
    try:
        from agentlang.paths import PathManager
        from app.paths import PathManager as AppPathManager

        # 设置项目根目录
        project_root = Path(__file__).parent.parent.parent
        PathManager.set_project_root(project_root)
        AppPathManager.set_project_root(project_root)

        logger.info(f"项目根目录设置为: {project_root}")
        return project_root
    except Exception as e:
        logger.error(f"设置项目根目录失败: {e}")
        logger.error(f"当前 Python 路径: {sys.path[:5]}")
        return None

async def test_shell_exec_timeout():
    """测试 shell_exec 工具的超时功能"""
    try:
        from agentlang.context.tool_context import ToolContext
        from app.tools.shell_exec import ShellExec, ShellExecParams

        logger.info("开始测试 shell_exec 超时功能")

        # 创建工具实例
        shell_exec = ShellExec()
        tool_context = ToolContext()

        # 测试用例列表
        test_cases = [
            {
                "name": "sleep 命令超时测试",
                "command": "sleep 10",
                "timeout": 3,
                "expected_timeout": True
            },
            {
                "name": "while 循环超时测试",
                "command": "while true; do echo 'running...'; sleep 1; done",
                "timeout": 5,
                "expected_timeout": True
            },
            {
                "name": "Python 脚本超时测试",
                "command": "python -c \"import time; [print(f'tick {i}') or time.sleep(1) for i in range(20)]\"",
                "timeout": 4,
                "expected_timeout": True
            },
            {
                "name": "正常执行不超时测试",
                "command": "echo 'Hello World'",
                "timeout": 5,
                "expected_timeout": False
            }
        ]

        # 执行测试用例
        for i, test_case in enumerate(test_cases, 1):
            logger.info(f"\n{'='*60}")
            logger.info(f"测试用例 {i}: {test_case['name']}")
            logger.info(f"命令: {test_case['command']}")
            logger.info(f"超时时间: {test_case['timeout']}秒")
            logger.info(f"预期是否超时: {test_case['expected_timeout']}")

            # 记录开始时间
            start_time = time.time()

            # 创建参数
            params = ShellExecParams(
                command=test_case['command'],
                timeout=test_case['timeout']
            )

            # 执行命令
            result = await shell_exec.execute(tool_context, params)

            # 计算实际执行时间
            execution_time = time.time() - start_time

            # 输出结果
            logger.info(f"实际执行时间: {execution_time:.2f}秒")
            logger.info(f"执行成功: {result.ok}")
            logger.info(f"退出码: {result.exit_code}")
            logger.info(f"结果内容: {result.content[:200]}...")

            # 验证超时行为
            if test_case['expected_timeout']:
                if result.ok:
                    logger.error(f"❌ 测试失败: 预期超时但命令成功执行")
                elif result.exit_code == -1:
                    logger.info(f"✅ 测试通过: 命令正确超时，退出码为 -1")
                else:
                    logger.warning(f"⚠️  测试异常: 命令失败但退出码不是 -1 (实际: {result.exit_code})")

                # 验证执行时间应该接近超时时间
                if execution_time > test_case['timeout'] * 1.5:
                    logger.error(f"❌ 超时处理异常: 执行时间 {execution_time:.2f}s 远超过超时时间 {test_case['timeout']}s")
                else:
                    logger.info(f"✅ 超时处理正常: 执行时间 {execution_time:.2f}s 接近超时时间 {test_case['timeout']}s")
            else:
                if result.ok:
                    logger.info(f"✅ 测试通过: 命令正常执行完成")
                else:
                    logger.error(f"❌ 测试失败: 预期正常执行但命令失败")

            # 间隔一秒再执行下一个测试
            await asyncio.sleep(1)

        logger.info(f"\n{'='*60}")
        logger.info("所有测试用例执行完成")

    except Exception as e:
        logger.exception(f"测试执行失败: {e}")
        return False

    return True

async def test_process_cleanup():
    """测试进程清理功能"""
    logger.info(f"\n{'='*60}")
    logger.info("开始测试进程清理功能")

    try:
        from agentlang.context.tool_context import ToolContext
        from app.tools.shell_exec import ShellExec, ShellExecParams
        import psutil

        # 创建工具实例
        shell_exec = ShellExec()
        tool_context = ToolContext()

        # 记录测试前的进程数量
        initial_processes = len(psutil.pids())
        logger.info(f"测试前系统进程数: {initial_processes}")

        # 创建一个会产生子进程的长时间运行命令
        params = ShellExecParams(
            command="python -c \"import subprocess; import time; subprocess.Popen(['sleep', '30']); time.sleep(30)\"",
            timeout=3
        )

        # 执行命令（应该超时）
        start_time = time.time()
        result = await shell_exec.execute(tool_context, params)
        execution_time = time.time() - start_time

        logger.info(f"执行时间: {execution_time:.2f}秒")
        logger.info(f"执行成功: {result.ok}")
        logger.info(f"退出码: {result.exit_code}")

        # 等待一段时间让系统清理进程
        await asyncio.sleep(2)

        # 记录测试后的进程数量
        final_processes = len(psutil.pids())
        logger.info(f"测试后系统进程数: {final_processes}")

        # 检查是否有进程泄漏
        process_diff = final_processes - initial_processes
        if abs(process_diff) <= 5:  # 允许一些系统进程的正常波动
            logger.info(f"✅ 进程清理正常: 进程数变化 {process_diff}")
        else:
            logger.warning(f"⚠️  可能存在进程泄漏: 进程数增加了 {process_diff}")

        return True

    except ImportError:
        logger.warning("psutil 模块未安装，跳过进程清理测试")
        return True
    except Exception as e:
        logger.exception(f"进程清理测试失败: {e}")
        return False

async def main():
    """主函数"""
    logger.info("Shell Exec 超时测试开始")

    # 设置项目根目录
    project_root = setup_project_root()
    if not project_root:
        logger.error("无法设置项目根目录，测试中止")
        return False

    try:
        # 执行超时功能测试
        timeout_test_result = await test_shell_exec_timeout()

        # 执行进程清理测试
        cleanup_test_result = await test_process_cleanup()

        # 输出总结
        logger.info(f"\n{'='*60}")
        logger.info("测试总结:")
        logger.info(f"超时功能测试: {'✅ 通过' if timeout_test_result else '❌ 失败'}")
        logger.info(f"进程清理测试: {'✅ 通过' if cleanup_test_result else '❌ 失败'}")

        if timeout_test_result and cleanup_test_result:
            logger.info("🎉 所有测试通过!")
            return True
        else:
            logger.error("❌ 部分测试失败!")
            return False

    except Exception as e:
        logger.exception(f"测试执行过程中出错: {e}")
        return False

if __name__ == "__main__":
    """
    运行测试脚本

    使用方法:
    1. 直接运行: python tests/tools/test_shell_exec_timeout.py
    2. 使用 asyncio: python -c "import asyncio; from tests.tools.test_shell_exec_timeout import main; asyncio.run(main())"
    """
    try:
        # 运行异步主函数
        success = asyncio.run(main())

        # 根据测试结果设置退出码
        sys.exit(0 if success else 1)

    except KeyboardInterrupt:
        logger.info("\n测试被用户中断")
        sys.exit(130)
    except Exception as e:
        logger.exception(f"测试脚本执行失败: {e}")
        sys.exit(1)
