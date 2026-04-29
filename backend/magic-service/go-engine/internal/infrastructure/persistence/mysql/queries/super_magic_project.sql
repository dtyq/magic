-- name: ListSuperMagicProjectWorkspaceMappings :many
SELECT id, workspace_id
FROM magic_super_agent_project
WHERE user_organization_code = ?
  AND id IN (sqlc.slice(project_ids))
  AND deleted_at IS NULL;

-- name: ListSuperMagicSharedProjectCandidates :many
SELECT id, workspace_id, is_collaboration_enabled
FROM magic_super_agent_project
WHERE user_organization_code = ?
  AND id IN (sqlc.slice(project_ids))
  AND deleted_at IS NULL;

-- name: ListSuperMagicWorkspacesByIDs :many
SELECT id, user_id
FROM magic_super_agent_workspaces
WHERE id IN (sqlc.slice(workspace_ids))
  AND deleted_at IS NULL;

-- name: ListSuperMagicProjectMembersByProjectIDs :many
SELECT project_id, organization_code, status, role, deleted_at
FROM magic_super_agent_project_members
WHERE project_id IN (sqlc.slice(project_ids));
