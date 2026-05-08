-- name: ListSourceBindingIDsByKnowledgeBase :many
SELECT id
FROM knowledge_source_bindings
WHERE knowledge_base_code = ?
ORDER BY id ASC;

-- name: ListProjectSourceBindingIDsByKnowledgeBase :many
SELECT id
FROM knowledge_source_bindings
WHERE knowledge_base_code = ?
  AND provider = 'project'
ORDER BY id ASC;

-- name: ListProjectSourceBindingIDsByKnowledgeBaseAndProject :many
SELECT id
FROM knowledge_source_bindings
WHERE knowledge_base_code = ?
  AND provider = 'project'
  AND root_type = 'project'
  AND root_ref = ?
ORDER BY id ASC;

-- name: ListProjectSourceBindingIDsByOrganization :many
SELECT id
FROM knowledge_source_bindings
WHERE organization_code = ?
  AND provider = 'project'
  AND root_type = 'project'
ORDER BY id ASC;

-- name: DeleteSourceBindingTargetsByBindingIDs :execrows
DELETE FROM knowledge_source_binding_targets
WHERE binding_id IN (sqlc.slice(binding_ids));

-- name: DeleteSourceBindingItemsByBindingIDs :execrows
DELETE FROM knowledge_source_binding_items
WHERE binding_id IN (sqlc.slice(binding_ids));

-- name: DeleteSourceBindingsByBindingIDs :execrows
DELETE FROM knowledge_source_bindings
WHERE id IN (sqlc.slice(binding_ids));

-- Join delete is intentional here. Keep this cleanup in sqlc so concurrent
-- knowledge-base replacement/destruction cannot regress back to "list IDs then
-- delete" and reopen the cross-transaction leak window.
-- name: DeleteSourceBindingTargetsByKnowledgeBase :execrows
DELETE knowledge_source_binding_targets
FROM knowledge_source_binding_targets
INNER JOIN knowledge_source_bindings
    ON knowledge_source_bindings.id = knowledge_source_binding_targets.binding_id
WHERE knowledge_source_bindings.knowledge_base_code = ?;

-- Join delete is intentional here. Keep this cleanup in sqlc so concurrent
-- knowledge-base replacement/destruction cannot regress back to "list IDs then
-- delete" and reopen the cross-transaction leak window.
-- name: DeleteSourceBindingItemsByKnowledgeBase :execrows
DELETE knowledge_source_binding_items
FROM knowledge_source_binding_items
INNER JOIN knowledge_source_bindings
    ON knowledge_source_bindings.id = knowledge_source_binding_items.binding_id
WHERE knowledge_source_bindings.knowledge_base_code = ?;

-- Join delete is intentional here. Keep this cleanup in sqlc and do not
-- replace it with ad hoc SQL assembly in Go.
-- name: DeleteSourceBindingsByKnowledgeBase :execrows
DELETE FROM knowledge_source_bindings
WHERE knowledge_base_code = ?;

-- name: InsertKnowledgeSourceBinding :execresult
INSERT INTO knowledge_source_bindings (
    organization_code, knowledge_base_code, provider, root_type, root_ref, sync_mode, sync_config,
    enabled, created_uid, updated_uid, created_at, updated_at
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
);

-- name: UpdateKnowledgeSourceBindingByID :execrows
UPDATE knowledge_source_bindings
SET provider = ?,
    root_type = ?,
    root_ref = ?,
    sync_mode = ?,
    sync_config = ?,
    enabled = ?,
    updated_uid = ?,
    updated_at = ?
WHERE id = ?;

-- name: UpsertKnowledgeSourceBinding :execrows
INSERT INTO knowledge_source_bindings (
    organization_code, knowledge_base_code, provider, root_type, root_ref, sync_mode, sync_config,
    enabled, created_uid, updated_uid, created_at, updated_at
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)
ON DUPLICATE KEY UPDATE
    sync_mode = VALUES(sync_mode),
    sync_config = VALUES(sync_config),
    enabled = VALUES(enabled),
    updated_uid = VALUES(updated_uid),
    updated_at = VALUES(updated_at);

-- name: UpsertKnowledgeSourceBindingsBatch2 :execrows
INSERT INTO knowledge_source_bindings (
    organization_code, knowledge_base_code, provider, root_type, root_ref, sync_mode, sync_config,
    enabled, created_uid, updated_uid, created_at, updated_at
) VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
    sync_mode = VALUES(sync_mode),
    sync_config = VALUES(sync_config),
    enabled = VALUES(enabled),
    updated_uid = VALUES(updated_uid),
    updated_at = VALUES(updated_at);

-- name: UpsertKnowledgeSourceBindingsBatch3 :execrows
INSERT INTO knowledge_source_bindings (
    organization_code, knowledge_base_code, provider, root_type, root_ref, sync_mode, sync_config,
    enabled, created_uid, updated_uid, created_at, updated_at
) VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
    sync_mode = VALUES(sync_mode),
    sync_config = VALUES(sync_config),
    enabled = VALUES(enabled),
    updated_uid = VALUES(updated_uid),
    updated_at = VALUES(updated_at);

-- name: UpsertKnowledgeSourceBindingsBatch4 :execrows
INSERT INTO knowledge_source_bindings (
    organization_code, knowledge_base_code, provider, root_type, root_ref, sync_mode, sync_config,
    enabled, created_uid, updated_uid, created_at, updated_at
) VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
    sync_mode = VALUES(sync_mode),
    sync_config = VALUES(sync_config),
    enabled = VALUES(enabled),
    updated_uid = VALUES(updated_uid),
    updated_at = VALUES(updated_at);

-- name: InsertKnowledgeSourceBindingTarget :exec
INSERT INTO knowledge_source_binding_targets (
    binding_id, target_type, target_ref, created_at, updated_at
) VALUES (
    ?, ?, ?, ?, ?
);

-- name: InsertKnowledgeSourceBindingTargetsBatch2 :execrows
INSERT INTO knowledge_source_binding_targets (
    binding_id, target_type, target_ref, created_at, updated_at
) VALUES
    (?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?);

-- name: InsertKnowledgeSourceBindingTargetsBatch3 :execrows
INSERT INTO knowledge_source_binding_targets (
    binding_id, target_type, target_ref, created_at, updated_at
) VALUES
    (?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?);

-- name: InsertKnowledgeSourceBindingTargetsBatch4 :execrows
INSERT INTO knowledge_source_binding_targets (
    binding_id, target_type, target_ref, created_at, updated_at
) VALUES
    (?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?);

-- name: ListKnowledgeSourceBindingsCoreByKnowledgeBase :many
SELECT knowledge_source_bindings.*
FROM knowledge_source_bindings
WHERE knowledge_base_code = ?
ORDER BY id ASC;

-- name: ListKnowledgeSourceBindingsCoreByKnowledgeBases :many
SELECT knowledge_source_bindings.*
FROM knowledge_source_bindings
WHERE knowledge_base_code IN (sqlc.slice(knowledge_base_codes))
ORDER BY knowledge_base_code ASC, id ASC;

-- name: ListKnowledgeSourceBindingsCoreByIDs :many
SELECT knowledge_source_bindings.*
FROM knowledge_source_bindings
WHERE id IN (sqlc.slice(ids))
ORDER BY id ASC;

-- name: ListRealtimeKnowledgeSourceBindingsCoreByIDsAndProvider :many
SELECT knowledge_source_bindings.*
FROM knowledge_source_bindings
WHERE id IN (sqlc.slice(ids))
  AND organization_code = ?
  AND provider = ?
  AND sync_mode = 'realtime'
  AND enabled = TRUE
ORDER BY id ASC;

-- name: ListRealtimeProjectSourceBindingsCoreByProject :many
SELECT knowledge_source_bindings.*
FROM knowledge_source_bindings
WHERE organization_code = ?
  AND provider = 'project'
  AND root_type = 'project'
  AND root_ref = ?
  AND sync_mode = 'realtime'
  AND enabled = TRUE
ORDER BY id ASC;

-- name: ListRealtimeTeamshareSourceBindingsCoreByKnowledgeBase :many
SELECT knowledge_source_bindings.*
FROM knowledge_source_bindings
WHERE organization_code = ?
  AND provider = ?
  AND root_type = 'knowledge_base'
  AND root_ref = ?
  AND sync_mode = 'realtime'
  AND enabled = TRUE
ORDER BY id ASC;

-- name: ListSourceBindingLookupsByIDs :many
SELECT id, provider, root_ref
FROM knowledge_source_bindings
WHERE id IN (sqlc.slice(ids))
ORDER BY id ASC;

-- name: ListSourceBindingOrganizationsByIDs :many
SELECT DISTINCT organization_code
FROM knowledge_source_bindings
WHERE id IN (sqlc.slice(ids))
ORDER BY organization_code ASC;

-- name: ListKnowledgeSourceBindingTargetsByBindingIDs :many
SELECT knowledge_source_binding_targets.*
FROM knowledge_source_binding_targets
WHERE binding_id IN (sqlc.slice(binding_ids))
ORDER BY binding_id ASC, id ASC;

-- name: UpsertKnowledgeSourceItem :execresult
INSERT INTO knowledge_source_items (
    organization_code, provider, root_type, root_ref, group_ref, item_type, item_ref,
    display_name, extension, content_hash, snapshot_meta, last_resolved_at, created_at, updated_at
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)
ON DUPLICATE KEY UPDATE
    root_type = VALUES(root_type),
    root_ref = VALUES(root_ref),
    group_ref = VALUES(group_ref),
    item_type = VALUES(item_type),
    display_name = VALUES(display_name),
    extension = VALUES(extension),
    content_hash = VALUES(content_hash),
    snapshot_meta = VALUES(snapshot_meta),
    last_resolved_at = VALUES(last_resolved_at),
    updated_at = VALUES(updated_at),
    id = LAST_INSERT_ID(id);

-- name: UpsertKnowledgeSourceItemsBatch2 :execrows
INSERT INTO knowledge_source_items (
    organization_code, provider, root_type, root_ref, group_ref, item_type, item_ref,
    display_name, extension, content_hash, snapshot_meta, last_resolved_at, created_at, updated_at
) VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
    root_type = VALUES(root_type),
    root_ref = VALUES(root_ref),
    group_ref = VALUES(group_ref),
    item_type = VALUES(item_type),
    display_name = VALUES(display_name),
    extension = VALUES(extension),
    content_hash = VALUES(content_hash),
    snapshot_meta = VALUES(snapshot_meta),
    last_resolved_at = VALUES(last_resolved_at),
    updated_at = VALUES(updated_at);

-- name: UpsertKnowledgeSourceItemsBatch3 :execrows
INSERT INTO knowledge_source_items (
    organization_code, provider, root_type, root_ref, group_ref, item_type, item_ref,
    display_name, extension, content_hash, snapshot_meta, last_resolved_at, created_at, updated_at
) VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
    root_type = VALUES(root_type),
    root_ref = VALUES(root_ref),
    group_ref = VALUES(group_ref),
    item_type = VALUES(item_type),
    display_name = VALUES(display_name),
    extension = VALUES(extension),
    content_hash = VALUES(content_hash),
    snapshot_meta = VALUES(snapshot_meta),
    last_resolved_at = VALUES(last_resolved_at),
    updated_at = VALUES(updated_at);

-- name: UpsertKnowledgeSourceItemsBatch4 :execrows
INSERT INTO knowledge_source_items (
    organization_code, provider, root_type, root_ref, group_ref, item_type, item_ref,
    display_name, extension, content_hash, snapshot_meta, last_resolved_at, created_at, updated_at
) VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
    root_type = VALUES(root_type),
    root_ref = VALUES(root_ref),
    group_ref = VALUES(group_ref),
    item_type = VALUES(item_type),
    display_name = VALUES(display_name),
    extension = VALUES(extension),
    content_hash = VALUES(content_hash),
    snapshot_meta = VALUES(snapshot_meta),
    last_resolved_at = VALUES(last_resolved_at),
    updated_at = VALUES(updated_at);

-- name: DeleteSourceBindingItemsByBinding :execrows
DELETE FROM knowledge_source_binding_items
WHERE binding_id = ?;

-- name: DeleteSourceBindingTargetsByBinding :execrows
DELETE FROM knowledge_source_binding_targets
WHERE binding_id = ?;

-- name: InsertKnowledgeSourceBindingItem :exec
INSERT INTO knowledge_source_binding_items (
    binding_id, source_item_id, resolve_reason, last_resolved_at, created_at, updated_at
) VALUES (
    ?, ?, ?, ?, ?, ?
);

-- name: InsertKnowledgeSourceBindingItemsBatch2 :execrows
INSERT INTO knowledge_source_binding_items (
    binding_id, source_item_id, resolve_reason, last_resolved_at, created_at, updated_at
) VALUES
    (?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?);

-- name: InsertKnowledgeSourceBindingItemsBatch3 :execrows
INSERT INTO knowledge_source_binding_items (
    binding_id, source_item_id, resolve_reason, last_resolved_at, created_at, updated_at
) VALUES
    (?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?);

-- name: InsertKnowledgeSourceBindingItemsBatch4 :execrows
INSERT INTO knowledge_source_binding_items (
    binding_id, source_item_id, resolve_reason, last_resolved_at, created_at, updated_at
) VALUES
    (?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?),
    (?, ?, ?, ?, ?, ?);

-- name: ListKnowledgeSourceBindingItemsByBindingIDs :many
SELECT knowledge_source_binding_items.*
FROM knowledge_source_binding_items
WHERE binding_id IN (sqlc.slice(binding_ids))
ORDER BY binding_id ASC, id ASC;

-- name: ListSourceItemIDsByProviderAndItemRef :many
SELECT id
FROM knowledge_source_items
WHERE provider = ?
  AND item_ref = ?
ORDER BY id ASC;

-- name: ListSourceItemIDsByOrganizationAndProviderAndItemRef :many
SELECT id
FROM knowledge_source_items
WHERE organization_code = ?
  AND provider = ?
  AND item_ref = ?
ORDER BY id ASC;

-- name: ListKnowledgeSourceItemsByOrganizationAndProviderAndItemRefs :many
SELECT *
FROM knowledge_source_items
WHERE organization_code = sqlc.arg(organization_code)
  AND provider = sqlc.arg(provider)
  AND item_ref IN (sqlc.slice(item_refs))
ORDER BY id ASC;

-- name: ListSourceItemLookupsByIDs :many
SELECT id, item_ref
FROM knowledge_source_items
WHERE id IN (sqlc.slice(ids))
ORDER BY id ASC;
