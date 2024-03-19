#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试 audio_understanding 工具的集成用例

此脚本用于测试 audio_understanding 工具的整体流程，包括：
- 检查测试音频文件是否存在
- 调用 audio_understanding 工具进行转写
- 输出转写结果

执行命令：python tests/tools/test_audio_understanding.py
"""

import os
import sys
import logging
from pathlib import Path
import asyncio

# 配置日志
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 确保能够导入项目模块
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

def setup_project_root():
    """初始化 agentlang 路径管理器和应用上下文"""
    try:
        from agentlang.paths import PathManager
        from agentlang.context.application_context import ApplicationContext
        from app.paths import PathManager as AppPathManager

        project_root = Path(__file__).parent.parent.parent.resolve()

        # 设置基础路径管理器
        PathManager.set_project_root(project_root)
        logger.info(f"已设置基础项目根目录: {project_root}")

        # 设置应用层路径管理器
        AppPathManager.set_project_root(project_root)
        logger.info(f"已设置应用层项目根目录: {project_root}")

        # 设置应用上下文
        ApplicationContext.set_path_manager(AppPathManager)
        logger.info("已设置应用上下文路径管理器")

    except Exception as e:
        logger.error(f"初始化项目根目录失败: {e}")
        raise

def get_test_audio_file() -> Path:
    """获取测试音频文件路径"""
    # 默认测试文件放在 .workspace/test.m4a
    workspace_dir = Path(__file__).parent.parent.parent / ".workspace"
    audio_file = workspace_dir / "test.m4a"
    if not audio_file.exists():
        logger.error(f"测试音频文件不存在: {audio_file}")
        return None
    logger.info(f"找到测试音频文件: {audio_file}")
    return audio_file

async def run_audio_understanding(audio_path: Path):
    """调用 audio_understanding 工具进行转写"""
    try:
        from app.tools.audio_understanding import AudioUnderstanding, AudioUnderstandingParams
        tool = AudioUnderstanding()
        params = AudioUnderstandingParams(
            file_path=str(audio_path),
            format="m4a",
            enable_speaker_info=True,
            timeout=60*60
        )
        logger.info("开始调用 audio_understanding 工具进行转写...")
        result = await tool._run(params)
        # logger.info(f"转写结果：\n{result}")
        return result
    except Exception as e:
        logger.error(f"调用 audio_understanding 工具失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return None

async def main():
    setup_project_root()
    audio_file = get_test_audio_file()
    if not audio_file:
        logger.error("未找到测试音频文件，测试终止。")
        return
    result = await run_audio_understanding(audio_file)
    if result and "错误" not in result and "timeout" not in result:
        logger.info("🎉 语音转写测试通过！")
    else:
        logger.error("❌ 语音转写测试失败！")

if __name__ == "__main__":
    asyncio.run(main())
