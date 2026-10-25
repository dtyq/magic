# Topics

`list_topics(project_id, keyword="", order_by="created_at", page=1, page_size=20)` lists one project's topics visible to the current user. With default arguments it uses the ordinary creation-order list. A nonempty `keyword` searches topic names; `order_by="updated_at"` finds recently updated topics. Either option uses the product's sidebar search, which sorts by update time and reports at most 999 matches. When it reaches that cap, more topics may exist even if the last reported page has no next page. Name search does not search message text. Read [data fields](data-schema.md) when filtering a bounded page by `updated_at`.

`get_topic(topic_id)` reads one exact topic. Resolve ambiguous names with its project and ID. `create_topic(project_id, name)` creates a topic under a project; it does not start an Agent task. `update_topic(topic_id, name)` renames it. `archive_topic(topic_id, archived)` archives or restores it; `delete_topic(topic_id)` uses the product's logical deletion behavior. These tools do not copy or pin topics.

Topic messages belong to the topic, not to a separate project file tree. Use [messages](messages.md) to read them. Project collaboration does not grant broader message access than the message endpoint permits.
