-- name: UpsertKnowledgeBaseIngestionSource :execresult
INSERT INTO knowledge_base_ingestion_sources (
    organization_code, provider, source_code, name, enabled, credential_ref,
    config, sync_cursor, last_sync_status, last_sync_error, last_synced_at,
    created_uid, updated_uid, created_at, updated_at
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    enabled = VALUES(enabled),
    credential_ref = VALUES(credential_ref),
    config = VALUES(config),
    sync_cursor = VALUES(sync_cursor),
    last_sync_status = VALUES(last_sync_status),
    last_sync_error = VALUES(last_sync_error),
    last_synced_at = VALUES(last_synced_at),
    updated_uid = VALUES(updated_uid),
    updated_at = VALUES(updated_at);

-- name: GetKnowledgeBaseIngestionSourceByCode :one
SELECT *
FROM knowledge_base_ingestion_sources
WHERE organization_code = sqlc.arg(organization_code)
  AND provider = sqlc.arg(provider)
  AND source_code = sqlc.arg(source_code)
LIMIT 1;

-- name: ListEnabledKnowledgeBaseIngestionSources :many
SELECT *
FROM knowledge_base_ingestion_sources
WHERE organization_code = sqlc.arg(organization_code)
  AND provider = sqlc.arg(provider)
  AND enabled = TRUE
ORDER BY id ASC
LIMIT ?
OFFSET ?;

-- name: CountEnabledKnowledgeBaseIngestionSources :one
SELECT COUNT(*)
FROM knowledge_base_ingestion_sources
WHERE organization_code = sqlc.arg(organization_code)
  AND provider = sqlc.arg(provider)
  AND enabled = TRUE;

-- name: TryAcquireKnowledgeBaseIngestionSourceSync :execrows
UPDATE knowledge_base_ingestion_sources
SET last_sync_status = 'running',
    last_sync_error = '',
    updated_at = sqlc.arg(updated_at)
WHERE organization_code = sqlc.arg(organization_code)
  AND provider = sqlc.arg(provider)
  AND source_code = sqlc.arg(source_code)
  AND enabled = TRUE
  AND (
    last_sync_status <> 'running'
    OR updated_at < sqlc.arg(stale_before)
  );

-- name: ReleaseKnowledgeBaseIngestionSourceSync :execrows
UPDATE knowledge_base_ingestion_sources
SET last_sync_status = sqlc.arg(last_sync_status),
    last_sync_error = sqlc.arg(last_sync_error),
    updated_at = sqlc.arg(updated_at)
WHERE organization_code = sqlc.arg(organization_code)
  AND provider = sqlc.arg(provider)
  AND source_code = sqlc.arg(source_code)
  AND last_sync_status = 'running';

-- name: InsertKnowledgeBaseIngestionRun :execresult
INSERT INTO knowledge_base_ingestion_runs (
    organization_code, provider, source_code, run_type, status,
    pulled_count, changed_count, cleaned_count, skipped_count, failed_count,
    error_summary, started_at, finished_at
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
);

-- name: FinishKnowledgeBaseIngestionRun :execrows
UPDATE knowledge_base_ingestion_runs
SET status = sqlc.arg(status),
    pulled_count = sqlc.arg(pulled_count),
    changed_count = sqlc.arg(changed_count),
    cleaned_count = sqlc.arg(cleaned_count),
    skipped_count = sqlc.arg(skipped_count),
    failed_count = sqlc.arg(failed_count),
    error_summary = sqlc.arg(error_summary),
    finished_at = sqlc.arg(finished_at)
WHERE id = sqlc.arg(id);

-- name: UpdateKnowledgeBaseIngestionSourceSyncStatus :execrows
UPDATE knowledge_base_ingestion_sources
SET sync_cursor = sqlc.arg(sync_cursor),
    last_sync_status = sqlc.arg(last_sync_status),
    last_sync_error = sqlc.arg(last_sync_error),
    last_synced_at = sqlc.arg(last_synced_at),
    updated_at = sqlc.arg(updated_at)
WHERE organization_code = sqlc.arg(organization_code)
  AND provider = sqlc.arg(provider)
  AND source_code = sqlc.arg(source_code);

-- name: UpsertKnowledgeBaseIngestionItem :execresult
INSERT INTO knowledge_base_ingestion_items (
    organization_code, provider, source_code, item_ref, item_type,
    title, source_url, extension, raw_hash, clean_hash, clean_size,
    cleaner_version, status, snapshot_meta, last_error,
    last_pulled_at, last_cleaned_at, created_at, updated_at
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)
ON DUPLICATE KEY UPDATE
    item_type = VALUES(item_type),
    title = VALUES(title),
    source_url = VALUES(source_url),
    extension = VALUES(extension),
    raw_hash = VALUES(raw_hash),
    clean_hash = VALUES(clean_hash),
    clean_size = VALUES(clean_size),
    cleaner_version = VALUES(cleaner_version),
    status = VALUES(status),
    snapshot_meta = VALUES(snapshot_meta),
    last_error = VALUES(last_error),
    last_pulled_at = VALUES(last_pulled_at),
    last_cleaned_at = VALUES(last_cleaned_at),
    updated_at = VALUES(updated_at);

-- name: GetKnowledgeBaseIngestionItemByRef :one
SELECT *
FROM knowledge_base_ingestion_items
WHERE organization_code = sqlc.arg(organization_code)
  AND provider = sqlc.arg(provider)
  AND source_code = sqlc.arg(source_code)
  AND item_ref = sqlc.arg(item_ref)
LIMIT 1;

-- name: ListKnowledgeBaseIngestionItemsByRefs :many
SELECT *
FROM knowledge_base_ingestion_items
WHERE organization_code = sqlc.arg(organization_code)
  AND provider = sqlc.arg(provider)
  AND source_code = sqlc.arg(source_code)
  AND item_ref IN (sqlc.slice(item_refs))
ORDER BY id ASC;

-- name: ListKnowledgeBaseIngestionItemsBySourceAndStatus :many
SELECT *
FROM knowledge_base_ingestion_items
WHERE organization_code = sqlc.arg(organization_code)
  AND provider = sqlc.arg(provider)
  AND source_code = sqlc.arg(source_code)
  AND status IN (sqlc.slice(statuses))
  AND id > sqlc.arg(after_id)
ORDER BY id ASC
LIMIT ?
OFFSET ?;

-- name: CountKnowledgeBaseIngestionItemsBySourceAndStatus :one
SELECT COUNT(*)
FROM knowledge_base_ingestion_items
WHERE organization_code = sqlc.arg(organization_code)
  AND provider = sqlc.arg(provider)
  AND source_code = sqlc.arg(source_code)
  AND status IN (sqlc.slice(statuses));

-- name: MarkKnowledgeBaseIngestionItemFailed :execrows
UPDATE knowledge_base_ingestion_items
SET status = 'failed',
    last_error = sqlc.arg(last_error),
    updated_at = sqlc.arg(updated_at)
WHERE organization_code = sqlc.arg(organization_code)
  AND provider = sqlc.arg(provider)
  AND source_code = sqlc.arg(source_code)
  AND item_ref = sqlc.arg(item_ref);

-- name: UpsertKnowledgeBaseIngestionItemContent :execresult
INSERT INTO knowledge_base_ingestion_item_contents (
    item_id, organization_code, provider, source_code, item_ref,
    clean_hash, content, content_format, content_charset, content_size,
    created_at, updated_at
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)
ON DUPLICATE KEY UPDATE
    organization_code = VALUES(organization_code),
    provider = VALUES(provider),
    source_code = VALUES(source_code),
    item_ref = VALUES(item_ref),
    clean_hash = VALUES(clean_hash),
    content = VALUES(content),
    content_format = VALUES(content_format),
    content_charset = VALUES(content_charset),
    content_size = VALUES(content_size),
    updated_at = VALUES(updated_at);

-- name: GetKnowledgeBaseIngestionItemContentByItemID :one
SELECT *
FROM knowledge_base_ingestion_item_contents
WHERE item_id = ?;

-- name: GetKnowledgeBaseIngestionItemContentByRef :one
SELECT *
FROM knowledge_base_ingestion_item_contents
WHERE organization_code = sqlc.arg(organization_code)
  AND provider = sqlc.arg(provider)
  AND source_code = sqlc.arg(source_code)
  AND item_ref = sqlc.arg(item_ref)
LIMIT 1;
