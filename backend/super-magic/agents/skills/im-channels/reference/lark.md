# 飞书 / Lark AI 机器人

通过飞书长连接模式（WebSocket）接入，支持流式打字效果。

## 前置条件

在飞书开放平台创建企业自建应用，获取：
- **App ID**：应用凭证中的 App ID
- **App Secret**：应用凭证中的 App Secret

同时需要在飞书开放平台完成以下配置：
1. 「事件订阅」→「长连接（WebSocket）」→ 开启长连接接收事件
2. 「事件订阅」→ 添加事件 → 搜索并添加「接收消息 v2.0（im.message.receive_v1）」
3. 「应用权限」→ 申请并开通：`im:message`、`cardkit:card`

## 凭据收集

依次询问用户：
1. 「请提供飞书应用的 App ID」
2. 「请提供对应的 App Secret」

## 建立连接

（用 run_sdk_snippet 工具，python_code 参数为：）

```
from sdk.tool import tool

result = tool.call("connect_lark_bot", {
    "app_id": "<用户提供的 App ID>",
    "app_secret": "<用户提供的 App Secret>",
})
print(result.content)
```

## 结果处理

- 成功：「飞书机器人已成功连接，现在可以在飞书中与我对话了，支持流式打字效果」
- 失败：告知错误，检查 App ID/Secret 是否正确，以及飞书应用权限和事件订阅是否已配置
