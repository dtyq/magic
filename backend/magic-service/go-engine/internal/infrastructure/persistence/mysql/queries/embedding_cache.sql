-- name: FindCacheByHash :one
SELECT id, text_hash, text_preview, text_length, embedding, embedding_model,
       vector_dimension, access_count, last_accessed_at, created_at, updated_at
FROM embedding_cache
WHERE text_hash = ?
  AND embedding_model = ?
LIMIT 1;

-- name: FindCachesByHashes :many
SELECT id, text_hash, text_preview, text_length, embedding, embedding_model,
       vector_dimension, access_count, last_accessed_at, created_at, updated_at
FROM embedding_cache
WHERE text_hash IN (sqlc.slice(text_hashes))
  AND embedding_model = ?;

-- name: InsertEmbeddingCache :execresult
INSERT INTO embedding_cache (
  text_hash, text_preview, text_length, embedding, embedding_model,
  vector_dimension, access_count, last_accessed_at, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: InsertEmbeddingCacheIgnore :execresult
INSERT IGNORE INTO embedding_cache (
  text_hash, text_preview, text_length, embedding, embedding_model,
  vector_dimension, access_count, last_accessed_at, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpsertOCRCache :execresult
INSERT INTO embedding_cache (
  text_hash, text_preview, text_length, embedding, embedding_model,
  vector_dimension, access_count, last_accessed_at, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  text_preview = VALUES(text_preview),
  text_length = VALUES(text_length),
  embedding = VALUES(embedding),
  vector_dimension = VALUES(vector_dimension),
  access_count = access_count + 1,
  last_accessed_at = VALUES(last_accessed_at),
  updated_at = VALUES(updated_at);

-- name: UpdateAccessByID :exec
UPDATE embedding_cache
SET access_count = access_count + 1,
    last_accessed_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- name: UpdateAccessByIDs :exec
UPDATE embedding_cache
SET access_count = access_count + 1,
    last_accessed_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE id IN (sqlc.slice(ids));

-- name: DeleteCacheByID :execrows
DELETE FROM embedding_cache WHERE id = ?;

-- name: DeleteCacheByHash :execrows
DELETE FROM embedding_cache WHERE text_hash = ?;

-- name: DeleteCachesByIDs :execrows
DELETE FROM embedding_cache WHERE id IN (sqlc.slice(ids));

-- name: GetCachesByModel :many
SELECT id, text_hash, text_preview, text_length, embedding, embedding_model,
       vector_dimension, access_count, last_accessed_at, created_at, updated_at
FROM embedding_cache
WHERE embedding_model = ?
ORDER BY created_at DESC, id DESC
LIMIT ? OFFSET ?;

-- name: CountByModel :one
SELECT COUNT(*) FROM embedding_cache WHERE embedding_model = ?;

-- name: GetLeastAccessed :many
SELECT id, text_hash, text_preview, text_length, embedding, embedding_model,
       vector_dimension, access_count, last_accessed_at, created_at, updated_at
FROM embedding_cache
ORDER BY last_accessed_at ASC, access_count ASC
LIMIT ?;

-- name: BasicStats :one
SELECT COUNT(*) AS total_caches,
       CAST(COALESCE(SUM(access_count), 0) AS SIGNED) AS total_access_count,
       CAST(COALESCE(AVG(access_count), 0) AS DOUBLE) AS average_access_count,
       COUNT(DISTINCT embedding_model) AS unique_models,
       COALESCE(CAST(MIN(created_at) AS DATETIME), CAST('1970-01-01 00:00:00' AS DATETIME)) AS oldest_cache,
       COALESCE(CAST(MAX(created_at) AS DATETIME), CAST('1970-01-01 00:00:00' AS DATETIME)) AS newest_cache,
       COALESCE(CAST(MAX(last_accessed_at) AS DATETIME), CAST('1970-01-01 00:00:00' AS DATETIME)) AS last_access_time
FROM embedding_cache;

-- name: ModelStats :many
SELECT embedding_model, COUNT(*) AS count
FROM embedding_cache
GROUP BY embedding_model;

-- name: EstimateStorage :one
SELECT CAST(COALESCE(SUM(LENGTH(embedding) + LENGTH(text_preview)), 0) AS SIGNED) AS storage_size
FROM embedding_cache;
