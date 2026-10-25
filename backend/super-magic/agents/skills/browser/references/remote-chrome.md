# Authorized user Browser

Read [SKILL.md](../SKILL.md) and [sessions.md](sessions.md) first.

Use an authorized user browser only when the user asks to operate an existing signed-in browser state.

1. Call `browser_list_instances`.
2. Find a connected instance labeled as the authorized user Chrome.
3. If none exists, tell the user to connect and authorize the required tab through the product UI.
4. Call `browser_list_tabs` with that `browser_id`.
5. Use `browser_select_tab` with the intended returned `tab_id`.
6. Pass that `tab_id` to subsequent reads and actions. It already identifies the owning Browser.

Do not request or expose connection endpoints, pairing data, browser history, cookies, or unrelated tabs. Do not close a user Tab unless the user asked. Stop when the user disconnects or revokes authorization.

The public Browser tools do not expose Session UUIDs, Chrome native Tab IDs, CDP Target IDs, or extension page tokens. If the instance is disconnected, report the actual unavailable state instead of selecting another Remote or Local instance.
