<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

/**
 * Simple utility for extracting file IDs from mention structures.
 */
class MentionUtil
{
    /**
     * Extract file IDs from mentions array.
     *
     * @param array $mentions Array of mention objects or arrays
     * @return array Array of unique file IDs
     */
    public static function extractFileIds(array $mentions): array
    {
        $fileIds = [];

        foreach ($mentions as $mention) {
            $fileId = self::extractFileId($mention);
            if ($fileId) {
                $fileIds[] = $fileId;
            }
        }

        return array_unique($fileIds);
    }

    /**
     * Extract file ID from a single mention.
     *
     * @param mixed $mention Mention object or array
     */
    private static function extractFileId($mention): ?string
    {
        // Try object approach first (most common)
        if (is_object($mention)) {
            return $mention->getAttrs()?->getData()?->getFileId();
        }

        // Fallback to array approach (from JSON)
        if (is_array($mention)) {
            return $mention['attrs']['data']['file_id'] ?? null;
        }

        return null;
    }
}
