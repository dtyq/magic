-- name: InsertKnowledgeBase :execresult
INSERT INTO magic_flow_knowledge (
  code, version, name, description, type, enabled, business_id,
  sync_status, sync_status_message, model, vector_db, organization_code,
  created_uid, updated_uid, expected_num, completed_num,
  retrieve_config, fragment_config, embedding_config, word_count, icon,
  source_type, knowledge_base_type, created_at, updated_at
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
);

-- name: UpdateKnowledgeBase :execrows
UPDATE magic_flow_knowledge
SET name = ?,
    description = ?,
    enabled = ?,
    updated_uid = ?,
    source_type = ?,
    knowledge_base_type = ?,
    retrieve_config = ?,
    fragment_config = ?,
    embedding_config = ?,
    word_count = ?,
    icon = ?,
    updated_at = ?
WHERE id = ?
  AND deleted_at IS NULL;

-- name: FindKnowledgeBaseByID :one
SELECT id, code, version, name, description, type, enabled, business_id,
       sync_status, sync_status_message, model, vector_db, organization_code,
       created_uid, updated_uid, expected_num, completed_num,
       COALESCE(retrieve_config, CAST('null' AS JSON)) AS retrieve_config,
       COALESCE(fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(embedding_config, CAST('null' AS JSON)) AS embedding_config,
       word_count, icon,
       source_type, knowledge_base_type, created_at, updated_at
FROM magic_flow_knowledge
WHERE id = ?
  AND deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__';

-- name: FindKnowledgeBaseByCode :one
SELECT id, code, version, name, description, type, enabled, business_id,
       sync_status, sync_status_message, model, vector_db, organization_code,
       created_uid, updated_uid, expected_num, completed_num,
       COALESCE(retrieve_config, CAST('null' AS JSON)) AS retrieve_config,
       COALESCE(fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(embedding_config, CAST('null' AS JSON)) AS embedding_config,
       word_count, icon,
       source_type, knowledge_base_type, created_at, updated_at
FROM magic_flow_knowledge
WHERE code = ?
  AND deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
LIMIT 1;

-- name: FindKnowledgeBaseByCodeAndOrg :one
SELECT id, code, version, name, description, type, enabled, business_id,
       sync_status, sync_status_message, model, vector_db, organization_code,
       created_uid, updated_uid, expected_num, completed_num,
       COALESCE(retrieve_config, CAST('null' AS JSON)) AS retrieve_config,
       COALESCE(fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(embedding_config, CAST('null' AS JSON)) AS embedding_config,
       word_count, icon,
       source_type, knowledge_base_type, created_at, updated_at
FROM magic_flow_knowledge
WHERE code = ?
  AND organization_code = ?
  AND deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
LIMIT 1;

-- name: CountKnowledgeBases :one
SELECT COUNT(*)
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND (sqlc.narg(organization_code) IS NULL OR organization_code = sqlc.narg(organization_code))
  AND (sqlc.narg(name_like) IS NULL OR name LIKE sqlc.narg(name_like))
  AND (sqlc.narg(type) IS NULL OR type = sqlc.narg(type))
  AND (sqlc.narg(knowledge_base_type) IS NULL OR knowledge_base_type = sqlc.narg(knowledge_base_type))
  AND (sqlc.narg(enabled) IS NULL OR enabled = sqlc.narg(enabled))
  AND (sqlc.narg(sync_status) IS NULL OR sync_status = sqlc.narg(sync_status));

-- name: CountKnowledgeBasesByCodes :one
SELECT COUNT(*)
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND (sqlc.narg(organization_code) IS NULL OR organization_code = sqlc.narg(organization_code))
  AND (sqlc.narg(name_like) IS NULL OR name LIKE sqlc.narg(name_like))
  AND (sqlc.narg(type) IS NULL OR type = sqlc.narg(type))
  AND (sqlc.narg(knowledge_base_type) IS NULL OR knowledge_base_type = sqlc.narg(knowledge_base_type))
  AND (sqlc.narg(enabled) IS NULL OR enabled = sqlc.narg(enabled))
  AND (sqlc.narg(sync_status) IS NULL OR sync_status = sqlc.narg(sync_status))
  AND code IN (sqlc.slice(codes));

-- name: CountKnowledgeBasesByCodesAndBusinessIDs :one
SELECT COUNT(*)
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND (sqlc.narg(organization_code) IS NULL OR organization_code = sqlc.narg(organization_code))
  AND (sqlc.narg(name_like) IS NULL OR name LIKE sqlc.narg(name_like))
  AND (sqlc.narg(type) IS NULL OR type = sqlc.narg(type))
  AND (sqlc.narg(knowledge_base_type) IS NULL OR knowledge_base_type = sqlc.narg(knowledge_base_type))
  AND (sqlc.narg(enabled) IS NULL OR enabled = sqlc.narg(enabled))
  AND (sqlc.narg(sync_status) IS NULL OR sync_status = sqlc.narg(sync_status))
  AND code IN (sqlc.slice(codes))
  AND business_id IN (sqlc.slice(business_ids));

-- name: ListKnowledgeBases :many
SELECT id, code, version, name, description, type, enabled, business_id,
       sync_status, sync_status_message, model, vector_db, organization_code,
       created_uid, updated_uid, expected_num, completed_num,
       COALESCE(retrieve_config, CAST('null' AS JSON)) AS retrieve_config,
       COALESCE(fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(embedding_config, CAST('null' AS JSON)) AS embedding_config,
       word_count, icon,
       source_type, knowledge_base_type, created_at, updated_at
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND (sqlc.narg(organization_code) IS NULL OR organization_code = sqlc.narg(organization_code))
  AND (sqlc.narg(name_like) IS NULL OR name LIKE sqlc.narg(name_like))
  AND (sqlc.narg(type) IS NULL OR type = sqlc.narg(type))
  AND (sqlc.narg(knowledge_base_type) IS NULL OR knowledge_base_type = sqlc.narg(knowledge_base_type))
  AND (sqlc.narg(enabled) IS NULL OR enabled = sqlc.narg(enabled))
  AND (sqlc.narg(sync_status) IS NULL OR sync_status = sqlc.narg(sync_status))
ORDER BY id DESC
LIMIT ? OFFSET ?;

-- name: ListKnowledgeBasesByCodes :many
SELECT id, code, version, name, description, type, enabled, business_id,
       sync_status, sync_status_message, model, vector_db, organization_code,
       created_uid, updated_uid, expected_num, completed_num,
       COALESCE(retrieve_config, CAST('null' AS JSON)) AS retrieve_config,
       COALESCE(fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(embedding_config, CAST('null' AS JSON)) AS embedding_config,
       word_count, icon,
       source_type, knowledge_base_type, created_at, updated_at
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND (sqlc.narg(organization_code) IS NULL OR organization_code = sqlc.narg(organization_code))
  AND (sqlc.narg(name_like) IS NULL OR name LIKE sqlc.narg(name_like))
  AND (sqlc.narg(type) IS NULL OR type = sqlc.narg(type))
  AND (sqlc.narg(knowledge_base_type) IS NULL OR knowledge_base_type = sqlc.narg(knowledge_base_type))
  AND (sqlc.narg(enabled) IS NULL OR enabled = sqlc.narg(enabled))
  AND (sqlc.narg(sync_status) IS NULL OR sync_status = sqlc.narg(sync_status))
  AND code IN (sqlc.slice(codes))
ORDER BY id DESC
LIMIT ? OFFSET ?;

-- name: ListKnowledgeBasesByCodesAndBusinessIDs :many
SELECT id, code, version, name, description, type, enabled, business_id,
       sync_status, sync_status_message, model, vector_db, organization_code,
       created_uid, updated_uid, expected_num, completed_num,
       COALESCE(retrieve_config, CAST('null' AS JSON)) AS retrieve_config,
       COALESCE(fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(embedding_config, CAST('null' AS JSON)) AS embedding_config,
       word_count, icon,
       source_type, knowledge_base_type, created_at, updated_at
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND (sqlc.narg(organization_code) IS NULL OR organization_code = sqlc.narg(organization_code))
  AND (sqlc.narg(name_like) IS NULL OR name LIKE sqlc.narg(name_like))
  AND (sqlc.narg(type) IS NULL OR type = sqlc.narg(type))
  AND (sqlc.narg(knowledge_base_type) IS NULL OR knowledge_base_type = sqlc.narg(knowledge_base_type))
  AND (sqlc.narg(enabled) IS NULL OR enabled = sqlc.narg(enabled))
  AND (sqlc.narg(sync_status) IS NULL OR sync_status = sqlc.narg(sync_status))
  AND code IN (sqlc.slice(codes))
  AND business_id IN (sqlc.slice(business_ids))
ORDER BY id DESC
LIMIT ? OFFSET ?;

-- name: CountKnowledgeBasesByBusinessIDs :one
SELECT COUNT(*)
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND (sqlc.narg(organization_code) IS NULL OR organization_code = sqlc.narg(organization_code))
  AND (sqlc.narg(name_like) IS NULL OR name LIKE sqlc.narg(name_like))
  AND (sqlc.narg(type) IS NULL OR type = sqlc.narg(type))
  AND (sqlc.narg(knowledge_base_type) IS NULL OR knowledge_base_type = sqlc.narg(knowledge_base_type))
  AND (sqlc.narg(enabled) IS NULL OR enabled = sqlc.narg(enabled))
  AND (sqlc.narg(sync_status) IS NULL OR sync_status = sqlc.narg(sync_status))
  AND business_id IN (sqlc.slice(business_ids));

-- name: ListKnowledgeBasesByBusinessIDs :many
SELECT id, code, version, name, description, type, enabled, business_id,
       sync_status, sync_status_message, model, vector_db, organization_code,
       created_uid, updated_uid, expected_num, completed_num,
       COALESCE(retrieve_config, CAST('null' AS JSON)) AS retrieve_config,
       COALESCE(fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(embedding_config, CAST('null' AS JSON)) AS embedding_config,
       word_count, icon,
       source_type, knowledge_base_type, created_at, updated_at
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND (sqlc.narg(organization_code) IS NULL OR organization_code = sqlc.narg(organization_code))
  AND (sqlc.narg(name_like) IS NULL OR name LIKE sqlc.narg(name_like))
  AND (sqlc.narg(type) IS NULL OR type = sqlc.narg(type))
  AND (sqlc.narg(knowledge_base_type) IS NULL OR knowledge_base_type = sqlc.narg(knowledge_base_type))
  AND (sqlc.narg(enabled) IS NULL OR enabled = sqlc.narg(enabled))
  AND (sqlc.narg(sync_status) IS NULL OR sync_status = sqlc.narg(sync_status))
  AND business_id IN (sqlc.slice(business_ids))
ORDER BY id DESC
LIMIT ? OFFSET ?;

-- name: DeleteKnowledgeBaseByID :execrows
DELETE FROM magic_flow_knowledge
WHERE id = ?;

-- name: UpdateKnowledgeBaseSyncStatus :execrows
UPDATE magic_flow_knowledge
SET sync_status = ?,
    sync_status_message = ?,
    updated_at = ?
WHERE id = ?
  AND deleted_at IS NULL;

-- name: UpdateKnowledgeBaseProgress :execrows
UPDATE magic_flow_knowledge
SET expected_num = ?,
    completed_num = ?,
    updated_at = ?
WHERE id = ?
  AND deleted_at IS NULL;

-- name: FindKnowledgeBaseCollectionMeta :one
SELECT model,
       COALESCE(embedding_config, CAST('{}' AS JSON)) AS embedding_config
FROM magic_flow_knowledge
WHERE code = ?
  AND deleted_at IS NULL
LIMIT 1;

-- name: UpsertKnowledgeBaseCollectionMeta :exec
INSERT INTO magic_flow_knowledge (
    code, version, name, description, type, enabled, business_id,
    sync_status, sync_status_message, model, vector_db, organization_code,
    created_uid, updated_uid, expected_num, completed_num,
    retrieve_config, fragment_config, embedding_config, word_count, icon,
    source_type, created_at, updated_at, deleted_at
) VALUES (
    ?, 1, ?, ?, 1, TRUE, '',
    0, '', ?, ?, ?,
    '', '', 0, 0,
    NULL, NULL, ?, 0, '',
    NULL, NOW(), NOW(), NULL
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    description = VALUES(description),
    model = VALUES(model),
    vector_db = VALUES(vector_db),
    organization_code = VALUES(organization_code),
    embedding_config = VALUES(embedding_config),
    deleted_at = NULL,
    updated_at = NOW();
