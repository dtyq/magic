#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试 image_search 工具的集成用例

此脚本用于测试 image_search 工具的整体流程，包括：
- 构建搜索需求XML配置
- 调用 image_search 工具进行搜索
- 输出搜索结果和分析

执行命令：python tests/tools/test_image_search.py
"""

import os
import sys
import logging
from pathlib import Path
import asyncio
from dotenv import load_dotenv

# 加载环境变量
load_dotenv(override=True)

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

def build_test_requirements_xml() -> str:
    """构建测试用的需求XML"""
    return """<requirements>
    <requirement>
        <name>Figma界面设计工具</name>
        <query>Figma design tool interface UI application screenshot</query>
        <visual_understanding_prompt>分析图片是否展示了Figma设计工具的界面，包括设计面板、工具栏、图层面板等典型的设计软件界面元素</visual_understanding_prompt>
        <requirement_explanation>我们需要找到Figma设计工具的界面截图，用于演示现代设计工具的用户界面特征。图片应该清晰展示Figma的工作界面，包括设计画布、工具面板、属性面板等核心功能区域</requirement_explanation>
        <expected_aspect_ratio>16:9</expected_aspect_ratio>
        <expected_resolution>1920x1080</expected_resolution>
        <count>10</count>
    </requirement>
</requirements>"""

async def run_image_search_test():
    """执行图片搜索测试"""
    try:
        from app.tools.image_search import ImageSearch, ImageSearchParams

        # 检查配置
        from agentlang.config import config
        api_key = config.get("bing.search_api_key")
        endpoint = config.get("bing.search_endpoint")

        if not api_key or api_key == "${BING_SUBSCRIPTION_KEY}":
            logger.warning("⚠️  Bing API Key 未配置，请设置环境变量 BING_SUBSCRIPTION_KEY")
            logger.info("测试将继续运行，但可能会因为API认证失败而失败")

        if not endpoint or endpoint == "${BING_SUBSCRIPTION_ENDPOINT:-https://api.bing.microsoft.com/v7.0}":
            logger.warning("⚠️  Bing API Endpoint 未配置，将使用默认值")

        logger.info(f"配置检查 - API Key: {'已配置' if api_key and not api_key.startswith('${') else '未配置'}")
        logger.info(f"配置检查 - Endpoint: {endpoint}")

        # 创建工具实例
        tool = ImageSearch()

        # 构建测试参数
        test_xml = build_test_requirements_xml()
        params = ImageSearchParams(
            topic_id="figma-interface-test",
            requirements_xml=test_xml
        )

        logger.info("开始调用 image_search 工具进行搜索...")
        logger.info("搜索主题: Figma design tool interface")
        logger.info("预期找到: 10张16:9格式的Figma界面截图")

        # 执行搜索
        result = await tool.execute_purely(params)

        if result.ok:
            logger.info("🎉 图片搜索测试成功！")
            logger.info("=" * 50)
            logger.info("搜索结果摘要:")

            # 输出搜索统计信息
            if result.extra_info:
                extra_info = result.extra_info
                logger.info(f"主题ID: {extra_info.get('topic_id', 'N/A')}")
                logger.info(f"需求名称: {', '.join(extra_info.get('requirement_names', []))}")
                logger.info(f"找到图片数量: {extra_info.get('result_count', 0)}")
                logger.info(f"原始搜索结果: {extra_info.get('original_count', 0)}")
                logger.info(f"需求数量: {extra_info.get('requirement_count', 0)}")
                logger.info(f"去重URL数量: {extra_info.get('deduplicated', 0)}")

            logger.info("=" * 50)
            logger.info("结果内容:")
            logger.info(result.content)

            return True
        else:
            logger.error(f"❌ 图片搜索测试失败: {result.content}")
            return False

    except Exception as e:
        logger.error(f"调用 image_search 工具失败: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

async def main():
    """主函数"""
    logger.info("开始 image_search 工具测试")
    logger.info("=" * 50)

    # 设置项目环境
    setup_project_root()

    # 执行测试
    success = await run_image_search_test()

    if success:
        logger.info("🎉 所有测试通过！")
    else:
        logger.error("❌ 测试失败！")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
