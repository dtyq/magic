# WeChat Official ClawBot Connection

## Requirements

- Use the latest iOS version of WeChat. ClawBot is currently available on iOS only.
- No bot ID or secret is required. Login is completed fully through QR confirmation.

## Flow

1. Call the start tool to create the QR login session.
2. Relay the returned Markdown link to the user verbatim without changing the path.
3. Immediately call the wait tool and wait up to 60 seconds for the QR result.
4. If the login succeeds, tell the user to send `hi` in the WeChat ClawBot chat.
5. If the QR is not confirmed within 60 seconds, tell the user the request timed out and they need a new QR flow.

## Start Login

Use `run_skills_snippet` with this `python_code`:

```python
from sdk.tool import tool

result = tool.call("connect_wechat_bot", {})
print(result.content)
```

## Wait For Result

Call this only after you have relayed the Markdown link from the previous step:

```python
from sdk.tool import tool

result = tool.call("wait_wechat_login", {
    "timeout_seconds": 60
})
print(result.content)
```

## Check Status

Use `run_skills_snippet` with this `python_code`:

```python
from sdk.tool import tool

result = tool.call("get_im_channel_status", {})
print(result.content)
```

## Notes

- The QR page has a limited lifetime. If it expires, the same local HTML path is overwritten with a fresh QR.
- The local QR HTML file is deleted automatically after success, timeout, or failure.
- Each workspace can bind only one WeChat account.
- To restart the flow explicitly, call the start tool with `force_refresh: true`.
