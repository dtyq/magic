---
name: using-oauth2
description: Connect to a user-provided OAuth2 app, complete authorization, and use its access token in Code Mode HTTP requests.

---

# OAuth2 App Integration Skill

Use this skill when the user provides an OAuth2 application, OAuth2 documentation, or asks you to call an API that requires OAuth2 authorization.

OAuth2 app APIs are not registered as individual tools. The standard parts are obtaining a valid access token and,
when possible, sending the business HTTP request through the visible `oauth2_request` transport tool.
For unsupported cases, keep using `sdk.oauth2.get_access_token()` and write the HTTP request yourself in Code Mode
according to the provider's API docs.

## How it works

OAuth2 capabilities are exposed as Code Mode tools (`oauth2_*`). They are not directly callable as standalone tool calls. Invoke them through `run_sdk_snippet` and `sdk.tool.call`:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("oauth2_list_apps")
print(result.content)
""")
```

Business API calls should use `oauth2_request` when it supports the provider's request shape.
Minimal GET example:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("oauth2_request", {
    "app_name": "<app_name>",
    "method": "GET",
    "url": "<api_url>",
    "headers": {
        "Accept": "application/json",
    }
})
print(result.content)
""")
```

This creates a visible API request card for the user.

`oauth2_request` parameters:

| Parameter | Required | Meaning |
|-----------|----------|---------|
| `app_name` | Yes | Registered and authorized OAuth2 app name. |
| `method` | No | HTTP method: `GET`, `POST`, `PUT`, `PATCH`, or `DELETE`. Defaults to `GET`. |
| `url` | Yes | Business API URL from the provider docs. |
| `headers` | No | Business headers only. Do not include OAuth2 credential headers. |
| `query` | No | URL query parameters. |
| `json_body` | No | JSON request body. Mutually exclusive with `form_body`. |
| `form_body` | No | Form request body. Mutually exclusive with `json_body`. |
| `auth` | No | Access token injection settings. Defaults to `Authorization: Bearer <access_token>`. |
| `timeout` | No | HTTP timeout in seconds. Defaults to `30`, maximum `120`. |

`oauth2_request` returns structured data in `result.data`. Important fields include:

| Return field | Meaning |
|--------------|---------|
| `status_code` | HTTP response status code. |
| `request_duration_ms` | Business HTTP request duration in milliseconds. |
| `body_text` | Response body text, truncated when it is too large. |
| `request_headers` | Redacted request headers. |
| `response_headers` | Redacted response headers. |

Full `oauth2_request` parameter template:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("oauth2_request", {
    # Required: the registered and authorized OAuth2 app name.
    "app_name": "<app_name>",

    # Optional: GET, POST, PUT, PATCH, or DELETE. Defaults to GET.
    "method": "POST",

    # Required: business API URL from the provider docs.
    "url": "<api_url_from_provider_docs>",

    # Optional: business headers only. Do not include Authorization, Access-Token, or token headers.
    "headers": {
        "Accept": "application/json",
        "Content-Type": "application/json",
    },

    # Optional: URL query parameters.
    "query": {
        "page": 1,
        "page_size": 20,
    },

    # Optional: JSON request body. Mutually exclusive with form_body.
    "json_body": {
        "name": "<value>",
    },

    # Optional: token injection settings. Omit this for Authorization: Bearer <access_token>.
    # Use type=header for providers that require headers such as Access-Token.
    "auth": {
        "type": "bearer",
        "header_name": "Authorization",
        "prefix": "Bearer ",
    },

    # Optional: HTTP timeout in seconds. Maximum 120. Defaults to 30.
    "timeout": 30,
})
print(result.content)
print("request_duration_ms:", result.data.get("request_duration_ms"))
""")
```

Form body variant:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("oauth2_request", {
    "app_name": "<app_name>",
    "method": "POST",
    "url": "<api_url_from_provider_docs>",
    "headers": {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
    },
    "form_body": {
        "field": "<value>",
    },
    "auth": {
        "type": "header",
        "header_name": "Access-Token",
        "prefix": "",
    },
    "timeout": 30,
})
print(result.content)
print("request_duration_ms:", result.data.get("request_duration_ms"))
""")
```

If `oauth2_request` cannot express the provider-specific request, use `run_python_snippet` and fall back to
`sdk.oauth2.get_access_token()`. This keeps the request output visible to the user. Do not print the access token.

## Available OAuth2 tools

| Tool name | Purpose |
|-----------|---------|
| `oauth2_list_apps` | List registered OAuth2 apps and current authorization status. Start here. |
| `oauth2_upsert_app` | Register or update a user-provided OAuth2 app definition. |
| `oauth2_get_redirect_uri` | Get the redirect URI only when the user explicitly asks for it. |
| `oauth2_remove_app` | Remove one or more OAuth2 apps and their stored authorization data. |
| `oauth2_start_authorization` | Generate an authorization URL, create a pending session, and start background authorization checking. |
| `oauth2_check_authorization` | Idempotently check authorization status when confirmation or recovery is needed. |
| `oauth2_request` | Send a visible OAuth2 HTTP request for business APIs. Prefer this when supported. |
| `oauth2_list_api_docs` | Search the recorded API documentation library for this OAuth2 app. |
| `oauth2_get_api_doc` | Load one recorded OpenAPI operation by `operation_id`. |
| `oauth2_upsert_api_doc` | Create or update one recorded OpenAPI operation after user confirmation. |
| `oauth2_remove_api_doc` | Remove one or more recorded OpenAPI operations under one app by `operation_ids`. |

## Standard workflow

1. List apps.

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

apps = tool.call("oauth2_list_apps")
print(apps.content)
""")
```

2. Register the app if needed.

Use only values from the user or provider docs. Put secrets behind `${ENV_NAME}` when possible.
After `oauth2_upsert_app` succeeds, read `result.content` and tell the user the returned redirect URI.
If the OAuth2 provider requires a redirect URI or allowlist entry, ask the user to configure
exactly that URL in the provider's app settings before starting authorization.

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("oauth2_upsert_app", {
    "app_name": "<stable_app_name>",
    "label_name": "<human_readable_name>",
    "authorization_url": "<authorization_endpoint>",
    "token_url": "<token_endpoint>",
    "client_id": "<client_id>",
    "client_secret": "${OAUTH2_CLIENT_SECRET}",
    "scope": "<scope string>",
    "token_auth_method": "client_secret_post"
})
print(result.content)
""")
```

Do not invent or rewrite the redirect URI. Use the URI returned by `oauth2_upsert_app`.

3. Start authorization after the redirect URI is configured, or after the user confirms the provider does not require
pre-configuring one.

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

auth = tool.call("oauth2_start_authorization", {
    "app_name": "<stable_app_name>"
})
print(auth.content)
""")
```

Ask the user to open the authorization URL and complete authorization. After the provider redirects back with a code,
super-magic checks the callback in the background and exchanges the code for tokens automatically while the pending
session is still valid.

4. Check authorization only when needed.

The background checker normally completes token exchange after the callback arrives. This manual check is idempotent:
if the callback was already consumed and the credential was saved, it returns `authorized` instead of failing. Use it
when you need to confirm the status, recover after process restart, or handle a pending/expired result explicitly.

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

status = tool.call("oauth2_check_authorization", {
    "app_name": "<stable_app_name>"
})
print(status.content)
""")
```

If the status is `authorization_pending`, wait for the user to finish authorization. The background checker will keep
polling while the pending session is valid, and you can call `oauth2_check_authorization` again if you need a visible
status update.

5. Call the business API.

Before making a business API request, search the recorded interface documentation library for the target app and capability:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

docs = tool.call("oauth2_list_api_docs", {
    "app_name": "<stable_app_name>",
    "query": "<capability_or_endpoint_keyword>",
    "method": "GET",
    "limit": 10,
})
print(docs.content)
""")
```

If a matching document exists, load it before building the request:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

doc = tool.call("oauth2_get_api_doc", {
    "app_name": "<stable_app_name>",
    "operation_id": "<operation_id_from_list>",
})
print(doc.content)
print(doc.data)
""")
```

If no matching document exists, use the user's provider docs for the current request. After the request succeeds,
call `ask_user` as a normal tool outside Code Mode and ask whether to record this interface documentation for future
calls. Only call `oauth2_upsert_api_doc` if the user agrees.

For a simple GET request:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("oauth2_request", {
    "app_name": "<stable_app_name>",
    "method": "GET",
    "url": "<api_url_from_provider_docs>",
    "headers": {
        "Accept": "application/json",
    }
})
print(result.content)
print("request_duration_ms:", result.data.get("request_duration_ms"))
""")
```

For requests with query parameters, body, custom token header, or timeout:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

result = tool.call("oauth2_request", {
    "app_name": "<stable_app_name>",
    "method": "POST",
    "url": "<api_url_from_provider_docs>",
    "headers": {
        "Accept": "application/json",
        "Content-Type": "application/json",
    },
    "query": {
        "<query_name>": "<query_value>",
    },
    "json_body": {
        "<field_name>": "<field_value>",
    },
    "auth": {
        "type": "bearer",
        "header_name": "Authorization",
        "prefix": "Bearer ",
    },
    "timeout": 30,
})
print(result.content)
print("request_duration_ms:", result.data.get("request_duration_ms"))
""")
```

Use `form_body` instead of `json_body` for form requests. Never pass both.

Fallback for unsupported request shapes. Use `run_python_snippet` so the terminal result is visible to the user:

```python
run_python_snippet(
    purpose="Call API",
    timeout=60,
    python_code="""
import json
import urllib.request
from sdk.oauth2 import get_access_token

access_token = get_access_token("<stable_app_name>")

request = urllib.request.Request(
    "<api_url_from_provider_docs>",
    headers={
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    },
    method="GET",
)

with urllib.request.urlopen(request, timeout=30) as response:
    payload = json.loads(response.read().decode("utf-8"))

print(json.dumps(payload, ensure_ascii=False, indent=2))
"""
)
```

6. Record the interface documentation only after the user agrees.

Do not store tokens, authorization codes, client secrets, raw personal response bodies, or raw sensitive user data.
Store stable API shape, request rules, response schema, source references, and reusable `oauth2_request` parameters.

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

saved = tool.call("oauth2_upsert_api_doc", {
    "app_name": "<stable_app_name>",
    "method": "GET",
    "url": "<api_url_from_provider_docs>",
    "path": "<openapi_path>",
    "operation_id": "<stable_operation_id>",
    "summary": "<short_capability_summary>",
    "description": "<when_to_use_this_endpoint>",
    "tags": ["<provider_or_domain_tag>"],
    "headers": {
        "Accept": {
            "description": "Expected response content type.",
            "schema": {
                "type": "string"
            }
        }
    },
    "query_schema": {
        "<query_name>": {
            "description": "<query_description>",
            "required": False,
            "schema": {
                "type": "string"
            }
        }
    },
    "request_body_schema": {
        "type": "object",
        "properties": {}
    },
    "response_status_code": "200",
    "response_description": "Successful response.",
    "response_schema": {
        "type": "object",
        "properties": {}
    },
    "source_refs": ["<provider_doc_url_or_user_doc_reference>"],
    "example_tool_call": {
        "app_name": "<stable_app_name>",
        "method": "GET",
        "url": "<api_url_from_provider_docs>",
        "headers": {
            "Accept": "application/json"
        },
        "timeout": 30
    },
    "notes": "<provider_specific_notes_without_sensitive_values>",
    "verified": True,
})
print(saved.content)
""")
```

Batch delete recorded API documentation:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

removed = tool.call("oauth2_remove_api_doc", {
    "app_name": "<stable_app_name>",
    "operation_ids": ["<operation_id_1>", "<operation_id_2>"],
})
print(removed.content)
""")
```

`oauth2_remove_api_doc` only removes API documentation under one OAuth2 app per call.
If you need to delete API documentation from multiple apps, call it once per app.

Batch remove OAuth2 apps:

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

removed = tool.call("oauth2_remove_app", {
    "app_names": ["<stable_app_name_1>", "<stable_app_name_2>"],
})
print(removed.content)
""")
```

Batch fields must be arrays. Do not pass JSON array strings or comma-separated strings.

## Rules

1. Never invent OAuth2 endpoints, scopes, header names, or business API parameters. Use the user's app docs or ask for the missing field.
2. Never print access tokens, refresh tokens, authorization codes, client secrets, or raw state values.
3. Do not create business API tools such as `oauth2_call_api`. Write the HTTP request in Code Mode.
4. `Authorization: Bearer <token>` is common, but not universal. Use the provider's docs for the final business API header. Some providers use headers such as `Access-Token`.
5. If `get_access_token()` raises `OAuth2AuthorizationRequired`, show the authorization URL and ask the user to complete authorization.
6. If refresh fails, ask the user to reauthorize the app.
7. After `oauth2_upsert_app`, always surface the returned redirect URI to the user when provider-side redirect URI
   configuration may be required.
8. Do not call `oauth2_get_redirect_uri` during the normal workflow. Call it only when the user explicitly asks for
   the redirect URI or allowlist value.
9. Prefer `oauth2_request` for business API calls so users can see the API request card. Keep `get_access_token()`
   as fallback when `oauth2_request` does not support the provider-specific request.
10. Do not pass `Authorization`, `Access-Token`, or equivalent OAuth2 credential headers to `oauth2_request`;
    it injects the access token itself.
11. Use `run_python_snippet` for fallback business API requests that call `sdk.oauth2.get_access_token()`, because
    its terminal detail is visible to the user. Do not use `sdk.tool.call` inside `run_python_snippet`.
12. Before each business API call, search `oauth2_list_api_docs` for the target app and endpoint/capability. Use
    `oauth2_get_api_doc` when there is a matching recorded operation.
13. If a business API call succeeds and the interface documentation was not already recorded, call `ask_user` outside
    Code Mode to ask whether to save it for future use. Only save it with `oauth2_upsert_api_doc` after the user agrees.
14. Interface documentation is stored as OpenAPI operation data. Record API shape and reusable call rules, not raw
    tokens, authorization codes, client secrets, or raw personal response bodies.

## Explicit Redirect URI Lookup

Use this only when the user explicitly asks what redirect URI or allowlist value should be configured.

```python
run_sdk_snippet(python_code="""
from sdk.tool import tool

redirect = tool.call("oauth2_get_redirect_uri")
print(redirect.content)
""")
```
