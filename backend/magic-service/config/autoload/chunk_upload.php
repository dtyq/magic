<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */
return [
    // ====== Basic Chunk Upload Settings ======

    /*
     * Default chunk size in bytes
     * Minimum: 5MB (TOS requirement)
     * Maximum: 1GB
     * Recommended: 10-50MB based on network conditions
     */
    'default_chunk_size' => env('CHUNK_UPLOAD_DEFAULT_CHUNK_SIZE', 20 * 1024 * 1024), // 20MB

    /*
     * File size threshold to trigger chunk upload
     * Files larger than this size will use chunk upload
     */
    'chunk_upload_threshold' => env('CHUNK_UPLOAD_THRESHOLD', 50 * 1024 * 1024), // 50MB

    /*
     * Maximum file size allowed for upload
     * Set to 0 to disable limit
     */
    'max_file_size' => env('CHUNK_UPLOAD_MAX_FILE_SIZE', 5 * 1024 * 1024 * 1024), // 5GB

    // ====== Concurrency and Performance ======

    /*
     * Maximum concurrent chunk uploads
     * Higher values may improve speed but consume more resources
     */
    'max_concurrency' => env('CHUNK_UPLOAD_MAX_CONCURRENCY', 3),

    /*
     * Upload timeout per chunk in seconds
     */
    'chunk_timeout' => env('CHUNK_UPLOAD_CHUNK_TIMEOUT', 300), // 5 minutes

    /*
     * Total upload timeout in seconds
     * 0 means no timeout limit
     */
    'total_timeout' => env('CHUNK_UPLOAD_TOTAL_TIMEOUT', 3600), // 1 hour

    // ====== Retry and Error Handling ======

    /*
     * Maximum retry attempts for failed chunks
     */
    'max_retries' => env('CHUNK_UPLOAD_MAX_RETRIES', 3),

    /*
     * Initial retry delay in milliseconds
     * Actual delay uses exponential backoff: delay * (2 ^ attempt_number)
     */
    'retry_delay' => env('CHUNK_UPLOAD_RETRY_DELAY', 1000), // 1 second

    /*
     * Maximum retry delay in milliseconds
     * Prevents exponential backoff from becoming too long
     */
    'max_retry_delay' => env('CHUNK_UPLOAD_MAX_RETRY_DELAY', 30000), // 30 seconds

    // ====== Credential and Security ======

    /*
     * STS credential expiration time in seconds
     * Should be long enough to complete upload
     */
    'sts_expires' => env('CHUNK_UPLOAD_STS_EXPIRES', 3600), // 1 hour

    /*
     * Upload credential cache TTL in seconds
     * Reduce frequent credential requests
     */
    'credential_cache_ttl' => env('CHUNK_UPLOAD_CREDENTIAL_CACHE_TTL', 1800), // 30 minutes

    // ====== Progress and Monitoring ======

    /*
     * Enable progress callbacks
     * Set to false to disable progress tracking for better performance
     */
    'enable_progress_callback' => env('CHUNK_UPLOAD_ENABLE_PROGRESS', true),

    /*
     * Progress update interval
     * Update progress every N chunks completed
     */
    'progress_update_interval' => env('CHUNK_UPLOAD_PROGRESS_INTERVAL', 1),

    /*
     * Cache upload progress in Redis
     * Useful for frontend progress queries
     */
    'cache_progress' => env('CHUNK_UPLOAD_CACHE_PROGRESS', true),

    /*
     * Progress cache TTL in seconds
     */
    'progress_cache_ttl' => env('CHUNK_UPLOAD_PROGRESS_CACHE_TTL', 24 * 3600), // 24 hours

    /*
     * Progress cache key prefix
     */
    'progress_cache_prefix' => env('CHUNK_UPLOAD_PROGRESS_PREFIX', 'chunk_upload:progress:'),

    // ====== Platform Specific Settings ======

    /*
     * Platform-specific configurations
     */
    'platforms' => [
        'tos' => [
            'min_chunk_size' => 5 * 1024 * 1024, // 5MB (TOS requirement)
            'max_chunk_size' => 1 * 1024 * 1024 * 1024, // 1GB
            'max_parts' => 10000, // TOS multipart upload limit
            'supported_operations' => ['upload', 'download'],
        ],
        'aliyun' => [
            'min_chunk_size' => 100 * 1024, // 100KB (OSS requirement)
            'max_chunk_size' => 5 * 1024 * 1024 * 1024, // 5GB
            'max_parts' => 10000,
            'supported_operations' => [], // Not implemented yet
        ],
        'obs' => [
            'min_chunk_size' => 100 * 1024, // 100KB (OBS requirement)
            'max_chunk_size' => 5 * 1024 * 1024 * 1024, // 5GB
            'max_parts' => 10000,
            'supported_operations' => [], // Not implemented yet
        ],
    ],

    // ====== Logging and Debugging ======

    /*
     * Enable detailed logging for chunk upload operations
     */
    'enable_logging' => env('CHUNK_UPLOAD_ENABLE_LOGGING', true),

    /*
     * Log level for chunk upload operations
     * Available: debug, info, warning, error
     */
    'log_level' => env('CHUNK_UPLOAD_LOG_LEVEL', 'info'),

    /*
     * Log chunk upload statistics
     */
    'log_statistics' => env('CHUNK_UPLOAD_LOG_STATISTICS', true),

    // ====== Memory and Resource Management ======

    /*
     * Maximum memory usage during upload in bytes
     * System will attempt to optimize memory usage below this limit
     */
    'max_memory_usage' => env('CHUNK_UPLOAD_MAX_MEMORY', 512 * 1024 * 1024), // 512MB

    /*
     * Enable garbage collection after each chunk
     * May help with memory management for large uploads
     */
    'enable_gc' => env('CHUNK_UPLOAD_ENABLE_GC', true),

    /*
     * Temporary file cleanup
     * Automatically clean up temporary files after upload
     */
    'auto_cleanup' => env('CHUNK_UPLOAD_AUTO_CLEANUP', true),

    // ====== Advanced Features ======

    /*
     * Enable upload resume functionality
     * Allows resuming interrupted uploads (requires additional implementation)
     */
    'enable_resume' => env('CHUNK_UPLOAD_ENABLE_RESUME', false),

    /*
     * Resume info cache TTL in seconds
     */
    'resume_cache_ttl' => env('CHUNK_UPLOAD_RESUME_TTL', 7 * 24 * 3600), // 7 days

    /*
     * Enable upload speed calculation
     */
    'calculate_speed' => env('CHUNK_UPLOAD_CALCULATE_SPEED', true),

    /*
     * Speed calculation window size (number of chunks)
     */
    'speed_window_size' => env('CHUNK_UPLOAD_SPEED_WINDOW', 10),

    // ====== Storage-specific settings ======

    'storage_types' => [
        'private' => [
            'chunk_upload_threshold' => env('CHUNK_UPLOAD_PRIVATE_THRESHOLD', 50 * 1024 * 1024),
            'max_file_size' => env('CHUNK_UPLOAD_PRIVATE_MAX_SIZE', 5 * 1024 * 1024 * 1024),
        ],
        'public' => [
            'chunk_upload_threshold' => env('CHUNK_UPLOAD_PUBLIC_THRESHOLD', 100 * 1024 * 1024),
            'max_file_size' => env('CHUNK_UPLOAD_PUBLIC_MAX_SIZE', 2 * 1024 * 1024 * 1024),
        ],
    ],

    // ====== Chunk Download Settings ======

    /*
     * Default chunk size for downloads in bytes
     * Smaller than upload chunks for better network efficiency
     */
    'download_default_chunk_size' => env('CHUNK_DOWNLOAD_DEFAULT_CHUNK_SIZE', 2 * 1024 * 1024), // 2MB

    /*
     * File size threshold to trigger chunk download
     * Files larger than this size will use chunk download
     */
    'chunk_download_threshold' => env('CHUNK_DOWNLOAD_THRESHOLD', 10 * 1024 * 1024), // 10MB

    /*
     * Maximum file size allowed for download
     * Set to 0 to disable limit
     */
    'max_download_file_size' => env('CHUNK_DOWNLOAD_MAX_FILE_SIZE', 10 * 1024 * 1024 * 1024), // 10GB

    /*
     * Maximum concurrent chunk downloads
     * Lower than upload to be conservative with bandwidth
     */
    'download_max_concurrency' => env('CHUNK_DOWNLOAD_MAX_CONCURRENCY', 3),

    /*
     * Download timeout per chunk in seconds
     */
    'download_chunk_timeout' => env('CHUNK_DOWNLOAD_CHUNK_TIMEOUT', 60), // 1 minute

    /*
     * Total download timeout in seconds
     * 0 means no timeout limit
     */
    'download_total_timeout' => env('CHUNK_DOWNLOAD_TOTAL_TIMEOUT', 3600), // 1 hour

    /*
     * Maximum retry attempts for failed download chunks
     */
    'download_max_retries' => env('CHUNK_DOWNLOAD_MAX_RETRIES', 3),

    /*
     * Initial retry delay for download chunks in milliseconds
     */
    'download_retry_delay' => env('CHUNK_DOWNLOAD_RETRY_DELAY', 1000), // 1 second

    /*
     * Maximum retry delay for downloads in milliseconds
     */
    'download_max_retry_delay' => env('CHUNK_DOWNLOAD_MAX_RETRY_DELAY', 30000), // 30 seconds

    /*
     * Enable download progress callbacks
     */
    'enable_download_progress_callback' => env('CHUNK_DOWNLOAD_ENABLE_PROGRESS', true),

    /*
     * Download progress update interval
     */
    'download_progress_update_interval' => env('CHUNK_DOWNLOAD_PROGRESS_INTERVAL', 1),

    /*
     * Cache download progress in Redis
     */
    'cache_download_progress' => env('CHUNK_DOWNLOAD_CACHE_PROGRESS', true),

    /*
     * Download progress cache TTL in seconds
     */
    'download_progress_cache_ttl' => env('CHUNK_DOWNLOAD_PROGRESS_CACHE_TTL', 24 * 3600), // 24 hours

    /*
     * Download progress cache key prefix
     */
    'download_progress_cache_prefix' => env('CHUNK_DOWNLOAD_PROGRESS_PREFIX', 'chunk_download:progress:'),

    /*
     * Enable download resume functionality
     */
    'enable_download_resume' => env('CHUNK_DOWNLOAD_ENABLE_RESUME', true),

    /*
     * Download resume info cache TTL in seconds
     */
    'download_resume_cache_ttl' => env('CHUNK_DOWNLOAD_RESUME_TTL', 7 * 24 * 3600), // 7 days

    /*
     * Enable download speed calculation
     */
    'calculate_download_speed' => env('CHUNK_DOWNLOAD_CALCULATE_SPEED', true),

    /*
     * Download speed calculation window size (number of chunks)
     */
    'download_speed_window_size' => env('CHUNK_DOWNLOAD_SPEED_WINDOW', 10),

    /*
     * HTTP User-Agent for chunk downloads
     */
    'download_user_agent' => env('CHUNK_DOWNLOAD_USER_AGENT', 'Magic-ChunkDownload/1.0'),

    /*
     * Enable automatic fallback to regular download if chunk download fails
     */
    'enable_download_fallback' => env('CHUNK_DOWNLOAD_ENABLE_FALLBACK', true),

    /*
     * Temporary chunk storage directory
     * Relative to system temp directory
     */
    'download_temp_dir' => env('CHUNK_DOWNLOAD_TEMP_DIR', 'magic_chunk_downloads'),

    /*
     * Platform-specific download settings
     */
    'download_platforms' => [
        'tos' => [
            'supports_range_request' => true,
            'min_chunk_size' => 1024 * 1024, // 1MB minimum for TOS
            'max_chunk_size' => 100 * 1024 * 1024, // 100MB maximum
            'supported_operations' => ['download'],
        ],
        'aliyun' => [
            'supports_range_request' => true,
            'min_chunk_size' => 1024 * 1024, // 1MB minimum for OSS
            'max_chunk_size' => 100 * 1024 * 1024, // 100MB maximum
            'supported_operations' => [], // Not implemented yet
        ],
        'obs' => [
            'supports_range_request' => true,
            'min_chunk_size' => 1024 * 1024, // 1MB minimum for OBS
            'max_chunk_size' => 100 * 1024 * 1024, // 100MB maximum
            'supported_operations' => [], // Not implemented yet
        ],
    ],
];
