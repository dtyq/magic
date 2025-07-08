<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;

class WorkDirectoryUtil
{
    public static function generateWorkDir(string $userId, int $projectId): string
    {
        return sprintf('/%s/%s/project_%d', AgentConstant::SUPER_MAGIC_CODE, $userId, $projectId);
    }

    public static function getRelativeFilePath(string $fileKey, string $workDir): string
    {
        if (! empty($workDir)) {
            $workDirPos = strpos($fileKey, $workDir);
            if ($workDirPos !== false) {
                return substr($fileKey, $workDirPos + strlen($workDir));
            }
            return $fileKey; // If workDir not found, use original fileKey
        }
        return $fileKey;
    }

    /**
     * Validate if the given work directory path is valid.
     *
     * @param string $workDir Work directory path to validate (can be relative or absolute)
     * @param string $userId User ID to validate against
     * @return bool True if valid, false otherwise
     */
    public static function isValidWorkDirectory(string $workDir, string $userId): bool
    {
        if (empty($workDir) || empty($userId)) {
            return false;
        }

        // Remove trailing slash if exists
        $workDir = rtrim($workDir, '/');

        // Check if it contains the expected pattern: SUPER_MAGIC/{userId}/project_{projectId}
        // The pattern should work for both relative and absolute paths
        $pattern = sprintf(
            '/.*\/%s\/%s\/project_\d+$/',
            preg_quote(AgentConstant::SUPER_MAGIC_CODE, '/'),
            preg_quote($userId, '/')
        );

        return preg_match($pattern, $workDir) === 1;
    }

    /**
     * Extract project ID from work directory path.
     *
     * @param string $workDir Work directory path (can be relative or absolute)
     * @param string $userId User ID to match against
     * @return null|string Project ID if found, null if not found or invalid format
     */
    public static function extractProjectIdFromAbsolutePath(string $workDir, string $userId): ?string
    {
        if (empty($workDir) || empty($userId)) {
            return null;
        }

        // Remove trailing slash if exists
        $workDir = rtrim($workDir, '/');

        // Expected format: path/to/SUPER_MAGIC/{userId}/project_{projectId}
        // We need to find the pattern: SUPER_MAGIC/{specificUserId}/project_{projectId}
        // The pattern should work for both relative and absolute paths
        $pattern = sprintf(
            '/.*\/%s\/%s\/project_(\d+)$/',
            preg_quote(AgentConstant::SUPER_MAGIC_CODE, '/'),
            preg_quote($userId, '/')
        );

        if (preg_match($pattern, $workDir, $matches)) {
            return $matches[1];
        }

        return null;
    }
}
