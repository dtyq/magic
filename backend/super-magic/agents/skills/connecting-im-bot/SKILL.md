---
name: connecting-im-bot
description: 配置和连接 IM 渠道机器人（企业微信、钉钉、飞书）。当用户提到「配置机器人」「接入企微/钉钉/飞书」「连接到 IM」「设置机器人」等相关需求时使用。
---

# 连接 IM 渠道机器人

让当前 Agent 通过 WebSocket 长连接接入 IM 平台，实现在对应 App 中收发消息（支持流式打字效果）。

## 按需读取的渠道参考文件

确认用户要接入哪个渠道后，读取对应文件获取凭据要求和操作步骤：

- 企业微信 → [reference/wecom.md](reference/wecom.md)
- 钉钉 → [reference/dingtalk.md](reference/dingtalk.md)
- 飞书 / Lark → [reference/lark.md](reference/lark.md)

## 通用流程

1. **确认渠道**：如果用户未说明渠道，先问「您想接入哪个 IM 平台？企业微信、钉钉还是飞书？」
2. **读取 reference**：加载对应渠道的参考文件
3. **收集凭据**：按渠道 reference 中的说明，依次询问所需凭据
4. **建立连接**：执行渠道 reference 中的 run_skills_snippet 代码
5. **确认结果**：连接成功则告知用户，失败则将错误信息反馈并提示检查凭据和平台配置

## 注意事项

- 连接建立后持续后台运行，凭证自动保存到 `.magiclaw/config/im-channels.json`，并绑定当前 sandbox；同一 sandbox 进程重启后会自动重连，无需再次配置
- 如需禁用某个渠道的自动重连，可手动编辑 `.magiclaw/config/im-channels.json`，将对应渠道的 `enabled` 改为 `false`
- 各渠道消息均与 Web 端共用同一个 Agent，对话历史互通
