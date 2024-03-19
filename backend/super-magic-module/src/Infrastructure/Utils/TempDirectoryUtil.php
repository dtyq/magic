<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use DateInterval;
use DatePeriod;
use DateTime;

/**
 * Temporary directory utility class for generating date-based temporary directory paths.
 */
class TempDirectoryUtil
{
    /**
     * Base directory for batch compression.
     */
    private const string BATCH_BASE_DIR = 'tmp/super_magic/batch/';

    /**
     * Get compress file temporary directory path (current date).
     *
     * @return string Compress file temporary directory path, e.g., tmp/super_magic/batch/20250621/
     */
    public static function getCompressTempDir(): string
    {
        $currentDate = date('Ymd');
        return self::BATCH_BASE_DIR . $currentDate . '/';
    }

    /**
     * Get compress file temporary directory path for specified date.
     *
     * @param string $date Date in YYYYMMDD format
     * @return string Compress file temporary directory path for specified date
     */
    public static function getCompressTempDirForDate(string $date): string
    {
        return self::BATCH_BASE_DIR . $date . '/';
    }

    /**
     * Get batch compression base directory.
     *
     * @return string Base directory path
     */
    public static function getBatchBaseDir(): string
    {
        return self::BATCH_BASE_DIR;
    }

    /**
     * Generate compress file temporary directory paths array for date range (for cleanup operations).
     *
     * @param string $startDate Start date in YYYYMMDD format
     * @param string $endDate End date in YYYYMMDD format
     * @return array Directory paths array
     */
    public static function getCompressTempDirsForDateRange(string $startDate, string $endDate): array
    {
        $directories = [];
        $start = DateTime::createFromFormat('Ymd', $startDate);
        $end = DateTime::createFromFormat('Ymd', $endDate);

        if (! $start || ! $end) {
            return $directories;
        }

        $interval = new DateInterval('P1D');
        $period = new DatePeriod($start, $interval, $end->modify('+1 day'));

        foreach ($period as $date) {
            $directories[] = self::getCompressTempDirForDate($date->format('Ymd'));
        }

        return $directories;
    }
}
