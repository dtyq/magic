-- name: InsertDocument :execresult
INSERT INTO knowledge_base_documents (
  organization_code, knowledge_base_code, source_binding_id, source_item_id, auto_added, name, description, code,
  enabled, doc_type, doc_metadata, document_file,
  sync_status, sync_times, sync_status_message, embedding_model, vector_db,
  retrieve_config, fragment_config, embedding_config, vector_db_config, word_count,
  created_uid, updated_uid, created_at, updated_at, third_platform_type, third_file_id
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
);

-- name: UpdateDocument :execrows
UPDATE knowledge_base_documents
SET source_binding_id = ?,
    source_item_id = ?,
    auto_added = ?,
    name = ?,
    description = ?,
    enabled = ?,
    doc_type = ?,
    doc_metadata = ?,
    document_file = ?,
    sync_status = ?,
    sync_times = ?,
    sync_status_message = ?,
    embedding_model = ?,
    vector_db = ?,
    retrieve_config = ?,
    fragment_config = ?,
    embedding_config = ?,
    vector_db_config = ?,
    word_count = ?,
    third_platform_type = ?,
    third_file_id = ?,
    updated_uid = ?,
    updated_at = ?
WHERE id = ?
  AND deleted_at IS NULL;

-- name: DeleteDocumentByID :execrows
DELETE FROM knowledge_base_documents
WHERE id = ?;

-- name: DeleteDocumentsByKnowledgeBase :execrows
DELETE FROM knowledge_base_documents
WHERE knowledge_base_code = ?;

-- name: DeleteDocumentsByKnowledgeBaseAndCodes :execrows
DELETE FROM knowledge_base_documents
WHERE knowledge_base_code = sqlc.arg(knowledge_base_code)
  AND code IN (sqlc.slice(codes));

-- name: UpdateDocumentSyncStatus :execrows
UPDATE knowledge_base_documents
SET sync_status = ?,
    sync_status_message = ?,
    updated_at = ?
WHERE id = ?
  AND deleted_at IS NULL;

-- name: FindDocumentByID :one
SELECT *
FROM knowledge_base_documents
WHERE id = ?
  AND deleted_at IS NULL;

-- name: FindDocumentByCode :one
SELECT *
FROM knowledge_base_documents
WHERE code = ?
  AND deleted_at IS NULL
ORDER BY id DESC
LIMIT 1;

-- name: FindDocumentByCodeAndKnowledgeBase :one
SELECT *
FROM knowledge_base_documents
WHERE code = ?
  AND knowledge_base_code = ?
  AND deleted_at IS NULL
ORDER BY id DESC
LIMIT 1;

-- name: FindDocumentByThirdFile :one
SELECT *
FROM knowledge_base_documents
WHERE third_platform_type = ?
  AND third_file_id = ?
  AND deleted_at IS NULL
ORDER BY id DESC
LIMIT 1;

-- name: FindDocumentByKnowledgeBaseAndThirdFile :one
SELECT *
FROM knowledge_base_documents
WHERE knowledge_base_code = ?
  AND third_platform_type = ?
  AND third_file_id = ?
  AND deleted_at IS NULL
ORDER BY id DESC
LIMIT 1;

-- name: ListDocumentsBySourceFileID :many
SELECT *
FROM knowledge_base_documents
WHERE source_item_id = ?
  AND deleted_at IS NULL
ORDER BY id DESC;

-- name: ListDocumentsByOrganizationAndThirdFile :many
SELECT *
FROM knowledge_base_documents
WHERE organization_code = ?
  AND third_platform_type = ?
  AND third_file_id = ?
  AND deleted_at IS NULL;

-- name: CountDocumentsByOrganization :one
SELECT COUNT(*)
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND organization_code = sqlc.arg(organization_code)
  AND name LIKE sqlc.arg(name_like)
  AND doc_type IN (sqlc.slice(doc_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values));

-- name: ListDocumentsByOrganization :many
SELECT *
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND organization_code = sqlc.arg(organization_code)
  AND name LIKE sqlc.arg(name_like)
  AND doc_type IN (sqlc.slice(doc_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values))
ORDER BY id DESC
LIMIT ? OFFSET ?;

-- name: CountDocumentsByOrganizationAndKnowledgeBase :one
SELECT COUNT(*)
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND organization_code = sqlc.arg(organization_code)
  AND knowledge_base_code = sqlc.arg(knowledge_base_code)
  AND name LIKE sqlc.arg(name_like)
  AND doc_type IN (sqlc.slice(doc_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values));

-- name: ListDocumentsByOrganizationAndKnowledgeBase :many
SELECT *
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND organization_code = sqlc.arg(organization_code)
  AND knowledge_base_code = sqlc.arg(knowledge_base_code)
  AND name LIKE sqlc.arg(name_like)
  AND doc_type IN (sqlc.slice(doc_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values))
ORDER BY id DESC
LIMIT ? OFFSET ?;

-- name: CountDocumentsByKnowledgeBase :one
SELECT COUNT(*)
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND knowledge_base_code = sqlc.arg(knowledge_base_code)
  AND name LIKE sqlc.arg(name_like)
  AND doc_type IN (sqlc.slice(doc_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values));

-- name: ListDocumentsByKnowledgeBase :many
SELECT *
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND knowledge_base_code = sqlc.arg(knowledge_base_code)
  AND name LIKE sqlc.arg(name_like)
  AND doc_type IN (sqlc.slice(doc_type_values))
  AND enabled IN (sqlc.slice(enabled_values))
  AND sync_status IN (sqlc.slice(sync_status_values))
ORDER BY id DESC
LIMIT ? OFFSET ?;

-- name: CountDocumentsByKnowledgeBaseCodes :many
SELECT knowledge_base_code, COUNT(*) AS count
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND organization_code = ?
  AND knowledge_base_code IN (sqlc.slice(knowledge_base_codes))
GROUP BY knowledge_base_code;

-- name: ListDocumentFilesByKnowledgeBaseCodes :many
SELECT knowledge_base_code, document_file
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND organization_code = ?
  AND knowledge_base_code IN (sqlc.slice(knowledge_base_codes));

-- name: FindDocumentIncludingDeleted :one
SELECT *
FROM knowledge_base_documents
WHERE knowledge_base_code = ?
  AND code = ?
ORDER BY id DESC
LIMIT 1;

-- name: FindDocumentOrganizationByKnowledgeBase :one
SELECT organization_code
FROM knowledge_base_documents
WHERE knowledge_base_code = ?
  AND deleted_at IS NULL
ORDER BY id DESC
LIMIT 1;

-- name: FindLatestDocumentByKnowledgeBaseAndSourceBindingAndSourceItems :one
SELECT *
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND knowledge_base_code = sqlc.arg(knowledge_base_code)
  AND source_binding_id IN (sqlc.slice(source_binding_ids))
  AND source_item_id IN (sqlc.slice(source_item_ids))
ORDER BY id DESC
LIMIT 1;

-- name: ListDocumentsByKnowledgeBaseAndSourceBindingIDs :many
SELECT *
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND knowledge_base_code = sqlc.arg(knowledge_base_code)
  AND source_binding_id IN (sqlc.slice(source_binding_ids))
ORDER BY id DESC;

-- name: ListDocumentsByOrganizationAndSourceBindingAndSourceItems :many
SELECT *
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND organization_code = sqlc.arg(organization_code)
  AND source_binding_id IN (sqlc.slice(source_binding_ids))
  AND source_item_id IN (sqlc.slice(source_item_ids))
ORDER BY id DESC;

-- name: FindLatestDocumentByKnowledgeBaseAndSourceItemIDs :one
SELECT *
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND knowledge_base_code = sqlc.arg(knowledge_base_code)
  AND source_item_id IN (sqlc.slice(source_item_ids))
ORDER BY id DESC
LIMIT 1;

-- name: ListDocumentsByOrganizationAndSourceItemIDs :many
SELECT *
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND organization_code = sqlc.arg(organization_code)
  AND source_item_id IN (sqlc.slice(source_item_ids))
ORDER BY id DESC;

-- name: ResetDocumentSyncStatusAll :execrows
UPDATE knowledge_base_documents
SET sync_status = 0,
    sync_status_message = '',
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND knowledge_base_code <> '__qdrant_collection_meta__';

-- name: ResetDocumentSyncStatusByOrganization :execrows
UPDATE knowledge_base_documents
SET sync_status = 0,
    sync_status_message = '',
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND organization_code = sqlc.arg(organization_code)
  AND knowledge_base_code <> '__qdrant_collection_meta__';

-- name: ResetDocumentSyncStatusByKnowledgeBase :execrows
UPDATE knowledge_base_documents
SET sync_status = 0,
    sync_status_message = '',
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND organization_code = sqlc.arg(organization_code)
  AND knowledge_base_code = sqlc.arg(knowledge_base_code);

-- name: ResetDocumentSyncStatusByDocument :execrows
UPDATE knowledge_base_documents
SET sync_status = 0,
    sync_status_message = '',
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND organization_code = sqlc.arg(organization_code)
  AND knowledge_base_code = sqlc.arg(knowledge_base_code)
  AND code = sqlc.arg(code);

-- name: UpdateDocumentModelAll :execrows
UPDATE knowledge_base_documents
SET embedding_model = sqlc.arg(model),
    embedding_config = JSON_SET(COALESCE(embedding_config, JSON_OBJECT()), '$.model_id', sqlc.arg(model)),
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND knowledge_base_code <> '__qdrant_collection_meta__';

-- name: UpdateDocumentModelByOrganization :execrows
UPDATE knowledge_base_documents
SET embedding_model = sqlc.arg(model),
    embedding_config = JSON_SET(COALESCE(embedding_config, JSON_OBJECT()), '$.model_id', sqlc.arg(model)),
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND organization_code = sqlc.arg(organization_code)
  AND knowledge_base_code <> '__qdrant_collection_meta__';

-- name: UpdateDocumentModelByKnowledgeBase :execrows
UPDATE knowledge_base_documents
SET embedding_model = sqlc.arg(model),
    embedding_config = JSON_SET(COALESCE(embedding_config, JSON_OBJECT()), '$.model_id', sqlc.arg(model)),
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND organization_code = sqlc.arg(organization_code)
  AND knowledge_base_code = sqlc.arg(knowledge_base_code);

-- name: UpdateDocumentModelByDocument :execrows
UPDATE knowledge_base_documents
SET embedding_model = sqlc.arg(model),
    embedding_config = JSON_SET(COALESCE(embedding_config, JSON_OBJECT()), '$.model_id', sqlc.arg(model)),
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND organization_code = sqlc.arg(organization_code)
  AND knowledge_base_code = sqlc.arg(knowledge_base_code)
  AND code = sqlc.arg(code);

-- name: ListRebuildDocumentsBatchAll :many
SELECT id, organization_code, knowledge_base_code, code, created_uid, updated_uid
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND id > sqlc.arg(after_id)
  AND knowledge_base_code <> ''
  AND code <> ''
  AND knowledge_base_code <> '__qdrant_collection_meta__'
ORDER BY id ASC
LIMIT ?;

-- name: ListRebuildDocumentsBatchByOrganization :many
SELECT id, organization_code, knowledge_base_code, code, created_uid, updated_uid
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND id > sqlc.arg(after_id)
  AND organization_code = sqlc.arg(organization_code)
  AND knowledge_base_code <> ''
  AND code <> ''
  AND knowledge_base_code <> '__qdrant_collection_meta__'
ORDER BY id ASC
LIMIT ?;

-- name: ListRebuildDocumentsBatchByKnowledgeBase :many
SELECT id, organization_code, knowledge_base_code, code, created_uid, updated_uid
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND id > sqlc.arg(after_id)
  AND organization_code = sqlc.arg(organization_code)
  AND knowledge_base_code = sqlc.arg(knowledge_base_code)
  AND code <> ''
ORDER BY id ASC
LIMIT ?;

-- name: ListRebuildDocumentsBatchByDocument :many
SELECT id, organization_code, knowledge_base_code, code, created_uid, updated_uid
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND id > sqlc.arg(after_id)
  AND organization_code = sqlc.arg(organization_code)
  AND knowledge_base_code = sqlc.arg(knowledge_base_code)
  AND code = sqlc.arg(code)
ORDER BY id ASC
LIMIT ?;
