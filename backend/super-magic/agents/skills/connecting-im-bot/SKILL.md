---
name: connecting-im-bot
description: Use when configuring or connecting IM channel bots such as WeChat, WeCom, DingTalk, or Lark, including requests about setting up bots, connecting to IM, or enabling chat integration.
---

# Connect IM Channel Bots

Connect the current Agent to an IM platform so it can receive and send messages in the target app.

## Read The Right Reference

After confirming which channel the user wants, read the matching reference file for credentials and exact steps:

- **WeChat** (official ClawBot) -> [reference/wechat.md](reference/wechat.md)
- **WeCom** -> [reference/wecom.md](reference/wecom.md)
- **DingTalk** -> [reference/dingtalk.md](reference/dingtalk.md)
- **Lark** -> [reference/lark.md](reference/lark.md)

> WeChat and WeCom are completely separate platforms. Do not mix them up.
> WeChat uses QR authorization and does not require `bot_id` or `secret`.

## Default Flow

1. **Confirm the channel**: If the user did not specify one, ask which IM platform they want: WeChat, WeCom, DingTalk, or Lark.
2. **Read the reference**: Load the matching channel reference file.
3. **Collect credentials**: Follow the instructions in that reference. WeChat does not need credentials because it uses QR authorization.
4. **Establish the connection**: Run the `run_skills_snippet` code from the reference.
5. **Report the result**: If the connection succeeds, tell the user what to do next. If it fails, return the error and guide the next step.

## Notes

- After a connection is established, it keeps running in the background. Credentials are saved to `.magic/config/im-channels.json` and bound to the current sandbox. Restarting the same sandbox process should auto-reconnect without asking for setup again.
- To disable auto-reconnect for a channel, edit `.magic/config/im-channels.json` and set that channel's `enabled` field to `false`.
- All channels share the same Agent as the web session, so conversation history stays connected across surfaces.
- For WeChat, do not generate your own QR layout. Always use the mobile-width raw HTML template from the WeChat reference and paste the exact `{{QRCODE_JS_STRING_LITERAL}}` value returned by the tool.
- For WeChat, output the QR as raw HTML only. Do not wrap it in Markdown code fences and do not add extra prose before or after the HTML block.
