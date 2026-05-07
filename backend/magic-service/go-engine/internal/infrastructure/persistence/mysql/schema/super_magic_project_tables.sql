CREATE TABLE IF NOT EXISTS magic_super_agent_project (
    id BIGINT NOT NULL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT '',
    user_organization_code VARCHAR(64) NOT NULL DEFAULT '',
    workspace_id BIGINT NULL,
    is_collaboration_enabled TINYINT NOT NULL DEFAULT 1,
    deleted_at DATETIME NULL,
    KEY idx_magic_super_agent_project_org_project_deleted (user_organization_code, id, deleted_at),
    KEY magic_super_agent_project_workspace_id_index (workspace_id)
);

CREATE TABLE IF NOT EXISTS magic_super_agent_workspaces (
    id BIGINT NOT NULL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL DEFAULT '',
    user_organization_code VARCHAR(64) NOT NULL DEFAULT '',
    deleted_at DATETIME NULL,
    KEY idx_magic_super_agent_workspaces_user_id (user_id)
);

CREATE TABLE IF NOT EXISTS magic_super_agent_project_members (
    id BIGINT NOT NULL PRIMARY KEY,
    project_id BIGINT NOT NULL,
    target_type VARCHAR(32) NOT NULL DEFAULT '',
    target_id VARCHAR(128) NOT NULL DEFAULT '',
    role VARCHAR(32) NOT NULL DEFAULT '',
    organization_code VARCHAR(64) NOT NULL DEFAULT '',
    status TINYINT NOT NULL DEFAULT 1,
    invited_by VARCHAR(128) NOT NULL DEFAULT '',
    deleted_at DATETIME NULL,
    UNIQUE KEY uk_project_target (project_id, target_type, target_id),
    KEY idx_target (target_type, target_id),
    KEY idx_invited_by (invited_by)
);
