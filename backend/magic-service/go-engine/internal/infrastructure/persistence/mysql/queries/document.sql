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

-- name: UpdateDocumentSyncStatus :execrows
UPDATE knowledge_base_documents
SET sync_status = ?,
    sync_status_message = ?,
    updated_at = ?
WHERE id = ?
  AND deleted_at IS NULL;

-- name: FindDocumentByID :one
SELECT id, organization_code, knowledge_base_code, source_binding_id, source_item_id, auto_added, name, description, code,
       enabled, doc_type, doc_metadata, document_file, sync_status, sync_times, sync_status_message, embedding_model, vector_db,
       retrieve_config, fragment_config, embedding_config, vector_db_config, word_count, third_platform_type, third_file_id,
       created_uid, updated_uid, created_at, updated_at, deleted_at
FROM knowledge_base_documents
WHERE id = ?
  AND deleted_at IS NULL;

-- name: FindDocumentByCode :one
SELECT id, organization_code, knowledge_base_code, source_binding_id, source_item_id, auto_added, name, description, code,
       enabled, doc_type, doc_metadata, document_file, sync_status, sync_times, sync_status_message, embedding_model, vector_db,
       retrieve_config, fragment_config, embedding_config, vector_db_config, word_count, third_platform_type, third_file_id,
       created_uid, updated_uid, created_at, updated_at, deleted_at
FROM knowledge_base_documents
WHERE code = ?
  AND deleted_at IS NULL
ORDER BY id DESC
LIMIT 1;

-- name: FindDocumentByCodeAndKnowledgeBase :one
SELECT id, organization_code, knowledge_base_code, source_binding_id, source_item_id, auto_added, name, description, code,
       enabled, doc_type, doc_metadata, document_file, sync_status, sync_times, sync_status_message, embedding_model, vector_db,
       retrieve_config, fragment_config, embedding_config, vector_db_config, word_count, third_platform_type, third_file_id,
       created_uid, updated_uid, created_at, updated_at, deleted_at
FROM knowledge_base_documents
WHERE code = ?
  AND knowledge_base_code = ?
  AND deleted_at IS NULL
ORDER BY id DESC
LIMIT 1;

-- name: FindDocumentByThirdFile :one
SELECT id, organization_code, knowledge_base_code, source_binding_id, source_item_id, auto_added, name, description, code,
       enabled, doc_type, doc_metadata, document_file, sync_status, sync_times, sync_status_message, embedding_model, vector_db,
       retrieve_config, fragment_config, embedding_config, vector_db_config, word_count, third_platform_type, third_file_id,
       created_uid, updated_uid, created_at, updated_at, deleted_at
FROM knowledge_base_documents
WHERE third_platform_type = ?
  AND third_file_id = ?
  AND deleted_at IS NULL
ORDER BY id DESC
LIMIT 1;

-- name: FindDocumentByKnowledgeBaseAndProjectFile :one
SELECT d.id, d.organization_code, d.knowledge_base_code, d.source_binding_id, d.source_item_id, d.auto_added, d.name, d.description, d.code,
       d.enabled, d.doc_type, d.doc_metadata, d.document_file, d.sync_status, d.sync_times, d.sync_status_message, d.embedding_model, d.vector_db,
       d.retrieve_config, d.fragment_config, d.embedding_config, d.vector_db_config, d.word_count, d.third_platform_type, d.third_file_id,
       d.created_uid, d.updated_uid, d.created_at, d.updated_at, d.deleted_at
FROM knowledge_base_documents d
INNER JOIN knowledge_source_bindings b ON b.id = d.source_binding_id
INNER JOIN knowledge_source_items si ON si.id = d.source_item_id
WHERE d.knowledge_base_code = ?
  AND b.provider = 'project'
  AND si.item_ref = ?
  AND d.deleted_at IS NULL
ORDER BY d.id DESC
LIMIT 1;

-- name: ListDocumentsBySourceFileID :many
SELECT id, organization_code, knowledge_base_code, source_binding_id, source_item_id, auto_added, name, description, code,
       enabled, doc_type, doc_metadata, document_file, sync_status, sync_times, sync_status_message, embedding_model, vector_db,
       retrieve_config, fragment_config, embedding_config, vector_db_config, word_count, third_platform_type, third_file_id,
       created_uid, updated_uid, created_at, updated_at, deleted_at
FROM knowledge_base_documents
WHERE source_item_id = ?
  AND deleted_at IS NULL
ORDER BY id DESC;

-- name: ListDocumentsByKnowledgeBaseAndProject :many
SELECT d.id, d.organization_code, d.knowledge_base_code, d.source_binding_id, d.source_item_id, d.auto_added, d.name, d.description, d.code,
       d.enabled, d.doc_type, d.doc_metadata, d.document_file, d.sync_status, d.sync_times, d.sync_status_message, d.embedding_model, d.vector_db,
       d.retrieve_config, d.fragment_config, d.embedding_config, d.vector_db_config, d.word_count, d.third_platform_type, d.third_file_id,
       d.created_uid, d.updated_uid, d.created_at, d.updated_at, d.deleted_at
FROM knowledge_base_documents d
INNER JOIN knowledge_source_bindings b ON b.id = d.source_binding_id
WHERE d.knowledge_base_code = ?
  AND b.provider = 'project'
  AND b.root_ref = ?
  AND d.deleted_at IS NULL
ORDER BY d.id DESC;

-- name: CountDocuments :one
SELECT COUNT(*)
FROM knowledge_base_documents d
WHERE d.deleted_at IS NULL
  AND (sqlc.narg(organization_code) IS NULL OR d.organization_code = sqlc.narg(organization_code))
  AND (sqlc.narg(knowledge_base_code) IS NULL OR d.knowledge_base_code = sqlc.narg(knowledge_base_code))
  AND (sqlc.narg(name_like) IS NULL OR d.name LIKE sqlc.narg(name_like))
  AND (sqlc.narg(doc_type) IS NULL OR d.doc_type = sqlc.narg(doc_type))
  AND (sqlc.narg(enabled) IS NULL OR d.enabled = sqlc.narg(enabled))
  AND (sqlc.narg(sync_status) IS NULL OR d.sync_status = sqlc.narg(sync_status));

-- name: ListDocuments :many
SELECT id, organization_code, knowledge_base_code, source_binding_id, source_item_id, auto_added, name, description, code,
       enabled, doc_type, doc_metadata, document_file, sync_status, sync_times, sync_status_message, embedding_model, vector_db,
       retrieve_config, fragment_config, embedding_config, vector_db_config, word_count, third_platform_type, third_file_id,
       created_uid, updated_uid, created_at, updated_at, deleted_at
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND (sqlc.narg(organization_code) IS NULL OR organization_code = sqlc.narg(organization_code))
  AND (sqlc.narg(knowledge_base_code) IS NULL OR knowledge_base_code = sqlc.narg(knowledge_base_code))
  AND (sqlc.narg(name_like) IS NULL OR name LIKE sqlc.narg(name_like))
  AND (sqlc.narg(doc_type) IS NULL OR doc_type = sqlc.narg(doc_type))
  AND (sqlc.narg(enabled) IS NULL OR enabled = sqlc.narg(enabled))
  AND (sqlc.narg(sync_status) IS NULL OR sync_status = sqlc.narg(sync_status))
ORDER BY id DESC
LIMIT ? OFFSET ?;

-- name: CountDocumentsByKnowledgeBaseCodes :many
SELECT knowledge_base_code, COUNT(*) AS count
FROM knowledge_base_documents
WHERE deleted_at IS NULL
  AND organization_code = ?
  AND knowledge_base_code IN (sqlc.slice(knowledge_base_codes))
GROUP BY knowledge_base_code;

-- name: FindDocumentByIDCompat :one
SELECT d.id, d.organization_code, d.knowledge_base_code, d.source_binding_id, d.source_item_id, d.auto_added, d.name, d.description, d.code,
       d.enabled, d.doc_type, COALESCE(d.doc_metadata, CAST('null' AS JSON)) AS doc_metadata, COALESCE(d.document_file, CAST('null' AS JSON)) AS document_file,
       d.sync_status, d.sync_times, d.sync_status_message, d.embedding_model, d.vector_db,
       COALESCE(d.retrieve_config, CAST('null' AS JSON)) AS retrieve_config, COALESCE(d.fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(d.embedding_config, CAST('null' AS JSON)) AS embedding_config, COALESCE(d.vector_db_config, CAST('null' AS JSON)) AS vector_db_config,
       d.word_count, d.third_platform_type, d.third_file_id, d.created_uid, d.updated_uid, d.created_at, d.updated_at, d.deleted_at,
       COALESCE(b.provider, '') AS source_provider, COALESCE(b.root_ref, '') AS binding_root_ref, COALESCE(si.item_ref, '') AS source_item_ref
FROM knowledge_base_documents d
LEFT JOIN knowledge_source_bindings b ON b.id = d.source_binding_id
LEFT JOIN knowledge_source_items si ON si.id = d.source_item_id
WHERE d.id = ?
  AND d.deleted_at IS NULL
LIMIT 1;

-- name: FindDocumentByCodeCompat :one
SELECT d.id, d.organization_code, d.knowledge_base_code, d.source_binding_id, d.source_item_id, d.auto_added, d.name, d.description, d.code,
       d.enabled, d.doc_type, COALESCE(d.doc_metadata, CAST('null' AS JSON)) AS doc_metadata, COALESCE(d.document_file, CAST('null' AS JSON)) AS document_file,
       d.sync_status, d.sync_times, d.sync_status_message, d.embedding_model, d.vector_db,
       COALESCE(d.retrieve_config, CAST('null' AS JSON)) AS retrieve_config, COALESCE(d.fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(d.embedding_config, CAST('null' AS JSON)) AS embedding_config, COALESCE(d.vector_db_config, CAST('null' AS JSON)) AS vector_db_config,
       d.word_count, d.third_platform_type, d.third_file_id, d.created_uid, d.updated_uid, d.created_at, d.updated_at, d.deleted_at,
       COALESCE(b.provider, '') AS source_provider, COALESCE(b.root_ref, '') AS binding_root_ref, COALESCE(si.item_ref, '') AS source_item_ref
FROM knowledge_base_documents d
LEFT JOIN knowledge_source_bindings b ON b.id = d.source_binding_id
LEFT JOIN knowledge_source_items si ON si.id = d.source_item_id
WHERE d.code = ?
  AND d.deleted_at IS NULL
ORDER BY d.id DESC
LIMIT 1;

-- name: FindDocumentByCodeAndKnowledgeBaseCompat :one
SELECT d.id, d.organization_code, d.knowledge_base_code, d.source_binding_id, d.source_item_id, d.auto_added, d.name, d.description, d.code,
       d.enabled, d.doc_type, COALESCE(d.doc_metadata, CAST('null' AS JSON)) AS doc_metadata, COALESCE(d.document_file, CAST('null' AS JSON)) AS document_file,
       d.sync_status, d.sync_times, d.sync_status_message, d.embedding_model, d.vector_db,
       COALESCE(d.retrieve_config, CAST('null' AS JSON)) AS retrieve_config, COALESCE(d.fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(d.embedding_config, CAST('null' AS JSON)) AS embedding_config, COALESCE(d.vector_db_config, CAST('null' AS JSON)) AS vector_db_config,
       d.word_count, d.third_platform_type, d.third_file_id, d.created_uid, d.updated_uid, d.created_at, d.updated_at, d.deleted_at,
       COALESCE(b.provider, '') AS source_provider, COALESCE(b.root_ref, '') AS binding_root_ref, COALESCE(si.item_ref, '') AS source_item_ref
FROM knowledge_base_documents d
LEFT JOIN knowledge_source_bindings b ON b.id = d.source_binding_id
LEFT JOIN knowledge_source_items si ON si.id = d.source_item_id
WHERE d.code = ?
  AND d.knowledge_base_code = ?
  AND d.deleted_at IS NULL
ORDER BY d.id DESC
LIMIT 1;

-- name: FindDocumentByThirdFileCompat :one
SELECT d.id, d.organization_code, d.knowledge_base_code, d.source_binding_id, d.source_item_id, d.auto_added, d.name, d.description, d.code,
       d.enabled, d.doc_type, COALESCE(d.doc_metadata, CAST('null' AS JSON)) AS doc_metadata, COALESCE(d.document_file, CAST('null' AS JSON)) AS document_file,
       d.sync_status, d.sync_times, d.sync_status_message, d.embedding_model, d.vector_db,
       COALESCE(d.retrieve_config, CAST('null' AS JSON)) AS retrieve_config, COALESCE(d.fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(d.embedding_config, CAST('null' AS JSON)) AS embedding_config, COALESCE(d.vector_db_config, CAST('null' AS JSON)) AS vector_db_config,
       d.word_count, d.third_platform_type, d.third_file_id, d.created_uid, d.updated_uid, d.created_at, d.updated_at, d.deleted_at,
       COALESCE(b.provider, '') AS source_provider, COALESCE(b.root_ref, '') AS binding_root_ref, COALESCE(si.item_ref, '') AS source_item_ref
FROM knowledge_base_documents d
LEFT JOIN knowledge_source_bindings b ON b.id = d.source_binding_id
LEFT JOIN knowledge_source_items si ON si.id = d.source_item_id
WHERE d.third_platform_type = ?
  AND d.third_file_id = ?
  AND d.deleted_at IS NULL
ORDER BY d.id DESC
LIMIT 1;

-- name: FindDocumentByKnowledgeBaseAndProjectFileCompat :one
SELECT d.id, d.organization_code, d.knowledge_base_code, d.source_binding_id, d.source_item_id, d.auto_added, d.name, d.description, d.code,
       d.enabled, d.doc_type, COALESCE(d.doc_metadata, CAST('null' AS JSON)) AS doc_metadata, COALESCE(d.document_file, CAST('null' AS JSON)) AS document_file,
       d.sync_status, d.sync_times, d.sync_status_message, d.embedding_model, d.vector_db,
       COALESCE(d.retrieve_config, CAST('null' AS JSON)) AS retrieve_config, COALESCE(d.fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(d.embedding_config, CAST('null' AS JSON)) AS embedding_config, COALESCE(d.vector_db_config, CAST('null' AS JSON)) AS vector_db_config,
       d.word_count, d.third_platform_type, d.third_file_id, d.created_uid, d.updated_uid, d.created_at, d.updated_at, d.deleted_at,
       COALESCE(b.provider, '') AS source_provider, COALESCE(b.root_ref, '') AS binding_root_ref, COALESCE(si.item_ref, '') AS source_item_ref
FROM knowledge_base_documents d
INNER JOIN knowledge_source_bindings b ON b.id = d.source_binding_id
INNER JOIN knowledge_source_items si ON si.id = d.source_item_id
WHERE d.knowledge_base_code = ?
  AND b.provider = 'project'
  AND si.item_ref = ?
  AND d.deleted_at IS NULL
ORDER BY d.id DESC
LIMIT 1;

-- name: ListDocumentsByKnowledgeBaseAndProjectCompat :many
SELECT d.id, d.organization_code, d.knowledge_base_code, d.source_binding_id, d.source_item_id, d.auto_added, d.name, d.description, d.code,
       d.enabled, d.doc_type, COALESCE(d.doc_metadata, CAST('null' AS JSON)) AS doc_metadata, COALESCE(d.document_file, CAST('null' AS JSON)) AS document_file,
       d.sync_status, d.sync_times, d.sync_status_message, d.embedding_model, d.vector_db,
       COALESCE(d.retrieve_config, CAST('null' AS JSON)) AS retrieve_config, COALESCE(d.fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(d.embedding_config, CAST('null' AS JSON)) AS embedding_config, COALESCE(d.vector_db_config, CAST('null' AS JSON)) AS vector_db_config,
       d.word_count, d.third_platform_type, d.third_file_id, d.created_uid, d.updated_uid, d.created_at, d.updated_at, d.deleted_at,
       COALESCE(b.provider, '') AS source_provider, COALESCE(b.root_ref, '') AS binding_root_ref, COALESCE(si.item_ref, '') AS source_item_ref
FROM knowledge_base_documents d
INNER JOIN knowledge_source_bindings b ON b.id = d.source_binding_id
LEFT JOIN knowledge_source_items si ON si.id = d.source_item_id
WHERE d.knowledge_base_code = ?
  AND b.provider = 'project'
  AND b.root_ref = ?
  AND d.deleted_at IS NULL
ORDER BY d.id DESC;

-- name: ListDocumentsByProjectFileInOrgCompat :many
SELECT d.id, d.organization_code, d.knowledge_base_code, d.source_binding_id, d.source_item_id, d.auto_added, d.name, d.description, d.code,
       d.enabled, d.doc_type, COALESCE(d.doc_metadata, CAST('null' AS JSON)) AS doc_metadata, COALESCE(d.document_file, CAST('null' AS JSON)) AS document_file,
       d.sync_status, d.sync_times, d.sync_status_message, d.embedding_model, d.vector_db,
       COALESCE(d.retrieve_config, CAST('null' AS JSON)) AS retrieve_config, COALESCE(d.fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(d.embedding_config, CAST('null' AS JSON)) AS embedding_config, COALESCE(d.vector_db_config, CAST('null' AS JSON)) AS vector_db_config,
       d.word_count, d.third_platform_type, d.third_file_id, d.created_uid, d.updated_uid, d.created_at, d.updated_at, d.deleted_at,
       COALESCE(b.provider, '') AS source_provider, COALESCE(b.root_ref, '') AS binding_root_ref, COALESCE(si.item_ref, '') AS source_item_ref
FROM knowledge_base_documents d
INNER JOIN knowledge_source_bindings b ON b.id = d.source_binding_id
INNER JOIN knowledge_source_items si ON si.id = d.source_item_id
WHERE d.organization_code = ?
  AND b.provider = 'project'
  AND si.item_ref = ?
  AND d.deleted_at IS NULL
ORDER BY d.id DESC;

-- name: FindDocumentIncludingDeletedCompat :one
SELECT d.id, d.organization_code, d.knowledge_base_code, d.source_binding_id, d.source_item_id, d.auto_added, d.name, d.description, d.code,
       d.enabled, d.doc_type, COALESCE(d.doc_metadata, CAST('null' AS JSON)) AS doc_metadata, COALESCE(d.document_file, CAST('null' AS JSON)) AS document_file,
       d.sync_status, d.sync_times, d.sync_status_message, d.embedding_model, d.vector_db,
       COALESCE(d.retrieve_config, CAST('null' AS JSON)) AS retrieve_config, COALESCE(d.fragment_config, CAST('null' AS JSON)) AS fragment_config,
       COALESCE(d.embedding_config, CAST('null' AS JSON)) AS embedding_config, COALESCE(d.vector_db_config, CAST('null' AS JSON)) AS vector_db_config,
       d.word_count, d.third_platform_type, d.third_file_id, d.created_uid, d.updated_uid, d.created_at, d.updated_at, d.deleted_at,
       COALESCE(b.provider, '') AS source_provider, COALESCE(b.root_ref, '') AS binding_root_ref, COALESCE(si.item_ref, '') AS source_item_ref
FROM knowledge_base_documents d
LEFT JOIN knowledge_source_bindings b ON b.id = d.source_binding_id
LEFT JOIN knowledge_source_items si ON si.id = d.source_item_id
WHERE d.knowledge_base_code = ?
  AND d.code = ?
ORDER BY d.id DESC
LIMIT 1;
