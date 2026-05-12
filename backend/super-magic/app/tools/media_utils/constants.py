"""媒体理解工具公共常量。"""

# 禁用模型思考模式，减少视觉/视频理解场景下的无效 token 消耗
DISABLE_THINKING_BODY: dict = {"thinking": {"type": "disabled"}}
