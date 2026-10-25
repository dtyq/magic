# Browser instances and tabs

Read [SKILL.md](../SKILL.md) first. Browser instances are concrete controllable runtimes. They may be Local, one of several Remote instances, or an authorized user Chrome connection.

## Tool signatures

```python
browser_list_instances()
browser_list_tabs(browser_id: str | None = None)
browser_new_tab(url: str = "about:blank", browser_id: str | None = None)
browser_select_instance(browser_id: str)
browser_select_tab(tab_id: str)
browser_activate_tab(tab_id: str | None = None)
browser_navigate(
    url: str,
    wait_until: "commit" | "domcontentloaded" | "load" | "networkidle" = "domcontentloaded",
    browser_id: str | None = None,
    tab_id: str | None = None,
)
browser_wait(..., tab_id: str | None = None)
browser_keep_alive(seconds: float, tab_id: str | None = None)
browser_close_tab(tab_id: str | None = None)
```

All ordinary reads, observations, interactions, screenshots, visual queries, and debugging tools use an optional `tab_id`. Omit it to use the AgentContext default Browser and Tab. A known `tab_id` already identifies its Browser; do not also provide `browser_id`.

`browser_new_tab` creates in the default Browser when `browser_id` is omitted. Passing `browser_id` chooses a concrete Local or Remote instance and makes the new tab the default after successful creation. `browser_navigate` may receive `browser_id` when it must create the first tab in a chosen instance, or `tab_id` when it must reuse a known tab. If both are supplied, they must belong to the same instance.

## Default routing

The AgentContext stores a default Browser and, when one exists, a default Tab. Omitting both targets uses that exact pair. It never means “choose any available Remote”. With multiple Remote instances, select an instance explicitly or use a Tab ID returned by Browser tools.

`browser_select_instance` changes the default Browser without bringing a tab to the user's foreground. `browser_select_tab` changes the default Browser and Tab to the owner of that Tab without bringing it to the foreground. `browser_activate_tab` changes the user's foreground when the backend supports it; it does not change the Agent default.

The first ordinary `browser_navigate` can create the configured default Browser and its first Tab. If the configured Browser is unavailable, report that state. Do not silently switch to another Browser.

## Discovering targets

Use `browser_list_instances` when the Browser instance is unknown or several Local/Remote connections may be relevant. Its content lists short Browser IDs such as `b1` and real connection states.

Use `browser_list_tabs` only when the target Tab is unknown. Omit `browser_id` to list the default Browser; pass a known `browser_id` to inspect another instance. The content and data use stable Tab IDs such as `t1`, not list positions.

Do not invent IDs. A closed, disconnected, or re-registered Browser or Tab may make an old short ID invalid; an invalid explicit target fails and does not fall back to the default.

## Multiple tabs

Keep the ordinary navigate/read/action path on one default tab. Create another only when the first page must be preserved:

```python
from sdk.tool import tool

first = tool.call("browser_navigate", {"url": "https://example.com/first"})
print(first.content)
if first.ok:
    first_tab_id = first.data["tab_id"]
    second = tool.call("browser_new_tab", {"url": "https://example.com/second"})
    print(second.content)
    if second.ok:
        print(tool.call("browser_read_page", {}).content)
        print(tool.call("browser_read_page", {"tab_id": first_tab_id}).content)
```

The Python variables above are valid only within this one code snippet. Across separate snippets, use the literal `tN` from earlier Browser content. Reading an explicit Tab does not change the default. A successful New Tab does.

Closing the default Tab selects a surviving Tab from the same Browser according to the existing lifecycle rules. If none remains, the Browser may remain with no default Tab; reads report that state and Navigate can create the next Tab. Closing a Tab never reuses its `tN`.

## Authorized user Chrome

Use `browser_list_instances` to find a connected user Chrome instance. If it is not listed as connected, ask the user to connect and authorize it through the product UI. Do not request connection tokens or endpoints.

After a user Chrome Tab is selected, operate it by its `tab_id`. Do not pass a Session UUID, Chrome native Tab ID, CDP Target ID, or endpoint to Browser tools.

## Page lifetime and capabilities

Normal operations renew sandbox page leases. Use `browser_keep_alive` only for a known long-running step. Read the selected instance capabilities before depending on screenshots, console, network, upload, or downloads.

When a wait fails, read its complete content and inspect the current Tab before retrying. A redirect, consent screen, CAPTCHA, or other intermediate page may have replaced the expected destination.
