# Workspaces

Product workspaces classify projects; they do not own project files or sandbox directories. Moving a project between workspaces changes its classification, not its project ID or file contents. Use `move_project` for that action.

Use `list_workspaces(keyword="", page=1, page_size=20)` to find workspaces. This is a read-only call; it does not create a workspace when the list is empty. Use `get_workspace(workspace_id)` for one exact ID.

For a requested change, use `create_workspace(name)`, `update_workspace(workspace_id, name)`, `archive_workspace(workspace_id, archived)`, or `delete_workspace(workspace_id)`. Workspace names must contain 1–50 characters. `archived=false` restores an archived workspace. Deletion follows the product's existing workspace deletion behavior; it is different from detaching projects.

IDs are exact decimal strings. An ambiguous name is not an ID. For all writes, inspect `result.content` and do not automatically repeat a request after a network timeout: the server may already have accepted it.

This tool set does not pin a workspace or detach its projects. Do not describe deletion as detachment.
