#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试 shell_exec 工具对顽固进程的终止能力

此脚本创建一个特别难杀的Python进程来测试渐进式终止策略
"""

import os
import sys
import logging
import asyncio
import time
from pathlib import Path

# 配置日志
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
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
        return None

async def test_stubborn_process():
    """测试顽固进程的终止"""
    try:
        from agentlang.context.tool_context import ToolContext
        from app.tools.shell_exec import ShellExec, ShellExecParams

        logger.info("开始测试顽固进程终止")

        # 创建工具实例
        shell_exec = ShellExec()
        tool_context = ToolContext()

        test_cases = [
            {
                "name": "简单的顽固进程",
                "command": "python3 -c \"import signal; signal.signal(signal.SIGTERM, lambda s,f: print('拒绝退出!')); import time; [time.sleep(1) for _ in range(100)]\"",
                "timeout": 5,
                "expected_timeout": True,
                "description": "忽略SIGTERM信号的简单进程"
            },
            {
                "name": "复杂顽固进程测试",
                "command": "python3 -c \"import signal,time,os; signal.signal(signal.SIGTERM, lambda s,f: print('收到SIGTERM拒绝退出!', flush=True)); print('顽固进程启动 PID:', os.getpid(), flush=True); [print('运行中', i, flush=True) or time.sleep(1) for i in range(60)]\"",
                "timeout": 6,
                "expected_timeout": True,
                "description": "更复杂的忽略SIGTERM信号进程"
            },
            {
                "name": "后台无限循环进程",
                "command": "python3 -c \"import time; [print('后台运行', i) or time.sleep(1) for i in range(100)]\" &",
                "timeout": 4,
                "expected_timeout": True,
                "description": "在后台运行的长时间进程"
            },
            {
                "name": "普通正常进程(不应该超时)",
                "command": "python3 -c \"print('快速执行'); import time; time.sleep(1); print('完成')\"",
                "timeout": 5,
                "expected_timeout": False,
                "description": "正常的快速执行进程，用于验证非超时情况"
            }
        ]

        # 执行测试用例
        for i, test_case in enumerate(test_cases, 1):
            logger.info(f"\n{'='*80}")
            logger.info(f"测试用例 {i}: {test_case['name']}")
            logger.info(f"描述: {test_case['description']}")
            logger.info(f"超时时间: {test_case['timeout']}秒")
            logger.info(f"预期是否超时: {test_case['expected_timeout']}")

            # 记录开始时间
            start_time = time.time()

            # 创建参数
            params = ShellExecParams(
                command=test_case['command'],
                timeout=test_case['timeout']
            )

            logger.info(f"开始执行命令...")

            # 执行命令
            result = await shell_exec.execute(tool_context, params)

            # 计算实际执行时间
            execution_time = time.time() - start_time

            # 输出结果
            logger.info(f"实际执行时间: {execution_time:.2f}秒")
            logger.info(f"执行成功: {result.ok}")
            logger.info(f"退出码: {result.exit_code}")
            logger.info(f"结果内容: {result.content}")

            # 验证超时行为
            if test_case['expected_timeout']:
                if result.ok:
                    logger.error(f"❌ 测试失败: 预期超时但命令成功执行")
                elif result.exit_code == -1:
                    logger.info(f"✅ 测试通过: 命令正确超时，退出码为 -1")

                    # 检查总执行时间是否合理
                    # 预期时间 = 原超时时间 + 最多6秒的清理时间 (5s SIGTERM + 1s SIGKILL)
                    max_expected_time = test_case['timeout'] + 8  # 给一些缓冲
                    if execution_time <= max_expected_time:
                        logger.info(f"✅ 清理时间合理: {execution_time:.2f}s <= {max_expected_time}s")
                    else:
                        logger.warning(f"⚠️  清理时间过长: {execution_time:.2f}s > {max_expected_time}s")
                else:
                    logger.warning(f"⚠️  测试异常: 命令失败但退出码不是 -1 (实际: {result.exit_code})")
            else:
                if result.ok:
                    logger.info(f"✅ 测试通过: 命令正常执行完成")
                else:
                    logger.error(f"❌ 测试失败: 预期正常执行但命令失败")

            # 短暂等待，让系统完全清理
            logger.info("等待系统清理...")
            await asyncio.sleep(2)

        logger.info(f"\n{'='*80}")
        logger.info("顽固进程测试完成")

    except Exception as e:
        logger.exception(f"测试执行失败: {e}")
        return False

    return True

async def main():
    """主函数"""
    logger.info("顽固进程终止能力测试开始")

    # 设置项目根目录
    project_root = setup_project_root()
    if not project_root:
        logger.error("无法设置项目根目录，测试中止")
        return False

    try:
        # 执行顽固进程测试
        test_result = await test_stubborn_process()

        # 输出总结
        logger.info(f"\n{'='*80}")
        logger.info("测试总结:")
        logger.info(f"顽固进程测试: {'✅ 通过' if test_result else '❌ 失败'}")

        if test_result:
            logger.info("🎉 渐进式终止策略测试通过!")
            return True
        else:
            logger.error("❌ 渐进式终止策略测试失败!")
            return False

    except Exception as e:
        logger.exception(f"测试执行过程中出错: {e}")
        return False

if __name__ == "__main__":
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
