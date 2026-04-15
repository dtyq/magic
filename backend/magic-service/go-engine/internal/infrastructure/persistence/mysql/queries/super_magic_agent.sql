-- name: ListExistingSuperMagicAgentCodesByOrg :many
SELECT code
FROM magic_super_magic_agents
WHERE organization_code = ?
  AND deleted_at IS NULL
  AND code IN (sqlc.slice(codes));
