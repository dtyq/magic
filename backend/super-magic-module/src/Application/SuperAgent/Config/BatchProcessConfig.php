<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Config;

/**
 * Batch Process Configuration.
 * 批量处理配置类 - 统一管理批量文件保存的各项参数.
 */
class BatchProcessConfig
{
    /**
     * 并发控制配置.
     */
    public const int DEFAULT_MAX_CONCURRENCY = 5;   // 默认最大并发数（考虑文件IO和内存占用）

    public const int MIN_CONCURRENCY = 1;           // 最小并发数

    public const int MAX_CONCURRENCY = 8;           // 最大并发数上限（文件处理不宜过高）

    /**
     * 批量大小限制.
     */
    public const int DEFAULT_BATCH_SIZE_LIMIT = 50; // 默认批量大小限制

    public const int MAX_BATCH_SIZE_LIMIT = 100;    // 最大批量大小上限

    /**
     * 功能开关.
     */
    public const bool ENABLE_PERFORMANCE_MONITORING = true; // 性能监控开关

    public const bool ENABLE_DETAILED_LOGGING = true;       // 详细日志开关

    /**
     * 获取最大并发数.
     * 文件处理是IO密集型操作，需要考虑内存占用和系统资源限制.
     *
     * @param int $fileCount 文件数量
     * @return int 实际并发数
     */
    public static function getMaxConcurrency(int $fileCount): int
    {
        // 文件处理并发策略：
        // 1. 考虑到每个文件最大10MB，过多并发会占用大量内存
        // 2. 文件上传涉及临时文件、网络IO，资源消耗较大
        // 3. 分布式锁、数据库连接等也有限制

        if ($fileCount == 1) {
            return 1;
        }

        if ($fileCount <= 3) {
            return 3;  // 少量文件用3个并发
        }

        // 无论多少文件，最大并发数都不超过5个
        return self::DEFAULT_MAX_CONCURRENCY;
    }

    /**
     * 是否启用并发处理.
     *
     * @param int $fileCount 文件数量
     * @return bool 是否启用并发
     */
    public static function shouldEnableConcurrency(int $fileCount): bool
    {
        // 文件数量小于2时不使用并发
        return $fileCount >= 2;
    }

    /**
     * 获取批量大小限制.
     *
     * @return int 批量大小限制
     */
    public static function getBatchSizeLimit(): int
    {
        return self::DEFAULT_BATCH_SIZE_LIMIT;
    }

    /**
     * 是否启用性能监控.
     *
     * @return bool 是否启用性能监控
     */
    public static function isPerformanceMonitoringEnabled(): bool
    {
        return self::ENABLE_PERFORMANCE_MONITORING;
    }

    /**
     * 是否启用详细日志.
     *
     * @return bool 是否启用详细日志
     */
    public static function isDetailedLoggingEnabled(): bool
    {
        return self::ENABLE_DETAILED_LOGGING;
    }
}
