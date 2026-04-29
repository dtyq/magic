-- name: InsertKnowledgeBaseBinding :exec
INSERT INTO knowledge_base_bindings
    (knowledge_base_code, bind_type, bind_id, organization_code, created_uid, updated_uid, created_at, updated_at)
VALUES
    (?, ?, ?, ?, ?, ?, ?, ?);

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
