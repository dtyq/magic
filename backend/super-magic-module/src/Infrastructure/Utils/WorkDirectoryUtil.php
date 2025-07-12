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

    /**
     * Generate a unique 8-character alphanumeric string from a snowflake ID.
     * The same snowflake ID will always produce the same result.
     *
     * Risk: Theoretical collision probability is ~50% at 2.1M different snowflake IDs
     * due to birthday paradox with 36^8 possible combinations.
     *
     * @param string $snowflakeId Snowflake ID (e.g., "785205968218931200")
     * @return string 8-character alphanumeric string
     */
    public static function generateUniqueCodeFromSnowflakeId(string $snowflakeId): string
    {
        // Use SHA-256 hash to ensure deterministic output and good distribution
        $hash = hash('sha256', $snowflakeId);

        // Use multiple parts of the hash to reduce collision probability
        // Take from different positions and combine them
        $part1 = substr($hash, 0, 16);   // First 16 hex chars
        $part2 = substr($hash, 16, 16);  // Next 16 hex chars
        $part3 = substr($hash, 32, 16);  // Next 16 hex chars
        $part4 = substr($hash, 48, 16);  // Last 16 hex chars

        // XOR the parts to create better distribution
        $combined = '';
        for ($i = 0; $i < 16; ++$i) {
            $xor = hexdec($part1[$i]) ^ hexdec($part2[$i]) ^ hexdec($part3[$i]) ^ hexdec($part4[$i]);
            $combined .= dechex($xor);
        }

        // Convert to base36 for alphanumeric output
        $base36 = base_convert($combined, 16, 36);

        // Take first 8 characters
        $result = substr($base36, 0, 8);

        // Ensure we have exactly 8 characters by padding if necessary
        if (strlen($result) < 8) {
            $result = str_pad($result, 8, '0', STR_PAD_LEFT);
        }

        return $result;
    }
}
