<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;
use Exception;
use InvalidArgumentException;

class WorkDirectoryUtil
{
    public static function getFullPrefix(string $organizationCode): string
    {
        $md5Key = md5(StorageBucketType::Private->value);
        $appId = config('kk_brd_service.app_id');

        return "{$organizationCode}/{$appId}/{$md5Key}" . '/';
    }

    public static function getPrefix(string $workDir): string
    {
        $md5Key = md5(StorageBucketType::Private->value);
        return "{$md5Key}/" . trim($workDir, '/') . '/';
    }

    public static function getRootDir(string $userId, int $projectId): string
    {
        return sprintf('/%s/%s/project_%d', AgentConstant::SUPER_MAGIC_CODE, $userId, $projectId);
    }

    public static function getWorkDir(string $userId, int $projectId): string
    {
        return self::getRootDir($userId, $projectId) . '/workspace';
    }

    public static function getAgentChatHistoryDir(string $userId, int $projectId): string
    {
        return self::getRootDir($userId, $projectId) . '/chat-history';
    }

    /**
     * Get topic root directory path.
     *
     * @param string $userId User ID
     * @param int $projectId Project ID
     * @param int $topicId Topic ID
     * @return string Topic root directory path
     */
    public static function getTopicRootDir(string $userId, int $projectId, int $topicId): string
    {
        return self::getRootDir($userId, $projectId) . sprintf('/.runtime/topic_%s', $topicId);
    }

    public static function getTopicUploadDir(string $userId, int $projectId, int $topicId): string
    {
        return self::getTopicRootDir($userId, $projectId, $topicId) . '/uploads';
    }

    public static function getTopicMessageDir(string $userId, int $projectId, int $topicId): string
    {
        return self::getTopicRootDir($userId, $projectId, $topicId) . '/message';
    }

    public static function getProjectFilePackDir(string $userId, int $projectId): string
    {
        return self::getRootDir($userId, $projectId) . '/.runtime/pack';
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

        // Check if it contains the expected pattern: SUPER_MAGIC/{userId}/project_{projectId}[/workspace]
        // Supports both legacy format (project_id only) and new format (with /workspace suffix)
        // The pattern should work for both relative and absolute paths
        $pattern = sprintf(
            '/(?:.*\/%s|^%s)\/%s\/project_\d+(\/workspace)?$/',
            preg_quote(AgentConstant::SUPER_MAGIC_CODE, '/'),
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

        // Expected format: path/to/SUPER_MAGIC/{userId}/project_{projectId}[/workspace]
        // Supports both legacy format (project_id only) and new format (with /workspace suffix)
        // We need to find the pattern: SUPER_MAGIC/{specificUserId}/project_{projectId}
        // The pattern should work for both relative and absolute paths
        $pattern = sprintf(
            '/(?:.*\/%s|^%s)\/%s\/project_(\d+)(?:\/workspace)?$/',
            preg_quote(AgentConstant::SUPER_MAGIC_CODE, '/'),
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

    /**
     * Validate target name for file operations.
     *
     * @param string $targetName Target name to validate
     * @throws Exception If validation fails
     */
    public static function validateTargetName(string $targetName): void
    {
        // Check if target_name is empty
        if (empty(trim($targetName))) {
            throw new InvalidArgumentException('Target name is required');
        }

        // Trim the target name
        $targetName = trim($targetName);

        // Check for null bytes (security risk)
        if (strpos($targetName, "\0") !== false) {
            throw new InvalidArgumentException('Target name contains invalid null byte');
        }

        // Remove or validate dangerous characters that could cause file system issues
        // Windows forbidden characters: < > : " | ? *
        // Also check for control characters (ASCII 0-31)
        if (preg_match('/[<>:"|?*\x00-\x1f]/', $targetName)) {
            throw new InvalidArgumentException('Target name contains invalid characters');
        }

        // Prevent path traversal attacks
        if (strpos($targetName, '..') !== false) {
            throw new InvalidArgumentException('Target name contains path traversal attempt');
        }

        // Check for excessive path depth (prevent overly deep nesting)
        $pathParts = array_filter(explode('/', trim($targetName, '/')));
        if (count($pathParts) > 10) {  // Maximum 10 levels deep
            throw new InvalidArgumentException('Target name path is too deep (maximum 10 levels allowed)');
        }

        // Check individual path components
        foreach ($pathParts as $part) {
            // Each part should not be empty after trimming
            $part = trim($part);
            if (empty($part)) {
                throw new InvalidArgumentException('Target name contains empty path component');
            }

            // Each part should not be too long (typical filesystem limit is 255 bytes)
            if (strlen($part) > 255) {
                throw new InvalidArgumentException('Target name component is too long (maximum 255 bytes per component)');
            }

            // Check for Windows reserved names (case-insensitive)
            $reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
            if (in_array(strtoupper($part), $reservedNames)) {
                throw new InvalidArgumentException("Target name contains reserved name: {$part}");
            }
        }

        // Check total path length (typical limit is 4096 bytes on most systems)
        if (strlen($targetName) > 1000) {  // Conservative limit
            throw new InvalidArgumentException('Target name is too long (maximum 1000 characters allowed)');
        }
    }
}
