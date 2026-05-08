-- name: FindTaskFileMetaByID :one
SELECT *
FROM magic_super_agent_task_files
WHERE file_id = ?
LIMIT 1;

-- name: FindTaskFileRootDirectoryByProjectID :one
SELECT *
FROM magic_super_agent_task_files
WHERE project_id = ?
  AND parent_id IS NULL
  AND is_directory = TRUE
  AND deleted_at IS NULL
ORDER BY file_id DESC
LIMIT 1;

-- name: ListVisibleTaskFileChildrenByParent :many
SELECT *
FROM magic_super_agent_task_files
WHERE project_id = ?
  AND parent_id = ?
  AND is_hidden = FALSE
  AND deleted_at IS NULL
ORDER BY sort ASC, file_id ASC
LIMIT ?;

-- name: ListVisibleTaskFileChildrenByParentAfter :many
SELECT *
FROM magic_super_agent_task_files
WHERE project_id = ?
  AND parent_id = ?
  AND is_hidden = FALSE
  AND deleted_at IS NULL
  AND (
    sort > ?
    OR (sort = ? AND file_id > ?)
  )
ORDER BY sort ASC, file_id ASC
LIMIT ?;

-- name: FindTaskFileParentLinkByID :one
SELECT file_id, project_id, parent_id, is_directory, deleted_at
FROM magic_super_agent_task_files
WHERE file_id = ?
LIMIT 1;

-- name: ListTaskFileParentLinksByProjectID :many
SELECT file_id, parent_id, is_directory
FROM magic_super_agent_task_files
WHERE project_id = ?
  AND deleted_at IS NULL;
