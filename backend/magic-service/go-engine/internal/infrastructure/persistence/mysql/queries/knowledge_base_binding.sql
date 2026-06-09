-- name: InsertKnowledgeBaseBinding :exec
INSERT INTO knowledge_base_bindings
    (knowledge_base_code, bind_type, bind_id, organization_code, created_uid, updated_uid, created_at, updated_at)
VALUES
    (?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpsertKnowledgeBaseBinding :exec
INSERT INTO knowledge_base_bindings
    (knowledge_base_code, bind_type, bind_id, organization_code, created_uid, updated_uid, created_at, updated_at)
VALUES
    (?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
    organization_code = VALUES(organization_code),
    updated_uid = VALUES(updated_uid),
    updated_at = VALUES(updated_at);

-- name: DeleteKnowledgeBaseBindingsByCodeAndType :execrows
DELETE FROM knowledge_base_bindings
WHERE knowledge_base_code = ?
  AND bind_type = ?;

-- name: DeleteKnowledgeBaseBindingsByCode :execrows
DELETE FROM knowledge_base_bindings
WHERE knowledge_base_code = ?;

-- name: ListKnowledgeBaseBindingIDs :many
SELECT bind_id
FROM knowledge_base_bindings
WHERE knowledge_base_code = ?
  AND bind_type = ?
ORDER BY id ASC;

-- name: ListKnowledgeBaseBindingIDsByOrgAndCode :many
SELECT bind_id
FROM knowledge_base_bindings
WHERE organization_code = ?
  AND knowledge_base_code = ?
  AND bind_type = ?
ORDER BY id ASC;

-- name: ListKnowledgeBaseBindingPairsByCodes :many
SELECT knowledge_base_code, bind_id
FROM knowledge_base_bindings
WHERE bind_type = ?
  AND knowledge_base_code IN (sqlc.slice(knowledge_base_codes))
ORDER BY id ASC;

-- name: ListKnowledgeBaseCodesByBindID :many
SELECT knowledge_base_code
FROM knowledge_base_bindings
WHERE bind_type = ?
  AND bind_id = ?
  AND organization_code = ?
ORDER BY id ASC;

-- name: ListKnowledgeBaseBindingsByBindID :many
SELECT knowledge_base_code, metadata
FROM knowledge_base_bindings
WHERE bind_type = ?
  AND bind_id = ?
  AND organization_code = ?
ORDER BY id ASC;

-- name: ListKnowledgeBaseBindingsByBindIDs :many
SELECT knowledge_base_code, metadata
FROM knowledge_base_bindings
WHERE bind_type = ?
  AND bind_id IN (sqlc.slice(bind_ids))
  AND organization_code = ?
ORDER BY id ASC;

-- name: GetFlowKnowledgeBaseBindingByBindIDAndCode :one
SELECT kbb.knowledge_base_code, kbb.metadata
FROM knowledge_base_bindings AS kbb
JOIN magic_flow_knowledge AS kb
  ON kb.code = kbb.knowledge_base_code
 AND kb.organization_code = kbb.organization_code
WHERE kbb.organization_code = ?
  AND kbb.bind_type = ?
  AND kbb.bind_id = ?
  AND kbb.knowledge_base_code = ?
  AND kb.knowledge_base_type = ?
  AND kb.deleted_at IS NULL
LIMIT 1;

-- name: GetFlowKnowledgeBaseBindingByBindIDAndCodeForUpdate :one
SELECT kbb.knowledge_base_code, kbb.metadata
FROM knowledge_base_bindings AS kbb
JOIN magic_flow_knowledge AS kb
  ON kb.code = kbb.knowledge_base_code
 AND kb.organization_code = kbb.organization_code
WHERE kbb.organization_code = ?
  AND kbb.bind_type = ?
  AND kbb.bind_id = ?
  AND kbb.knowledge_base_code = ?
  AND kb.knowledge_base_type = ?
  AND kb.deleted_at IS NULL
LIMIT 1
FOR UPDATE;

-- name: UpdateKnowledgeBaseBindingMetadataByBindIDAndCode :execrows
UPDATE knowledge_base_bindings
SET metadata = ?,
    updated_uid = ?,
    updated_at = ?
WHERE organization_code = ?
  AND bind_type = ?
  AND bind_id = ?
  AND knowledge_base_code = ?;

-- name: DeleteFlowKnowledgeBaseBindingsByBindIDAndCodes :execrows
DELETE kbb
FROM knowledge_base_bindings AS kbb
JOIN magic_flow_knowledge AS kb
  ON kb.code = kbb.knowledge_base_code
 AND kb.organization_code = kbb.organization_code
WHERE kbb.organization_code = ?
  AND kbb.bind_type = ?
  AND kbb.bind_id = ?
  AND kbb.knowledge_base_code IN (sqlc.slice(knowledge_base_codes))
  AND kb.knowledge_base_type = ?
  AND kb.deleted_at IS NULL;
