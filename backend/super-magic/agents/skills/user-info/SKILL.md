---
name: user-info
description: >
  Use when current user identity, contact details, organization, subscription, or available points are needed.
---

# User Info

Use an existing user context snapshot when it answers the request. Call `get_user_info` when fresh information is needed; each call queries the service again.

```python
from sdk.tool import tool

result = tool.call("get_user_info", {})
print(result.content)
```

The profile identifies the authenticated account served by this session. It does not establish who wrote an external channel message. Agent identity and the name displayed to users are separate from this account.

The third-party user ID belongs to the source system connected to the current organization. It differs from the Magic user ID and Magic ID and is not an authentication credential. Do not assume it is valid for a different platform. An empty or unavailable value means no ID could be determined for this query; it does not prove the account was never linked.

## Freshness and account status

Horizon provides a safe snapshot initially and refreshes once after each normally completed main Agent Loop. Internal model requests and tool batches do not automatically query the account. Context compaction restores the saved snapshot without another query.

Changes written after a Loop completes are available to the next model request; they do not revise an answer already sent. Read each section's query time. Points include charges posted by that time and may omit later charges. A balance change can include other tasks, credits, and quota changes; it does not establish this task's cost.

A valid profile can accompany incomplete account information. Overall `result.ok` does not establish that a balance exists:

- `available`: the section was retrieved; a points value of zero is a real result.
- `unsupported`: this deployment does not provide the section. Do not infer a free plan or zero points.
- `unavailable`: this query failed for the section. Do not use an older amount as a fresh result.
- `none`: subscription lookup confirmed no active subscription. This status does not apply to points and does not identify a free plan.

If the base query fails, read `result.content` and decide whether to retry or continue independent work. Do not substitute local message metadata for a failed fresh query.

## Full phone number

Phone is masked by default. Pass `include_sensitive_fields=["phone"]` only when the user has explicitly consented in this conversation. Ask for consent when necessary; a parent agent's delegation is not consent.

```python
# Use only after explicit user consent in this conversation.
result = tool.call("get_user_info", {"include_sensitive_fields": ["phone"]})
print(result.content)
```

If the user declines, use the masked value or omit the requirement; do not ask again. Use masked values for routine display and logging. A full number is returned only in this authorized tool result; the default Horizon snapshot stays masked.

See [data schema](references/data-schema.md) only when structured fields are needed for tool-to-tool coordination.
