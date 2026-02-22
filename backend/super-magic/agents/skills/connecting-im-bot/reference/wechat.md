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
<div style="width:100%;max-width:340px;margin:0 auto;padding:16px 12px;box-sizing:border-box;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="font-size:15px;font-weight:600;color:#111;">连接 MagiClaw 到微信</div>
  <div style="font-size:28px;line-height:1;margin:10px 0 12px;">🦞</div>
  <div style="font-size:12px;line-height:1.5;color:#666;margin-bottom:12px;">请使用微信扫一扫连接 MagiClaw</div>
  <div style="display:inline-block;padding:12px;border-radius:18px;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.06);">
    <div style="width:220px;height:220px;margin:0 auto;"></div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <script>
      new QRCode(document.currentScript.previousElementSibling,{
        text: {{QRCODE_JS_STRING_LITERAL}},
        width: 220,
        height: 220,
        colorDark: "#111111",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
    </script>
  </div>
</div>
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
    "timeout_seconds": 60
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

## Notes

- The QR has a limited lifetime. When it expires, the wait tool returns a fresh QR payload that must be rendered again with the same HTML template.
- The tool returns an exact JavaScript string literal on purpose. Paste it directly into `{{QRCODE_JS_STRING_LITERAL}}` instead of escaping the QR data yourself.
- Each workspace can bind only one WeChat account.
- To restart the flow explicitly, call the start tool with `force_refresh: true`.
