# 钉钉 AI 机器人

通过钉钉 Stream 模式接入，支持流式打字效果。

## 前置条件

在钉钉开放平台创建机器人应用，获取：
- **Client ID**：应用的 AppKey
- **Client Secret**：应用的 AppSecret

同时需要在钉钉开放平台开启机器人的 **Stream 模式**。

## 凭据收集

依次询问用户：
1. 「请提供钉钉机器人应用的 Client ID（AppKey）」
2. 「请提供对应的 Client Secret（AppSecret）」

## 建立连接

（用 run_skills_snippet 工具，python_code 参数为：）

```
from sdk.tool import tool

result = tool.call("connect_dingtalk_bot", {
    "client_id": "<用户提供的 Client ID>",
    "client_secret": "<用户提供的 Client Secret>",
})
print(result.content)
```

## 结果处理

- 成功：「钉钉机器人已成功连接，现在可以在钉钉中与我对话了，支持流式打字效果」
- 失败：告知错误，建议检查 Client ID 和 Client Secret 是否正确，以及是否已在开放平台开通 Stream 模式
