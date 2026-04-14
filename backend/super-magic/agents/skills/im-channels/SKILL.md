---
name: im-channels
description: Use when connecting or configuring IM channel bots (WeChat, WeCom, DingTalk, Lark), or when you receive a user message that contains an <im> block indicating it was sent from an IM channel — read this skill to understand what the context means and how to handle it correctly.
---

# IM Channels

This skill covers two scenarios: **connecting** an IM bot, and **understanding incoming messages** from IM channels.

---

## Scenario A: Incoming Message from an IM Channel

When a user message includes an `<im>` block at the end, the message was relayed from an IM platform. The block looks like this:

```xml
<!-- Text-only message -->
<im source="DingTalk" />

<!-- Message with media attachments -->
<im source="WeChat">
  <media>
    <file type="image" mime="image/jpeg" path="workspace/media/photo_001.jpg" />
    <file type="voice" mime="audio/silk" path="workspace/media/voice_001.silk" />
    <file type="image" mime="image/jpeg" path="workspace/media/photo_002.jpg" from="quoted" />
  </media>
</im>
```

### What each field means

- `source`: the IM platform — `WeChat`, `WeCom`, `DingTalk`, or `Lark`
- `<file>`: a file already downloaded into the workspace; use its `path` directly
- `type`: media category — `image`, `voice`, `video`, `file`, etc.
- `mime`: MIME type of the file
- `from="quoted"`: the file came from a message the user was replying to, not their current message

### How to respond

- Treat the user's text as the primary intent; the `<im>` block is metadata only
- For media files, read or process them using the `path` value — no download needed, files are already in the workspace
- Reply naturally; the IM platform handles formatting on delivery
- **Only the final reply is visible to the user.** IM channels replace intermediate content with the last message — do not rely on the user seeing earlier streamed output. Compose a complete, self-contained answer

---

## Scenario B: Connecting an IM Bot

Connect the current Agent to an IM platform so it can receive and send messages in the target app.

### Step 1 — Confirm the channel

If the user did not specify one, ask which IM platform they want: WeChat, WeCom, DingTalk, or Lark.

### Step 2 — Read the reference

Load the matching reference file for credentials and exact steps:

- **WeChat** (official ClawBot) → [reference/wechat.md](reference/wechat.md)
- **WeCom** → [reference/wecom.md](reference/wecom.md)
- **DingTalk** → [reference/dingtalk.md](reference/dingtalk.md)
- **Lark** → [reference/lark.md](reference/lark.md)

> WeChat and WeCom are completely separate platforms. Do not mix them up.
> WeChat uses QR authorization and does not require `bot_id` or `secret`.

### Step 3 — Collect credentials and connect

Follow the instructions in the reference file. Run the `run_sdk_snippet` code to establish the connection.

### Step 4 — Report the result

If the connection succeeds, tell the user what to do next. If it fails, return the error and guide the next step.

### Check Status

To inspect the current configuration and connection state of all IM channels, run:

```python
from sdk.tool import tool

result = tool.call("get_im_channel_status", {})
print(result.content)
```

### Notes

- After a connection is established, it keeps running in the background. Credentials are saved to `.magic/config/im-channels.json` and bound to the current sandbox. Restarting the same sandbox process should auto-reconnect without asking for setup again.
- To disable auto-reconnect for a channel, edit `.magic/config/im-channels.json` and set that channel's `enabled` field to `false`.
- All channels share the same Agent as the web session, so conversation history stays connected across surfaces.
- For WeChat, do not generate your own QR layout. The tool returns the exact markdown content to output — reply with it verbatim.
