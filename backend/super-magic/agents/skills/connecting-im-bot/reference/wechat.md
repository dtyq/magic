# WeChat Official ClawBot Connection

## Requirements

- Use the latest iOS version of WeChat. ClawBot is currently available on iOS only.
- No bot ID or secret is required. Login is completed fully through QR confirmation.

## Flow

1. Call the start tool to create the QR login session.
2. Use the mobile-width HTML template below.
3. Replace `{{QRCODE_JS_STRING_LITERAL}}` with the exact JavaScript string literal returned by the tool.
4. Reply to the user with exactly one `html` fenced code block and do not add extra prose before or after it.
5. Immediately call the wait tool and keep following its instructions until it returns success, timeout, or failure.

## Mobile HTML Template

Reply with exactly this `html` fenced code block, except for replacing `{{QRCODE_JS_STRING_LITERAL}}`:

```html
<div style="height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:sans-serif"><div style="font-size:14px;color:#666">请使用微信扫一扫</div><div style="font-size:20px;font-weight:600;margin:8px 0 24px">将 🦞 MagiClaw 连接到微信</div><div style="width:80%;max-width:320px;aspect-ratio:1;padding:16px;background:#fff;border-radius:16px;box-shadow:0 0 0 1px #0001,0 16px 32px #0001"><div id="q" style="width:100%;height:100%"></div></div></div><style>body{margin:0}#q img,#q canvas{width:100%!important;height:100%!important}</style><script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script><script>new QRCode(q,{text:{{QRCODE_JS_STRING_LITERAL}},width:512,height:512,colorDark:"#111",colorLight:"#fff"})</script>
```

## Start Login

Use `run_skills_snippet` with this `python_code`:

```python
from sdk.tool import tool

result = tool.call("connect_wechat_bot", {})
print(result.content)
```

After the tool returns:

1. Read the exact `{{QRCODE_JS_STRING_LITERAL}}` value from the tool output.
2. Substitute it into the HTML template.
3. Send the rendered `html` fenced code block to the user.

## Wait For Result

Call this only after you have rendered the QR HTML from the previous step:

```python
from sdk.tool import tool

result = tool.call("wait_wechat_login", {
    "timeout_seconds": 300
})
print(result.content)
```

Interpret the wait tool result like this:

- If it returns a fresh `{{QRCODE_JS_STRING_LITERAL}}`, render the same HTML template again with the new value, send the `html` fenced code block again, and immediately call `wait_wechat_login` again.
- If it returns a success message, tell the user to send `hi` in the WeChat ClawBot chat.
- If it returns a timeout or failure message, relay it and stop.

## Check Status

Use `run_skills_snippet` with this `python_code`:

```python
from sdk.tool import tool

result = tool.call("get_im_channel_status", {})
print(result.content)
```

## Reply Format After Connection

Write your reply in **Markdown** (GitHub-Flavored). Do not call any tool to send the reply.

To send an image or video, embed it directly in your reply:

| Type | Syntax |
|------|--------|
| Image | `![description](path)` |
| Image (HTML) | `<img src="path">` |
| Video | `<video src="path"></video>` |

Path values — prefer **workspace-relative paths** (relative to the `.workspace` directory):

```
charts/output.png          ← workspace-relative (recommended)
uploads/report.pdf
```

Absolute paths and remote URLs also work:

```
/absolute/path/to/file.jpg
https://example.com/image.png
```

Example reply with an image:

```
Here is the chart:

![monthly trend](charts/trend.png)

Let me know if you need any adjustments.
```

- Do not put media references inside fenced code blocks.

## Notes

- The QR has a limited lifetime. When it expires, the wait tool returns a fresh QR payload that must be rendered again with the same HTML template.
- The tool returns an exact JavaScript string literal on purpose. Paste it directly into `{{QRCODE_JS_STRING_LITERAL}}` instead of escaping the QR data yourself.
- Each workspace can bind only one WeChat account.
- To restart the flow explicitly, call the start tool with `force_refresh: true`.
