CREATE TABLE IF NOT EXISTS magic_contact_users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    magic_id VARCHAR(64) NOT NULL DEFAULT '',
    organization_code VARCHAR(64) NOT NULL DEFAULT '',
    user_id VARCHAR(64) NOT NULL DEFAULT '',
    status TINYINT NOT NULL DEFAULT 0,
    deleted_at TIMESTAMP NULL,
    KEY idx_magic_contact_users_org_user_status_deleted (organization_code, user_id, status, deleted_at),
    KEY idx_magic_contact_users_org_magic_status_deleted (organization_code, magic_id, status, deleted_at)
);
