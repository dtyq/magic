CREATE TABLE IF NOT EXISTS embedding_cache (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    text_hash CHAR(64) NOT NULL,
    text_preview VARCHAR(255) NOT NULL,
    text_length INT NOT NULL,
    embedding JSON NOT NULL,
    embedding_model VARCHAR(100) NOT NULL,
    vector_dimension INT NOT NULL,
    access_count INT NOT NULL DEFAULT 1,
    last_accessed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_text_hash_model (text_hash, embedding_model),
    KEY idx_last_accessed_access (last_accessed_at, access_count),
    KEY idx_access_count (access_count),
    KEY idx_created_at (created_at)
);
