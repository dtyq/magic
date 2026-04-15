-- name: FindTaskFileMetaByID :one
SELECT organization_code,
       project_id,
       file_id,
       COALESCE(file_key, '') AS file_key,
       file_name,
       COALESCE(file_extension, '') AS file_extension,
       COALESCE(file_size, 0) AS file_size,
       COALESCE(is_directory, FALSE) AS is_directory,
       COALESCE(is_hidden, FALSE) AS is_hidden,
       updated_at,
       deleted_at,
       COALESCE(parent_id, 0) AS parent_id
FROM magic_super_agent_task_files
WHERE file_id = ?
LIMIT 1;

-- name: FindTaskFileRootDirectoryByProjectID :one
SELECT organization_code,
       project_id,
       file_id,
       COALESCE(file_key, '') AS file_key,
       file_name,
       COALESCE(file_extension, '') AS file_extension,
       COALESCE(file_size, 0) AS file_size,
       COALESCE(is_directory, FALSE) AS is_directory,
       COALESCE(is_hidden, FALSE) AS is_hidden,
       updated_at,
       deleted_at,
       COALESCE(parent_id, 0) AS parent_id
FROM magic_super_agent_task_files
WHERE project_id = ?
  AND parent_id IS NULL
  AND is_directory = TRUE
  AND deleted_at IS NULL
ORDER BY file_id DESC
LIMIT 1;

-- name: ListVisibleTaskFileChildrenByParent :many
SELECT organization_code,
       project_id,
       file_id,
       COALESCE(file_key, '') AS file_key,
       file_name,
       COALESCE(file_extension, '') AS file_extension,
       COALESCE(file_size, 0) AS file_size,
       COALESCE(is_directory, FALSE) AS is_directory,
       COALESCE(is_hidden, FALSE) AS is_hidden,
       updated_at,
       deleted_at,
       COALESCE(parent_id, 0) AS parent_id
FROM magic_super_agent_task_files
WHERE project_id = ?
  AND parent_id = ?
  AND is_hidden = FALSE
  AND deleted_at IS NULL
LIMIT ?;

-- name: ListVisibleTaskFileChildrenByParents :many
SELECT organization_code,
       project_id,
       file_id,
       COALESCE(file_key, '') AS file_key,
       file_name,
       COALESCE(file_extension, '') AS file_extension,
       COALESCE(file_size, 0) AS file_size,
       COALESCE(is_directory, FALSE) AS is_directory,
       COALESCE(is_hidden, FALSE) AS is_hidden,
       updated_at,
       deleted_at,
       COALESCE(parent_id, 0) AS parent_id
FROM magic_super_agent_task_files
WHERE project_id = ?
  AND parent_id IN (sqlc.slice(parent_ids))
  AND is_hidden = FALSE
  AND deleted_at IS NULL
LIMIT ?;

-- name: FindProjectFileMetaByID :one
SELECT organization_code,
       project_id,
       file_id,
       COALESCE(file_key, '') AS file_key,
       file_name,
       COALESCE(file_extension, '') AS file_extension,
       COALESCE(file_size, 0) AS file_size,
       updated_at
FROM magic_super_agent_project_files
WHERE file_id = ?
LIMIT 1;
