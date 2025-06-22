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
 * Temporary directory cleanup utility class for cleaning expired compress file temporary directories.
 */
class TempDirectoryCleanupUtil
{
    /**
     * Get expired temporary directory paths array.
     *
     * @param int $daysOld Number of expired days (default: 7 days)
     * @return array Directory paths array that need to be cleaned up
     */
    public static function getExpiredTempDirectories(int $daysOld = 7): array
    {
        $directories = [];
        $cutoffDate = new DateTime();
        $cutoffDate->modify("-{$daysOld} days");

        // Get all possible directories from cutoff date to 30 days ago
        $startDate = clone $cutoffDate;
        $startDate->modify('-30 days');

        $interval = new DateInterval('P1D');
        $period = new DatePeriod($startDate, $interval, $cutoffDate);

        foreach ($period as $date) {
            $directories[] = TempDirectoryUtil::getCompressTempDirForDate($date->format('Ymd'));
        }

        return $directories;
    }

    /**
     * Get temporary directory paths array for specified date range (for manual cleanup).
     *
     * @param string $startDate Start date in YYYYMMDD format
     * @param string $endDate End date in YYYYMMDD format
     * @return array Directory paths array
     */
    public static function getTempDirectoriesForDateRange(string $startDate, string $endDate): array
    {
        return TempDirectoryUtil::getCompressTempDirsForDateRange($startDate, $endDate);
    }

    /**
     * Generate cleanup command.
     *
     * @param array $directories Directory paths array
     * @return string Shell command to delete directories
     */
    public static function generateCleanupCommand(array $directories): string
    {
        if (empty($directories)) {
            return '';
        }

        $escapedDirs = array_map('escapeshellarg', $directories);
        return 'rm -rf ' . implode(' ', $escapedDirs);
    }

    /**
     * Get today's temporary directory path.
     *
     * @return string Today's compress file temporary directory path
     */
    public static function getTodayTempDirectory(): string
    {
        return TempDirectoryUtil::getCompressTempDir();
    }

    /**
     * Get yesterday's temporary directory path.
     *
     * @return string Yesterday's compress file temporary directory path
     */
    public static function getYesterdayTempDirectory(): string
    {
        $yesterday = new DateTime();
        $yesterday->modify('-1 day');
        return TempDirectoryUtil::getCompressTempDirForDate($yesterday->format('Ymd'));
    }
}
