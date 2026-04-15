-- name: DeleteSourceBindingTargetsByKnowledgeBase :execrows
DELETE t
FROM knowledge_source_bindings b
STRAIGHT_JOIN knowledge_source_binding_targets t ON t.binding_id = b.id
WHERE b.knowledge_base_code = ?;

-- name: DeleteSourceBindingItemsByKnowledgeBase :execrows
DELETE FROM knowledge_source_binding_items
WHERE binding_id IN (
    SELECT id FROM knowledge_source_bindings WHERE knowledge_base_code = ?
);

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

-- name: InsertKnowledgeSourceBindingTarget :exec
INSERT INTO knowledge_source_binding_targets (
    binding_id, target_type, target_ref, created_at, updated_at
) VALUES (
    ?, ?, ?, ?, ?
);

-- name: ListKnowledgeSourceBindingsByKnowledgeBase :many
SELECT
    b.id, b.organization_code, b.knowledge_base_code, b.provider, b.root_type, b.root_ref, b.sync_mode,
    COALESCE(b.sync_config, CAST('null' AS JSON)) AS sync_config, b.enabled, b.created_uid, b.updated_uid,
    b.created_at, b.updated_at,
    t.id, COALESCE(t.target_type, ''), COALESCE(t.target_ref, ''), t.created_at, t.updated_at
FROM knowledge_source_bindings b
LEFT JOIN knowledge_source_binding_targets t FORCE INDEX (uk_kb_source_binding_targets) ON t.binding_id = b.id
WHERE b.knowledge_base_code = ?
ORDER BY b.id ASC, t.id ASC;

-- name: ListRealtimeProjectSourceBindingsByProject :many
SELECT
    b.id, b.organization_code, b.knowledge_base_code, b.provider, b.root_type, b.root_ref, b.sync_mode,
    COALESCE(b.sync_config, CAST('null' AS JSON)) AS sync_config, b.enabled, b.created_uid, b.updated_uid,
    b.created_at, b.updated_at,
    t.id, COALESCE(t.target_type, ''), COALESCE(t.target_ref, ''), t.created_at, t.updated_at
FROM knowledge_source_bindings b
LEFT JOIN knowledge_source_binding_targets t FORCE INDEX (uk_kb_source_binding_targets) ON t.binding_id = b.id
WHERE b.organization_code = ?
  AND b.provider = 'project'
  AND b.root_type = 'project'
  AND b.root_ref = ?
  AND b.sync_mode = 'realtime'
ORDER BY b.id ASC, t.id ASC;

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

-- name: DeleteSourceBindingItemsByBinding :execrows
DELETE FROM knowledge_source_binding_items
WHERE binding_id = ?;

-- name: InsertKnowledgeSourceBindingItem :exec
INSERT INTO knowledge_source_binding_items (
    binding_id, source_item_id, resolve_reason, last_resolved_at, created_at, updated_at
) VALUES (
    ?, ?, ?, ?, ?, ?
);

-- name: ListKnowledgeSourceBindingItemsByKnowledgeBase :many
SELECT
    bi.id, bi.binding_id, bi.source_item_id, bi.resolve_reason, bi.last_resolved_at, bi.created_at, bi.updated_at
FROM knowledge_source_binding_items bi
INNER JOIN knowledge_source_bindings b ON b.id = bi.binding_id
WHERE b.knowledge_base_code = ?
ORDER BY bi.id ASC;
