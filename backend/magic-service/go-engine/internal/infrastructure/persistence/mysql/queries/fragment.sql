-- name: InsertFragment :execresult
INSERT INTO magic_flow_knowledge_fragment (
  knowledge_code, document_code, content, metadata, business_id,
  sync_status, sync_times, sync_status_message, point_id, word_count,
  created_uid, updated_uid, created_at, updated_at
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
);

-- name: UpdateFragment :execrows
UPDATE magic_flow_knowledge_fragment
SET content = ?,
    metadata = ?,
    point_id = ?,
    word_count = ?,
    sync_status = ?,
    sync_times = ?,
    sync_status_message = ?,
    updated_uid = ?,
    updated_at = ?
WHERE id = ?
  AND deleted_at IS NULL;

-- name: FindFragmentByID :one
SELECT *
FROM magic_flow_knowledge_fragment
WHERE id = ?
  AND deleted_at IS NULL;

-- name: FindFragmentsByPointIDs :many
SELECT *
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND point_id IN (sqlc.slice(point_ids))
ORDER BY id ASC;

-- name: CountFragmentsByKnowledge :one
SELECT COUNT(*)
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND knowledge_code = sqlc.arg(knowledge_code)
  AND content LIKE sqlc.arg(content_like)
  AND sync_status IN (sqlc.slice(sync_status_values));

-- name: ListFragmentsByKnowledge :many
SELECT *
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND knowledge_code = sqlc.arg(knowledge_code)
  AND content LIKE sqlc.arg(content_like)
  AND sync_status IN (sqlc.slice(sync_status_values))
ORDER BY id ASC
LIMIT ? OFFSET ?;

-- name: ListPendingFragments :many
SELECT *
FROM magic_flow_knowledge_fragment
WHERE knowledge_code = ?
  AND sync_status IN (?, ?)
  AND deleted_at IS NULL
ORDER BY id ASC
LIMIT ?;

-- name: DeleteFragmentByID :execrows
DELETE FROM magic_flow_knowledge_fragment
WHERE id = ?;

-- name: DeleteFragmentsByIDs :execrows
DELETE FROM magic_flow_knowledge_fragment
WHERE id IN (sqlc.slice(ids));

-- name: DeleteFragmentsByDocument :execrows
DELETE FROM magic_flow_knowledge_fragment
WHERE knowledge_code = ?
  AND document_code = ?;

-- name: DeleteFragmentsByDocumentCodes :execrows
DELETE FROM magic_flow_knowledge_fragment
WHERE knowledge_code = sqlc.arg(knowledge_code)
  AND document_code IN (sqlc.slice(document_codes));

-- name: CountFragmentsByKnowledgeAndDocument :one
SELECT COUNT(*)
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND knowledge_code = ?
  AND document_code = ?;

-- name: ListFragmentsByKnowledgeAndDocument :many
SELECT *
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND knowledge_code = ?
  AND document_code = ?
ORDER BY id ASC
LIMIT ? OFFSET ?;

-- name: CountFragmentsByKnowledgeAndDocumentFiltered :one
SELECT COUNT(*)
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND knowledge_code = sqlc.arg(knowledge_code)
  AND document_code = sqlc.arg(document_code)
  AND content LIKE sqlc.arg(content_like)
  AND sync_status IN (sqlc.slice(sync_status_values));

-- name: ListFragmentsByKnowledgeAndDocumentFiltered :many
SELECT *
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND knowledge_code = sqlc.arg(knowledge_code)
  AND document_code = sqlc.arg(document_code)
  AND content LIKE sqlc.arg(content_like)
  AND sync_status IN (sqlc.slice(sync_status_values))
ORDER BY id ASC
LIMIT ? OFFSET ?;

-- name: CountFragmentsByKnowledgeAndBusinessID :one
SELECT COUNT(*)
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND knowledge_code = sqlc.arg(knowledge_code)
  AND business_id = sqlc.arg(business_id)
  AND content LIKE sqlc.arg(content_like)
  AND sync_status IN (sqlc.slice(sync_status_values));

-- name: ListFragmentsByKnowledgeAndBusinessID :many
SELECT *
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND knowledge_code = sqlc.arg(knowledge_code)
  AND business_id = sqlc.arg(business_id)
  AND content LIKE sqlc.arg(content_like)
  AND sync_status IN (sqlc.slice(sync_status_values))
ORDER BY id ASC
LIMIT ? OFFSET ?;

-- name: ListFragmentsByKnowledgeAndDocumentAfterID :many
SELECT *
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND knowledge_code = ?
  AND document_code = ?
  AND id > ?
ORDER BY id ASC
LIMIT ?;

-- name: DeleteFragmentsByKnowledgeBase :execrows
DELETE FROM magic_flow_knowledge_fragment
WHERE knowledge_code = ?;

-- name: UpdateFragmentSyncStatus :execrows
UPDATE magic_flow_knowledge_fragment
SET sync_status = ?,
    sync_times = ?,
    sync_status_message = ?,
    updated_at = ?
WHERE id = ?
  AND deleted_at IS NULL;

-- name: CountFragmentsByKnowledgeBase :one
SELECT COUNT(*)
FROM magic_flow_knowledge_fragment
WHERE knowledge_code = ?
  AND deleted_at IS NULL;

-- name: CountSyncedFragmentsByKnowledgeBase :one
SELECT COUNT(*)
FROM magic_flow_knowledge_fragment
WHERE knowledge_code = ?
  AND sync_status = ?
  AND deleted_at IS NULL;

-- name: FindFragmentsByIDs :many
SELECT *
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND id IN (sqlc.slice(ids))
ORDER BY id ASC;

-- name: CountFragmentStatsByKnowledgeBase :one
SELECT
	COUNT(*) AS fragment_count,
	COALESCE(SUM(CASE WHEN sync_status = ? THEN 1 ELSE 0 END), 0) AS synced_v2_count,
	COALESCE(SUM(CASE WHEN sync_status = ? THEN 1 ELSE 0 END), 0) AS synced_v1_count
FROM magic_flow_knowledge_fragment
WHERE knowledge_code = ?
  AND deleted_at IS NULL;

-- name: CountFragmentStatsByKnowledgeBases :many
SELECT
	knowledge_code,
	COUNT(*) AS fragment_count,
	COALESCE(SUM(CASE WHEN sync_status = ? THEN 1 ELSE 0 END), 0) AS synced_v2_count,
	COALESCE(SUM(CASE WHEN sync_status = ? THEN 1 ELSE 0 END), 0) AS synced_v1_count
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND knowledge_code IN (sqlc.slice(knowledge_codes))
GROUP BY knowledge_code
ORDER BY knowledge_code ASC;

-- name: ListFragmentsMissingDocumentCodeByKnowledge :many
SELECT *
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND (document_code = '' OR document_code IS NULL)
  AND knowledge_code = sqlc.arg(knowledge_code)
  AND id > sqlc.arg(start_id)
ORDER BY id ASC
LIMIT ?;

-- name: ListFragmentsMissingDocumentCodeByKnowledgeCodes :many
SELECT *
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND (document_code = '' OR document_code IS NULL)
  AND knowledge_code IN (sqlc.slice(knowledge_codes))
  AND id > sqlc.arg(start_id)
ORDER BY id ASC
LIMIT ?;

-- name: BackfillFragmentDocumentCodeByIDs :execrows
UPDATE magic_flow_knowledge_fragment
SET document_code = sqlc.arg(document_code),
    updated_at = sqlc.arg(updated_at)
WHERE deleted_at IS NULL
  AND (document_code = '' OR document_code IS NULL)
  AND id IN (sqlc.slice(ids));

-- name: BackfillFragmentDocumentCodeByThirdFile :execrows
UPDATE magic_flow_knowledge_fragment
SET document_code = sqlc.arg(document_code),
    updated_at = sqlc.arg(updated_at)
WHERE deleted_at IS NULL
  AND (document_code = '' OR document_code IS NULL)
  AND knowledge_code = sqlc.arg(knowledge_code)
  AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.file_id')) = CAST(sqlc.arg(third_file_id) AS CHAR(255));

-- name: ListThirdFileRepairKnowledgeCodes :many
SELECT DISTINCT knowledge_code
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.file_id')) <> ''
ORDER BY knowledge_code ASC;

-- name: ListThirdFileRepairGroupsByKnowledgeCodes :many
SELECT knowledge_code,
       JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.file_id')) AS third_file_id,
       COALESCE(MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.knowledge_base_id')), '')), '') AS knowledge_base_id,
       COALESCE(
         MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.group_ref')), '')),
         MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.folder_id')), '')),
         MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.parent_id')), '')),
         ''
       ) AS group_ref,
       COALESCE(MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.third_file_type')), '')), '') AS third_file_type,
       COALESCE(MIN(NULLIF(document_code, '')), '') AS document_code,
       COALESCE(MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.document_name')), '')), '') AS document_name,
       COALESCE(MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.url')), '')), '') AS preview_url,
       COALESCE(MIN(NULLIF(created_uid, '')), '') AS created_uid,
       COALESCE(MIN(NULLIF(updated_uid, '')), '') AS updated_uid,
       COUNT(*) AS fragment_count,
       COALESCE(SUM(CASE WHEN document_code = '' OR document_code IS NULL THEN 1 ELSE 0 END), 0) AS missing_document_code_count
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.file_id')) <> ''
  AND knowledge_code IN (sqlc.slice(knowledge_codes))
GROUP BY knowledge_code, JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.file_id'))
ORDER BY knowledge_code ASC, third_file_id ASC
LIMIT ? OFFSET ?;
