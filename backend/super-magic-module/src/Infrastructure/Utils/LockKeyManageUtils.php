<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

/**
 * Lock Key Management Utility
 * Provides centralized lock key generation to ensure consistency across services.
 */
class LockKeyManageUtils
{
    /**
     * Generate lock key for file key processing.
     * Used to prevent concurrent processing of the same file_key across different services.
     *
     * @param string $fileKey The file key to generate lock for
     * @return string The formatted lock key
     */
    public static function getFileKeyLock(string $fileKey): string
    {
        return 'process_file_key_lock:' . $fileKey;
    }
}
