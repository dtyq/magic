<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\File\Constant;

/**
 * Chunk upload and download related constants.
 */
class ChunkUploadConstant
{
    // ====== File Size Constants ======

    /**
     * Size units in bytes.
     */
    public const KB = 1024;

    public const MB = self::KB * 1024;

    public const GB = self::MB * 1024;

    /**
     * Default chunk sizes for upload.
     */
    public const DEFAULT_CHUNK_SIZE = 20 * self::MB;

    public const MIN_CHUNK_SIZE = 5 * self::MB;      // TOS requirement

    public const MAX_CHUNK_SIZE = 1 * self::GB;

    /**
     * Default chunk sizes for download.
     */
    public const DEFAULT_DOWNLOAD_CHUNK_SIZE = 2 * self::MB;

    public const MIN_DOWNLOAD_CHUNK_SIZE = 1 * self::MB;

    public const MAX_DOWNLOAD_CHUNK_SIZE = 100 * self::MB;

    /**
     * Upload thresholds.
     */
    public const DEFAULT_THRESHOLD = 50 * self::MB;

    public const SMALL_FILE_THRESHOLD = 10 * self::MB;

    public const LARGE_FILE_THRESHOLD = 100 * self::MB;

    public const HUGE_FILE_THRESHOLD = 1 * self::GB;

    /**
     * Download thresholds.
     */
    public const DEFAULT_DOWNLOAD_THRESHOLD = 10 * self::MB;

    public const SMALL_DOWNLOAD_THRESHOLD = 5 * self::MB;

    public const LARGE_DOWNLOAD_THRESHOLD = 50 * self::MB;

    public const HUGE_DOWNLOAD_THRESHOLD = 500 * self::MB;

    /**
     * Maximum file sizes.
     */
    public const MAX_CHUNK_UPLOAD_SIZE = 5 * self::GB;

    public const MAX_REGULAR_UPLOAD_SIZE = 100 * self::MB;

    // ====== Upload Configuration Constants ======

    /**
     * Concurrency settings.
     */
    public const DEFAULT_MAX_CONCURRENCY = 3;

    public const MIN_CONCURRENCY = 1;

    public const MAX_CONCURRENCY = 10;

    /**
     * Retry settings.
     */
    public const DEFAULT_MAX_RETRIES = 3;

    public const MAX_RETRY_ATTEMPTS = 10;

    public const DEFAULT_RETRY_DELAY = 1000; // milliseconds

    public const MAX_RETRY_DELAY = 30000; // milliseconds

    /**
     * Timeout settings (in seconds).
     */
    public const DEFAULT_CHUNK_TIMEOUT = 300;     // 5 minutes

    public const DEFAULT_TOTAL_TIMEOUT = 3600;    // 1 hour

    public const MAX_CHUNK_TIMEOUT = 1800;        // 30 minutes

    public const MAX_TOTAL_TIMEOUT = 7200;        // 2 hours

    // ====== Platform Limits ======

    /**
     * TOS (Volcengine) limits.
     */
    public const TOS_MIN_CHUNK_SIZE = 5 * self::MB;

    public const TOS_MAX_CHUNK_SIZE = 1 * self::GB;

    public const TOS_MAX_PARTS = 10000;

    public const TOS_MAX_OBJECT_SIZE = 48.8 * 1024 * self::GB; // ~50TB

    /**
     * Aliyun OSS limits.
     */
    public const OSS_MIN_CHUNK_SIZE = 100 * self::KB;

    public const OSS_MAX_CHUNK_SIZE = 5 * self::GB;

    public const OSS_MAX_PARTS = 10000;

    public const OSS_MAX_OBJECT_SIZE = 48.8 * 1024 * self::GB; // ~50TB

    /**
     * Huawei OBS limits.
     */
    public const OBS_MIN_CHUNK_SIZE = 100 * self::KB;

    public const OBS_MAX_CHUNK_SIZE = 5 * self::GB;

    public const OBS_MAX_PARTS = 10000;

    public const OBS_MAX_OBJECT_SIZE = 5 * 1024 * self::GB; // ~5TB

    // ====== Cache and Storage Constants ======

    /**
     * Cache TTL values (in seconds).
     */
    public const DEFAULT_CREDENTIAL_CACHE_TTL = 1800;      // 30 minutes

    public const DEFAULT_PROGRESS_CACHE_TTL = 24 * 3600;   // 24 hours

    public const DEFAULT_RESUME_CACHE_TTL = 7 * 24 * 3600; // 7 days

    /**
     * Cache key prefixes.
     */
    public const CACHE_PREFIX_PROGRESS = 'chunk_upload:progress:';

    public const CACHE_PREFIX_RESUME = 'chunk_upload:resume:';

    public const CACHE_PREFIX_CREDENTIAL = 'chunk_upload:credential:';

    public const CACHE_PREFIX_STATS = 'chunk_upload:stats:';

    /**
     * Download cache key prefixes.
     */
    public const CACHE_PREFIX_DOWNLOAD_PROGRESS = 'chunk_download:progress:';

    public const CACHE_PREFIX_DOWNLOAD_RESUME = 'chunk_download:resume:';

    public const CACHE_PREFIX_DOWNLOAD_STATS = 'chunk_download:stats:';

    // ====== Upload Method Types ======

    /**
     * Upload methods.
     */
    public const UPLOAD_METHOD_REGULAR = 'regular';

    public const UPLOAD_METHOD_CHUNK = 'chunk';

    public const UPLOAD_METHOD_SMART = 'smart';

    /**
     * Download methods.
     */
    public const DOWNLOAD_METHOD_REGULAR = 'regular';

    public const DOWNLOAD_METHOD_CHUNK = 'chunk';

    public const DOWNLOAD_METHOD_SMART = 'smart';

    /**
     * Upload statuses.
     */
    public const STATUS_PENDING = 'pending';

    public const STATUS_UPLOADING = 'uploading';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_FAILED = 'failed';

    public const STATUS_ABORTED = 'aborted';

    public const STATUS_PAUSED = 'paused';

    // ====== Error Codes ======

    /**
     * Error codes for chunk upload.
     */
    public const ERROR_FILE_TOO_LARGE = 'FILE_TOO_LARGE';

    public const ERROR_CHUNK_TOO_SMALL = 'CHUNK_TOO_SMALL';

    public const ERROR_CHUNK_TOO_LARGE = 'CHUNK_TOO_LARGE';

    public const ERROR_INVALID_CHUNK_SIZE = 'INVALID_CHUNK_SIZE';

    public const ERROR_UPLOAD_FAILED = 'UPLOAD_FAILED';

    public const ERROR_CREDENTIAL_EXPIRED = 'CREDENTIAL_EXPIRED';

    public const ERROR_PLATFORM_NOT_SUPPORTED = 'PLATFORM_NOT_SUPPORTED';

    public const ERROR_CONCURRENT_LIMIT_EXCEEDED = 'CONCURRENT_LIMIT_EXCEEDED';

    public const ERROR_RETRY_LIMIT_EXCEEDED = 'RETRY_LIMIT_EXCEEDED';

    public const ERROR_TIMEOUT = 'TIMEOUT';

    public const ERROR_INSUFFICIENT_STORAGE = 'INSUFFICIENT_STORAGE';

    public const ERROR_INVALID_FILE = 'INVALID_FILE';

    // ====== HTTP Status Codes ======

    /**
     * HTTP status codes related to upload.
     */
    public const HTTP_SUCCESS = 200;

    public const HTTP_PARTIAL_CONTENT = 206;

    public const HTTP_BAD_REQUEST = 400;

    public const HTTP_UNAUTHORIZED = 401;

    public const HTTP_FORBIDDEN = 403;

    public const HTTP_NOT_FOUND = 404;

    public const HTTP_REQUEST_TIMEOUT = 408;

    public const HTTP_PAYLOAD_TOO_LARGE = 413;

    public const HTTP_RANGE_NOT_SATISFIABLE = 416;

    public const HTTP_TOO_MANY_REQUESTS = 429;

    public const HTTP_INTERNAL_SERVER_ERROR = 500;

    public const HTTP_BAD_GATEWAY = 502;

    public const HTTP_SERVICE_UNAVAILABLE = 503;

    public const HTTP_GATEWAY_TIMEOUT = 504;

    // ====== Memory and Resource Constants ======

    /**
     * Memory usage limits.
     */
    public const DEFAULT_MAX_MEMORY = 512 * self::MB;

    public const MIN_MEMORY_LIMIT = 128 * self::MB;

    public const MEMORY_WARNING_THRESHOLD = 0.8; // 80% of limit

    /**
     * Progress update intervals.
     */
    public const DEFAULT_PROGRESS_INTERVAL = 1; // Update every chunk

    public const MIN_PROGRESS_INTERVAL = 1;

    public const MAX_PROGRESS_INTERVAL = 100;

    // ====== File Type and Validation ======

    /**
     * Supported file types for chunk upload
     * Empty array means all types are supported.
     */
    public const SUPPORTED_MIME_TYPES = [
        // Add specific MIME types if needed
        // 'video/*',
        // 'application/zip',
        // 'application/x-rar-compressed',
        // etc.
    ];

    /**
     * File extensions that typically require chunk upload.
     */
    public const LARGE_FILE_EXTENSIONS = [
        'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
        'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv',
        'iso', 'dmg', 'img',
        'psd', 'ai', 'eps',
        'sql', 'dump', 'backup',
    ];

    // ====== Metrics and Statistics ======

    /**
     * Performance metrics.
     */
    public const METRIC_UPLOAD_SPEED = 'upload_speed';

    public const METRIC_SUCCESS_RATE = 'success_rate';

    public const METRIC_AVERAGE_CHUNK_TIME = 'avg_chunk_time';

    public const METRIC_RETRY_RATE = 'retry_rate';

    public const METRIC_CONCURRENT_UPLOADS = 'concurrent_uploads';

    /**
     * Speed calculation windows.
     */
    public const SPEED_WINDOW_SIZE = 10; // Number of chunks to calculate average speed

    public const SPEED_UPDATE_INTERVAL = 5; // Update speed every N chunks

    // ====== Configuration Keys ======

    /**
     * Configuration file keys for upload.
     */
    public const CONFIG_CHUNK_SIZE = 'chunk_upload.default_chunk_size';

    public const CONFIG_THRESHOLD = 'chunk_upload.chunk_upload_threshold';

    public const CONFIG_MAX_CONCURRENCY = 'chunk_upload.max_concurrency';

    public const CONFIG_MAX_RETRIES = 'chunk_upload.max_retries';

    public const CONFIG_ENABLE_PROGRESS = 'chunk_upload.enable_progress_callback';

    public const CONFIG_ENABLE_LOGGING = 'chunk_upload.enable_logging';

    /**
     * Configuration file keys for download.
     */
    public const CONFIG_DOWNLOAD_CHUNK_SIZE = 'chunk_upload.download_default_chunk_size';

    public const CONFIG_DOWNLOAD_THRESHOLD = 'chunk_upload.chunk_download_threshold';

    public const CONFIG_DOWNLOAD_MAX_CONCURRENCY = 'chunk_upload.download_max_concurrency';

    public const CONFIG_DOWNLOAD_MAX_RETRIES = 'chunk_upload.download_max_retries';

    public const CONFIG_DOWNLOAD_ENABLE_PROGRESS = 'chunk_upload.enable_download_progress_callback';

    public const CONFIG_DOWNLOAD_ENABLE_RESUME = 'chunk_upload.enable_download_resume';

    // ====== Event Names ======

    /**
     * Event names for chunk upload operations.
     */
    public const EVENT_CHUNK_UPLOAD_STARTED = 'chunk_upload.started';

    public const EVENT_CHUNK_UPLOAD_COMPLETED = 'chunk_upload.completed';

    public const EVENT_CHUNK_UPLOAD_FAILED = 'chunk_upload.failed';

    public const EVENT_CHUNK_UPLOAD_PROGRESS = 'chunk_upload.progress';

    public const EVENT_CHUNK_UPLOAD_PAUSED = 'chunk_upload.paused';

    public const EVENT_CHUNK_UPLOAD_RESUMED = 'chunk_upload.resumed';

    public const EVENT_CHUNK_UPLOAD_ABORTED = 'chunk_upload.aborted';

    /**
     * Event names for chunk download operations.
     */
    public const EVENT_CHUNK_DOWNLOAD_STARTED = 'chunk_download.started';

    public const EVENT_CHUNK_DOWNLOAD_COMPLETED = 'chunk_download.completed';

    public const EVENT_CHUNK_DOWNLOAD_FAILED = 'chunk_download.failed';

    public const EVENT_CHUNK_DOWNLOAD_PROGRESS = 'chunk_download.progress';

    public const EVENT_CHUNK_DOWNLOAD_PAUSED = 'chunk_download.paused';

    public const EVENT_CHUNK_DOWNLOAD_RESUMED = 'chunk_download.resumed';

    public const EVENT_CHUNK_DOWNLOAD_ABORTED = 'chunk_download.aborted';
}
