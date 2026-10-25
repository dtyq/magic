# Lark AI Bot

Connects via Lark Long Connection (WebSocket) mode with streaming typing support.

## Prerequisites

Create an enterprise self-built app on the Lark Open Platform and obtain:
- **App ID**: The App ID from application credentials
- **App Secret**: The App Secret from application credentials

Complete the following configuration on the Lark Open Platform:
1. Event Subscription → Long Connection (WebSocket) → Enable long connection for receiving events
2. Event Subscription → Add Event → Search and add "Receive Messages v2.0 (im.message.receive_v1)"
3. App Permissions → Request and enable the message event permission, `im:message:readonly` (for reading merged forwards and downloading incoming attachments), and `cardkit:card` (for streaming replies)

## Receiving messages

Images, files, audio, video, rich text posts with multiple images or attachments, and merged forwards are supported. Enable `im:message:readonly`, publish the updated app version, and ensure the permission is effective. Missing message-read permission does not disable ordinary text messaging, but attachments and merged-forward details cannot be retrieved. Interactive card messages are not expanded; ask the user to resend that content as text or a supported attachment.

When Lark emits a merged-forward message and its forwarding note as adjacent callbacks, they are combined into one inbound message. The note is kept as plain text and forwarded attachments remain available to the agent.

## Credential Collection

Ask the user in sequence:
1. "Please provide the Lark app's App ID"
2. "Please provide the corresponding App Secret"

## Establish Connection

(Use run_sdk_snippet tool, python_code parameter:)

```
from sdk.tool import tool

result = tool.call("connect_lark_bot", {
    "app_id": "<App ID provided by user>",
    "app_secret": "<App Secret provided by user>",
})
print(result.content)
```

## Result Handling

- Success: "Lark bot connected successfully. You can now chat with me in Lark with streaming typing support."
- Failure: Report the error, suggest checking whether App ID/Secret are correct, and whether app permissions and event subscriptions have been configured
