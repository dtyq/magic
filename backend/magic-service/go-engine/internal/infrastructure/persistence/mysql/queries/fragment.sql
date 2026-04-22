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
    updated_uid = ?,
    updated_at = ?
WHERE id = ?
  AND deleted_at IS NULL;

-- name: FindFragmentByID :one
SELECT id, knowledge_code, document_code, content,
       COALESCE(metadata, CAST('null' AS JSON)) AS metadata, business_id,
       sync_status, sync_times, sync_status_message, point_id, word_count,
       created_uid, updated_uid, created_at, updated_at, deleted_at
FROM magic_flow_knowledge_fragment
WHERE id = ?
  AND deleted_at IS NULL;

-- name: FindFragmentByPointID :one
SELECT id, knowledge_code, document_code, content,
       COALESCE(metadata, CAST('null' AS JSON)) AS metadata, business_id,
       sync_status, sync_times, sync_status_message, point_id, word_count,
       created_uid, updated_uid, created_at, updated_at, deleted_at
FROM magic_flow_knowledge_fragment
WHERE point_id = ?
  AND deleted_at IS NULL
LIMIT 1;

-- name: FindFragmentsByPointIDs :many
SELECT id, knowledge_code, document_code, content,
       COALESCE(metadata, CAST('null' AS JSON)) AS metadata, business_id,
       sync_status, sync_times, sync_status_message, point_id, word_count,
       created_uid, updated_uid, created_at, updated_at, deleted_at
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND point_id IN (sqlc.slice(point_ids))
ORDER BY id ASC;

-- name: CountFragments :one
SELECT COUNT(*)
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND (sqlc.narg(knowledge_code) IS NULL OR knowledge_code = sqlc.narg(knowledge_code))
  AND (sqlc.narg(document_code) IS NULL OR document_code = sqlc.narg(document_code))
  AND (sqlc.narg(business_id) IS NULL OR business_id = sqlc.narg(business_id))
  AND (sqlc.narg(content_like) IS NULL OR content LIKE sqlc.narg(content_like))
  AND (sqlc.narg(sync_status) IS NULL OR sync_status = sqlc.narg(sync_status));

-- name: ListFragments :many
SELECT id, knowledge_code, document_code, content,
       COALESCE(metadata, CAST('null' AS JSON)) AS metadata, business_id,
       sync_status, sync_times, sync_status_message, point_id, word_count,
       created_uid, updated_uid, created_at, updated_at, deleted_at
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND (sqlc.narg(knowledge_code) IS NULL OR knowledge_code = sqlc.narg(knowledge_code))
  AND (sqlc.narg(document_code) IS NULL OR document_code = sqlc.narg(document_code))
  AND (sqlc.narg(business_id) IS NULL OR business_id = sqlc.narg(business_id))
  AND (sqlc.narg(content_like) IS NULL OR content LIKE sqlc.narg(content_like))
  AND (sqlc.narg(sync_status) IS NULL OR sync_status = sqlc.narg(sync_status))
ORDER BY id ASC
LIMIT ? OFFSET ?;

-- name: ListPendingFragments :many
SELECT id, knowledge_code, document_code, content,
       COALESCE(metadata, CAST('null' AS JSON)) AS metadata, business_id,
       sync_status, sync_times, sync_status_message, point_id, word_count,
       created_uid, updated_uid, created_at, updated_at, deleted_at
FROM magic_flow_knowledge_fragment
WHERE knowledge_code = ?
  AND sync_status IN (?, ?)
  AND deleted_at IS NULL
ORDER BY id ASC
LIMIT ?;

-- name: DeleteFragmentByID :execrows
DELETE FROM magic_flow_knowledge_fragment
WHERE id = ?;

-- name: DeleteFragmentsByDocument :execrows
DELETE FROM magic_flow_knowledge_fragment
WHERE knowledge_code = ?
  AND document_code = ?;

-- name: CountFragmentsByKnowledgeAndDocument :one
SELECT COUNT(*)
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND knowledge_code = ?
  AND document_code = ?;

-- name: ListFragmentsByKnowledgeAndDocument :many
SELECT id, knowledge_code, document_code, content,
       COALESCE(metadata, CAST('null' AS JSON)) AS metadata, business_id,
       sync_status, sync_times, sync_status_message, point_id, word_count,
       created_uid, updated_uid, created_at, updated_at, deleted_at
FROM magic_flow_knowledge_fragment
WHERE deleted_at IS NULL
  AND knowledge_code = ?
  AND document_code = ?
ORDER BY id ASC
LIMIT ? OFFSET ?;

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
SELECT id, knowledge_code, document_code, content,
       COALESCE(metadata, CAST('null' AS JSON)) AS metadata, business_id,
       sync_status, sync_times, sync_status_message, point_id, word_count,
       created_uid, updated_uid, created_at, updated_at, deleted_at
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

-- name: ListThirdFileRepairOrganizationCodes :many
SELECT DISTINCT kb.organization_code
FROM magic_flow_knowledge_fragment AS f
INNER JOIN magic_flow_knowledge AS kb
	ON kb.code = f.knowledge_code
	AND kb.deleted_at IS NULL
WHERE f.deleted_at IS NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(f.metadata, '$.file_id')) <> ''
ORDER BY kb.organization_code ASC;

-- name: ListThirdFileRepairGroups :many
SELECT
	f.knowledge_code,
	JSON_UNQUOTE(JSON_EXTRACT(f.metadata, '$.file_id')) AS third_file_id,
	COALESCE(MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(f.metadata, '$.knowledge_base_id')), '')), '') AS knowledge_base_id,
	COALESCE(
		MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(f.metadata, '$.group_ref')), '')),
		MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(f.metadata, '$.folder_id')), '')),
		MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(f.metadata, '$.parent_id')), '')),
		''
	) AS group_ref,
	COALESCE(MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(f.metadata, '$.third_file_type')), '')), '') AS third_file_type,
	COALESCE(MIN(NULLIF(f.document_code, '')), '') AS document_code,
	COALESCE(MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(f.metadata, '$.document_name')), '')), '') AS document_name,
	COALESCE(MIN(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(f.metadata, '$.url')), '')), '') AS preview_url,
	COALESCE(MIN(NULLIF(f.created_uid, '')), '') AS created_uid,
	COALESCE(MIN(NULLIF(f.updated_uid, '')), '') AS updated_uid,
	COUNT(*) AS fragment_count,
	COALESCE(SUM(CASE WHEN f.document_code = '' OR f.document_code IS NULL THEN 1 ELSE 0 END), 0) AS missing_document_code_count
FROM magic_flow_knowledge_fragment AS f
INNER JOIN magic_flow_knowledge AS kb
	ON kb.code = f.knowledge_code
	AND kb.deleted_at IS NULL
WHERE f.deleted_at IS NULL
  AND kb.organization_code = ?
  AND JSON_UNQUOTE(JSON_EXTRACT(f.metadata, '$.file_id')) <> ''
GROUP BY f.knowledge_code, JSON_UNQUOTE(JSON_EXTRACT(f.metadata, '$.file_id'))
ORDER BY f.knowledge_code ASC, third_file_id ASC
LIMIT ? OFFSET ?;

-- name: BackfillDocumentCodeByThirdFile :execrows
UPDATE magic_flow_knowledge_fragment AS f
INNER JOIN magic_flow_knowledge AS kb
	ON kb.code = f.knowledge_code
	AND kb.deleted_at IS NULL
SET f.document_code = ?,
    f.updated_at = ?
WHERE f.deleted_at IS NULL
  AND (f.document_code = '' OR f.document_code IS NULL)
  AND kb.organization_code = ?
  AND f.knowledge_code = ?
  AND JSON_UNQUOTE(JSON_EXTRACT(f.metadata, '$.file_id')) = CAST(sqlc.arg(third_file_id) AS CHAR(255));
