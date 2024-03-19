#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试 RunPythonSnippet 工具

此脚本用于测试 RunPythonSnippet 工具的各种功能，包括：
- 测试Python代码片段执行
- 测试错误处理
- 测试超时机制
- 测试文件清理
- 测试参数验证

执行命令：python tests/tools/test_run_python_snippet.py
"""

import sys
import logging
import asyncio
import pytest
import tempfile
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


class TestRunPythonSnippet:
    """RunPythonSnippet 工具测试类"""

    @classmethod
    def setup_class(cls):
        """设置测试类"""
        # 设置项目根目录
        project_root = setup_project_root()
        if not project_root:
            raise RuntimeError("无法设置项目根目录")

    def setup_method(self):
        """设置测试方法"""
        try:
            from agentlang.context.tool_context import ToolContext
            from app.tools.run_python_snippet import RunPythonSnippet

            self.tool = RunPythonSnippet()
            self.tool_context = ToolContext()
        except ImportError as e:
            logger.error(f"导入模块失败: {e}")
            raise

    @pytest.mark.asyncio
    async def test_simple_print(self):
        """测试简单的 print 语句"""
        from app.tools.run_python_snippet import RunPythonSnippetParams

        params = RunPythonSnippetParams(
            python_code='print("Hello, World!")',
            script_path="test_hello_world.py",
            timeout=10
        )

        result = await self.tool.execute(self.tool_context, params)

        assert result.ok
        assert "Hello, World!" in result.content
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_simple_calculation(self):
        """测试简单的计算"""
        from app.tools.run_python_snippet import RunPythonSnippetParams

        python_code = """
result = 2 + 3
print(f"计算结果: {result}")
"""
        params = RunPythonSnippetParams(
            python_code=python_code,
            script_path="test_calculation.py",
            timeout=10
        )

        result = await self.tool.execute(self.tool_context, params)

        assert result.ok
        assert "计算结果: 5" in result.content
        assert result.exit_code == 0

    @pytest.mark.asyncio
    async def test_file_does_not_exist_after_execution(self):
        """测试脚本文件在执行后被删除"""
        from app.tools.run_python_snippet import RunPythonSnippetParams

        params = RunPythonSnippetParams(
            python_code='print("Testing cleanup")',
            script_path="test_cleanup.py",
            timeout=10
        )

        # 记录脚本路径
        expected_script_path = self.tool.base_dir / params.script_path

        result = await self.tool.execute(self.tool_context, params)

        assert result.ok
        # 验证临时文件已被删除
        assert not expected_script_path.exists()

    @pytest.mark.asyncio
    async def test_python_error_handling(self):
        """测试Python错误处理"""
        from app.tools.run_python_snippet import RunPythonSnippetParams

        python_code = """
# 这里有语法错误
print("Start")
invalid_syntax =
print("End")
"""
        params = RunPythonSnippetParams(
            python_code=python_code,
            script_path="test_error.py",
            timeout=10
        )

        result = await self.tool.execute(self.tool_context, params)

        assert not result.ok  # 应该执行失败
        assert result.exit_code != 0

    @pytest.mark.asyncio
    async def test_existing_file_error(self):
        """测试文件已存在的错误处理"""
        from app.tools.run_python_snippet import RunPythonSnippetParams

        # 先创建一个文件
        script_path = "test_existing_file.py"
        full_path = self.tool.base_dir / script_path
        full_path.write_text("# 已存在的文件", encoding='utf-8')

        try:
            params = RunPythonSnippetParams(
                python_code='print("This should not run")',
                script_path=script_path,
                timeout=10
            )

            result = await self.tool.execute(self.tool_context, params)

            assert not result.ok
            assert "脚本文件已存在" in result.content
        finally:
            # 清理测试文件
            if full_path.exists():
                full_path.unlink()

    @pytest.mark.asyncio
    async def test_invalid_script_path(self):
        """测试无效的脚本路径"""
        from app.tools.run_python_snippet import RunPythonSnippetParams

        with pytest.raises(ValueError, match="脚本路径必须以 .py 结尾"):
            RunPythonSnippetParams(
                python_code='print("Test")',
                script_path="test_file.txt",  # 不是 .py 文件
                timeout=10
            )

    @pytest.mark.asyncio
    async def test_timeout_handling(self):
        """测试超时处理"""
        from app.tools.run_python_snippet import RunPythonSnippetParams

        python_code = """
import time
print("开始睡眠...")
time.sleep(20)  # 睡眠20秒，超过超时时间
print("睡眠结束")
"""
        params = RunPythonSnippetParams(
            python_code=python_code,
            script_path="test_timeout.py",
            timeout=2  # 2秒超时
        )

        result = await self.tool.execute(self.tool_context, params)

        assert not result.ok
        assert "超时" in result.content
        assert result.exit_code == -1

    @pytest.mark.asyncio
    async def test_execute_purely_method(self):
        """测试 execute_purely 方法"""
        from app.tools.run_python_snippet import RunPythonSnippetParams

        params = RunPythonSnippetParams(
            python_code='print("Testing execute_purely")',
            script_path="test_execute_purely.py",
            timeout=10
        )

        result = await self.tool.execute_purely(params)

        assert result.ok
        assert "Testing execute_purely" in result.content
        assert result.exit_code == 0


async def run_simple_test():
    """运行一个简单的测试"""
    try:
        from agentlang.context.tool_context import ToolContext
        from app.tools.run_python_snippet import RunPythonSnippet, RunPythonSnippetParams

        logger.info("开始执行 RunPythonSnippet 简单测试")

        # 创建工具实例
        tool = RunPythonSnippet()
        tool_context = ToolContext()

        # 测试用例列表
        test_cases = [
            {
                "name": "简单打印测试",
                "python_code": 'print("Manual test successful!")',
                "script_path": "manual_test.py",
                "timeout": 10
            },
            {
                "name": "计算测试",
                "python_code": 'result = 2 + 3; print(f"计算结果: {result}")',
                "script_path": "calc_test.py",
                "timeout": 10
            },
            {
                "name": "导入模块测试",
                "python_code": 'import sys; print(f"Python版本: {sys.version}")',
                "script_path": "import_test.py",
                "timeout": 10
            }
        ]

        # 执行测试用例
        for i, test_case in enumerate(test_cases, 1):
            logger.info(f"\n{'='*50}")
            logger.info(f"测试用例 {i}: {test_case['name']}")

            params = RunPythonSnippetParams(
                python_code=test_case['python_code'],
                script_path=test_case['script_path'],
                timeout=test_case['timeout']
            )

            # 记录开始时间
            start_time = time.time()
            result = await tool.execute(tool_context, params)
            execution_time = time.time() - start_time

            # 输出结果
            logger.info(f"执行时间: {execution_time:.2f}秒")
            logger.info(f"测试结果: {result.ok}")
            logger.info(f"输出内容: {result.content}")
            logger.info(f"退出码: {result.exit_code}")

            if result.ok:
                logger.info("✅ 测试通过")
            else:
                logger.error("❌ 测试失败")

            # 间隔一秒再执行下一个测试
            await asyncio.sleep(1)

        logger.info(f"\n{'='*50}")
        logger.info("所有简单测试用例执行完成")
        return True

    except Exception as e:
        logger.exception(f"测试执行失败: {e}")
        return False

async def main():
    """主函数"""
    logger.info("RunPythonSnippet 工具测试开始")

    # 设置项目根目录
    project_root = setup_project_root()
    if not project_root:
        logger.error("无法设置项目根目录，测试中止")
        return False

    try:
        # 执行简单测试
        test_result = await run_simple_test()

        # 输出总结
        logger.info(f"\n{'='*50}")
        logger.info("测试总结:")
        logger.info(f"简单测试: {'✅ 通过' if test_result else '❌ 失败'}")

        if test_result:
            logger.info("🎉 所有测试通过!")
            return True
        else:
            logger.error("❌ 测试失败!")
            return False

    except Exception as e:
        logger.exception(f"测试执行过程中出错: {e}")
        return False

if __name__ == "__main__":
    """
    运行测试脚本

    使用方法:
    1. 直接运行: python tests/tools/test_run_python_snippet.py
    2. 使用 asyncio: python -c "import asyncio; from tests.tools.test_run_python_snippet import main; asyncio.run(main())"
    3. 使用 pytest: pytest tests/tools/test_run_python_snippet.py
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
