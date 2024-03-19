#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
简单的 AgentLang 使用示例
"""

import asyncio
from agentlang.agent import BaseAgent
from agentlang.llms import LLMFactory, LLMClientConfig
from agentlang.event import EventDispatcher

async def main():
    # 初始化 LLM 客户端
    llm_config = LLMClientConfig(
        model="gpt-4.1",
        api_key="your-api-key-here",
    )
    llm_client = LLMFactory.create_llm_client(llm_config)
    
    # 初始化事件调度器
    event_dispatcher = EventDispatcher()
    
    # 这里可以添加更多示例代码
    
    print("AgentLang 示例已初始化")

if __name__ == "__main__":
    asyncio.run(main()) 