-- name: CountActiveContactUserByUserID :one
SELECT COUNT(*) AS count
FROM magic_contact_users
WHERE organization_code = ?
  AND user_id = ?
  AND status = 1
  AND deleted_at IS NULL;

-- name: ListActiveContactUserIDsByUserIDs :many
SELECT user_id
FROM magic_contact_users
WHERE organization_code = sqlc.arg(organization_code)
  AND user_id IN (sqlc.slice(user_ids))
  AND status = 1
  AND deleted_at IS NULL
ORDER BY user_id ASC;

-- name: ListActiveContactUsersByMagicID :many
SELECT id, user_id, magic_id, organization_code
FROM magic_contact_users
WHERE organization_code = ?
  AND magic_id = ?
  AND status = 1
  AND deleted_at IS NULL
ORDER BY id ASC;

-- name: ListActiveContactUsersByMagicIDs :many
SELECT id, user_id, magic_id, organization_code
FROM magic_contact_users
WHERE organization_code = sqlc.arg(organization_code)
  AND magic_id IN (sqlc.slice(magic_ids))
  AND status = 1
  AND deleted_at IS NULL
ORDER BY magic_id ASC, id ASC;
