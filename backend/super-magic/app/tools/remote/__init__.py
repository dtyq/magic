"""Remote tools 子包

聚合本地化的 magic-service 远端能力工具：
- [CallSimpleTool](file:///app/tools/remote/call_simple_tool.py): 转发 mention 中的 tool flow 调用
- [CallSimpleAgent](file:///app/tools/remote/call_simple_agent.py): 转发 mention 中的 agent 调用

老的动态 RemoteTool / RemoteToolManager 仍保留，用于 agent 启动期 schema 反查注册的远端工具。
"""

from app.tools.remote.call_simple_agent import CallSimpleAgent
from app.tools.remote.call_simple_tool import CallSimpleTool

__all__ = [
    "CallSimpleAgent",
    "CallSimpleTool",
]
