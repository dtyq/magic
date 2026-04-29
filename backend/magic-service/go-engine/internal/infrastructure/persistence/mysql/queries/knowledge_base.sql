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
SELECT magic_flow_knowledge.*
FROM magic_flow_knowledge
WHERE id = ?
  AND deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__';

-- name: FindKnowledgeBaseByCode :one
SELECT magic_flow_knowledge.*
FROM magic_flow_knowledge
WHERE code = ?
  AND deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
LIMIT 1;

-- name: FindKnowledgeBaseByCodeAndOrg :one
SELECT magic_flow_knowledge.*
FROM magic_flow_knowledge
WHERE code = ?
  AND organization_code = ?
  AND deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
LIMIT 1;

-- name: ListActiveKnowledgeBaseCodesByOrganization :many
SELECT code
FROM magic_flow_knowledge
WHERE organization_code = ?
  AND deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
ORDER BY code ASC;

-- name: ListActiveKnowledgeBaseCodesByCodes :many
SELECT code
FROM magic_flow_knowledge
WHERE code IN (sqlc.slice(codes))
  AND deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
ORDER BY code ASC;

-- name: ListActiveKnowledgeBaseCodesByOrganizationAndCodes :many
SELECT code
FROM magic_flow_knowledge
WHERE organization_code = ?
  AND code IN (sqlc.slice(codes))
  AND deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
ORDER BY code ASC;

-- name: ListActiveKnowledgeBaseOrganizationsByCodes :many
SELECT organization_code
FROM magic_flow_knowledge
WHERE code IN (sqlc.slice(codes))
  AND deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
ORDER BY organization_code ASC, code ASC;

-- name: CountKnowledgeBases :one
SELECT COUNT(*)
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND name LIKE sqlc.arg(name_like)
  AND type IN (sqlc.slice(type_values))
  AND knowledge_base_type IN (sqlc.slice(knowledge_base_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values));

-- name: CountKnowledgeBasesByCodes :one
SELECT COUNT(*)
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND name LIKE sqlc.arg(name_like)
  AND type IN (sqlc.slice(type_values))
  AND knowledge_base_type IN (sqlc.slice(knowledge_base_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values))
  AND code IN (sqlc.slice(codes));

-- name: CountKnowledgeBasesByOrganization :one
SELECT COUNT(*)
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND organization_code = sqlc.arg(organization_code)
  AND name LIKE sqlc.arg(name_like)
  AND type IN (sqlc.slice(type_values))
  AND knowledge_base_type IN (sqlc.slice(knowledge_base_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values));

-- name: CountKnowledgeBasesByOrganizationAndCodes :one
SELECT COUNT(*)
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND organization_code = sqlc.arg(organization_code)
  AND name LIKE sqlc.arg(name_like)
  AND type IN (sqlc.slice(type_values))
  AND knowledge_base_type IN (sqlc.slice(knowledge_base_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values))
  AND code IN (sqlc.slice(codes));

-- name: CountKnowledgeBasesByCodesAndBusinessIDs :one
SELECT COUNT(*)
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND organization_code = sqlc.arg(organization_code)
  AND name LIKE sqlc.arg(name_like)
  AND type IN (sqlc.slice(type_values))
  AND knowledge_base_type IN (sqlc.slice(knowledge_base_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values))
  AND code IN (sqlc.slice(codes))
  AND business_id IN (sqlc.slice(business_ids));

-- name: CountKnowledgeBasesByCodesAndBusinessIDsNoOrganization :one
SELECT COUNT(*)
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND name LIKE sqlc.arg(name_like)
  AND type IN (sqlc.slice(type_values))
  AND knowledge_base_type IN (sqlc.slice(knowledge_base_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values))
  AND code IN (sqlc.slice(codes))
  AND business_id IN (sqlc.slice(business_ids));

-- name: ListKnowledgeBases :many
SELECT magic_flow_knowledge.*
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND name LIKE sqlc.arg(name_like)
  AND type IN (sqlc.slice(type_values))
  AND knowledge_base_type IN (sqlc.slice(knowledge_base_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values))
ORDER BY id DESC
LIMIT ? OFFSET ?;

-- name: ListKnowledgeBasesByCodes :many
SELECT magic_flow_knowledge.*
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND name LIKE sqlc.arg(name_like)
  AND type IN (sqlc.slice(type_values))
  AND knowledge_base_type IN (sqlc.slice(knowledge_base_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values))
  AND code IN (sqlc.slice(codes))
ORDER BY id DESC
LIMIT ? OFFSET ?;

-- name: ListKnowledgeBasesByOrganization :many
SELECT magic_flow_knowledge.*
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND organization_code = sqlc.arg(organization_code)
  AND name LIKE sqlc.arg(name_like)
  AND type IN (sqlc.slice(type_values))
  AND knowledge_base_type IN (sqlc.slice(knowledge_base_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values))
ORDER BY id DESC
LIMIT ? OFFSET ?;

-- name: ListKnowledgeBasesByOrganizationAndCodes :many
SELECT magic_flow_knowledge.*
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND organization_code = sqlc.arg(organization_code)
  AND name LIKE sqlc.arg(name_like)
  AND type IN (sqlc.slice(type_values))
  AND knowledge_base_type IN (sqlc.slice(knowledge_base_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values))
  AND code IN (sqlc.slice(codes))
ORDER BY id DESC
LIMIT ? OFFSET ?;

-- name: ListKnowledgeBasesByCodesAndBusinessIDs :many
SELECT magic_flow_knowledge.*
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND organization_code = sqlc.arg(organization_code)
  AND name LIKE sqlc.arg(name_like)
  AND type IN (sqlc.slice(type_values))
  AND knowledge_base_type IN (sqlc.slice(knowledge_base_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values))
  AND code IN (sqlc.slice(codes))
  AND business_id IN (sqlc.slice(business_ids))
ORDER BY id DESC
LIMIT ? OFFSET ?;

-- name: ListKnowledgeBasesByCodesAndBusinessIDsNoOrganization :many
SELECT magic_flow_knowledge.*
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND name LIKE sqlc.arg(name_like)
  AND type IN (sqlc.slice(type_values))
  AND knowledge_base_type IN (sqlc.slice(knowledge_base_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values))
  AND code IN (sqlc.slice(codes))
  AND business_id IN (sqlc.slice(business_ids))
ORDER BY id DESC
LIMIT ? OFFSET ?;

-- name: CountKnowledgeBasesByBusinessIDs :one
SELECT COUNT(*)
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND organization_code = sqlc.arg(organization_code)
  AND name LIKE sqlc.arg(name_like)
  AND type IN (sqlc.slice(type_values))
  AND knowledge_base_type IN (sqlc.slice(knowledge_base_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values))
  AND business_id IN (sqlc.slice(business_ids));

-- name: CountKnowledgeBasesByBusinessIDsNoOrganization :one
SELECT COUNT(*)
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND name LIKE sqlc.arg(name_like)
  AND type IN (sqlc.slice(type_values))
  AND knowledge_base_type IN (sqlc.slice(knowledge_base_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values))
  AND business_id IN (sqlc.slice(business_ids));

-- name: ListKnowledgeBasesByBusinessIDs :many
SELECT magic_flow_knowledge.*
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND organization_code = sqlc.arg(organization_code)
  AND name LIKE sqlc.arg(name_like)
  AND type IN (sqlc.slice(type_values))
  AND knowledge_base_type IN (sqlc.slice(knowledge_base_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values))
  AND business_id IN (sqlc.slice(business_ids))
ORDER BY id DESC
LIMIT ? OFFSET ?;

-- name: ListKnowledgeBasesByBusinessIDsNoOrganization :many
SELECT magic_flow_knowledge.*
FROM magic_flow_knowledge
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND name LIKE sqlc.arg(name_like)
  AND type IN (sqlc.slice(type_values))
  AND knowledge_base_type IN (sqlc.slice(knowledge_base_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values))
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
       embedding_config
FROM magic_flow_knowledge
WHERE code = ?
  AND deleted_at IS NULL
LIMIT 1;

-- name: ResetKnowledgeBaseSyncStatusAll :execrows
UPDATE magic_flow_knowledge
SET sync_status = 0,
    sync_status_message = '',
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__';

-- name: ResetKnowledgeBaseSyncStatusByOrganization :execrows
UPDATE magic_flow_knowledge
SET sync_status = 0,
    sync_status_message = '',
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND organization_code = ?;

-- name: ResetKnowledgeBaseSyncStatusByKnowledgeBase :execrows
UPDATE magic_flow_knowledge
SET sync_status = 0,
    sync_status_message = '',
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND organization_code = ?
  AND code = ?;

-- name: UpdateKnowledgeBaseModelAll :execrows
UPDATE magic_flow_knowledge
SET model = sqlc.arg(model),
    embedding_config = JSON_SET(COALESCE(embedding_config, JSON_OBJECT()), '$.model_id', sqlc.arg(model)),
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__';

-- name: UpdateKnowledgeBaseModelByOrganization :execrows
UPDATE magic_flow_knowledge
SET model = sqlc.arg(model),
    embedding_config = JSON_SET(COALESCE(embedding_config, JSON_OBJECT()), '$.model_id', sqlc.arg(model)),
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND organization_code = sqlc.arg(organization_code);

-- name: UpdateKnowledgeBaseModelByKnowledgeBase :execrows
UPDATE magic_flow_knowledge
SET model = sqlc.arg(model),
    embedding_config = JSON_SET(COALESCE(embedding_config, JSON_OBJECT()), '$.model_id', sqlc.arg(model)),
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND code <> '__qdrant_collection_meta__'
  AND organization_code = sqlc.arg(organization_code)
  AND code = sqlc.arg(code);

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
