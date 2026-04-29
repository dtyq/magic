---
name: user-info
description: >
  Use when you need the current user's identity or contact info: name, job title, employee number, email, phone, or department.
---

# User Info Skill

Retrieve the current session user's profile via `get_user_info`.

---

## Basic Usage

```python
from sdk.tool import tool

result = tool.call("get_user_info", {})
print(result.content)
```

Example output:

```
User: Zhang San. Position: Engineering Lead. Work Number: 10086. Email: zhang@example.com. Phone: 138****0000 (desensitized). Departments: Engineering, Architecture.
```

For structured access, use `result.data`:

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | User ID |
| `nickname` | string | Display name |
| `real_name` | string | Legal name |
| `work_number` | string | Employee number (may be empty) |
| `position` | string | Job title |
| `email` | string | Email address |
| `phone` | string | Phone, desensitized by default (e.g. `138****0000`) |
| `departments` | array | Each item: `{id, name, path}` |

---

## Getting the Full Phone Number

Phone is masked by default to protect privacy. To get the full number, you must first ask for explicit user consent.

**Step 1 — Ask for consent:**

```python
from sdk.tool import tool

result = tool.call("ask_user", {
    "questions": '<question type="confirm">I need your full phone number to proceed. Do you allow me to access it?</question>'
})
print(result.content)
```

**Step 2 — If the user consents, request the full number:**

```python
result = tool.call("get_user_info", {
    "include_sensitive_fields": ["phone"]
})
print(result.content)
```

**If the user declines:** use the desensitized value or drop the requirement. Do not ask again.

---

## Constraints

- Never pass `include_sensitive_fields` without prior explicit user approval in the same conversation.
- Do not retry after a user refuses access to sensitive fields.
- Use the desensitized phone value for display, logging, or non-critical tasks where the full number is not strictly needed.
