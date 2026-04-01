# 企业微信 AI 机器人

通过企业微信 AI Bot WebSocket 协议接入。

## 前置条件

在企业微信管理后台创建 AI 机器人，获取：
- **Bot ID**：AI 机器人的唯一标识
- **Secret**：用于认证的密钥

## 凭据收集

依次询问用户：
1. 「请提供企业微信 AI Bot 的 Bot ID」
2. 「请提供对应的 Secret」

## 建立连接

（用 run_skills_snippet 工具，python_code 参数为：）

```
from sdk.tool import tool

result = tool.call("connect_wecom_bot", {
    "bot_id": "<用户提供的 Bot ID>",
    "secret": "<用户提供的 Secret>",
})
print(result.content)
```

## 结果处理

- 成功：「企业微信机器人已成功连接，现在可以在企微中与我对话了」
- 失败：告知错误，建议检查 Bot ID 和 Secret 是否正确
