# Projects

Skill projects are discovered with `list_skills` / `get_skill`, not the ordinary project list. Follow [Skills](skills.md) for creation, project references and publication.

`list_projects(keyword="", scope="owned", workspace_id=None, page=1, page_size=20, order_by="created_at", sort="desc")` lists one page. `keyword` searches project names; `workspace_id` limits the list to one exact product workspace. `scope="participated"` includes projects in which the current user participates and is ordered by that user's `last_active_at` descending. Its `order_by` and `sort` must stay at their defaults. For `scope="owned"`, `order_by` accepts `id`, `created_at`, or `updated_at`; `sort` accepts `asc` or `desc`. Creation, update, and personal activity are different time meanings. There is no server-side date-range filter or search of project contents.

Read `result.content` for names, IDs, workspace, available times, and pagination. For an exact time-window filter over a small set, read `result.data["items"]` and the relevant time field; see [data fields](data-schema.md). Continue only through pages needed for the user's request. If a complete answer needs more pages than can reasonably be checked, say which scope and pages were covered. `get_project(project_id)` reads one project's details; a list does not require a detail call for every item.

`create_project(workspace_id, name)` creates a project and an automatic default topic; the receipt includes the default topic ID. `update_project(project_id, name)` renames it. `move_project(project_id, target_workspace_id)` changes its product workspace classification; the project ID and files remain in that project. `delete_project(project_id)` uses the product's deletion behavior. Use exact IDs and check each write result before describing it as complete. These tools do not copy a whole project or pin one.

Project access does not imply access to another person's private topic messages. To inspect a project's topics, use `list_topics` as described in [topics](topics.md).
