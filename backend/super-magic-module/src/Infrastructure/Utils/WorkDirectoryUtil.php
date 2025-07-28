<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use App\Infrastructure\Core\ValueObject\StorageBucketType;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;

class WorkDirectoryUtil
{
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

    public static function generateDefaultWorkDirMetadata(): array
    {
        // x-amz-meta-
        return [
            'uid' => '0',
            'gid' => '0',
            'mode' => (string) 0755,
            'atime' => (string) microtime(true),
            'ctime' => (string) microtime(true),
            'mtime' => (string) microtime(true),
        ];
    }

    public static function getAgentChatHistoryDir(string $userId, int $projectId): string
    {
        return self::getRootDir($userId, $projectId) . '/.chat-history';
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
        return self::getRootDir($userId, $projectId) . sprintf('/runtime/topic_%s', $topicId);
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
        $currentDate = date('Ymd');
        return self::getRootDir($userId, $projectId) . '/runtime/pack/' . $currentDate . '/';
    }

    public static function getFullFileKey(string $prefix, string $workDir, string $path): string
    {
        return $prefix . trim($workDir, '/') . '/' . trim($path, '/');
    }

    public static function getFullWorkdir(string $prefix, string $workDir): string
    {
        return $prefix . trim($workDir, '/') . '/';
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

    public static function checkEffectiveFileKey(string $fullWorkdir, string $fileKey): bool
    {
        if (empty($fullWorkdir) || empty($fileKey)) {
            return false;
        }

        return self::isPathUnderDirectory($fullWorkdir, $fileKey);
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
     * Validate if a filename (without path) is valid for file operations.
     *
     * @param string $fileName Filename to validate (should not contain path separators)
     * @return bool True if the filename is valid, false otherwise
     *
     * Examples of INVALID inputs (will return false):
     * - '/a'           // Directory path (starts with /)
     * - '/b/'          // Directory path (starts and ends with /)
     * - 'dir/'         // Directory path (ends with /)
     * - 'a/b'          // Nested path
     * - 'dir\\file'    // Windows path separator
     * - '../file'      // Path traversal
     * - 'CON.txt'      // Windows reserved name
     * - 'file?.txt'    // Invalid characters
     * - ''             // Empty string
     * - '.'            // Current directory
     * - '..'           // Parent directory
     *
     * Examples of VALID inputs (will return true):
     * - 'document.txt'
     * - 'README.md'
     * - 'config.json'
     * - '用户手册.pdf'
     * - 'data-2024.csv'
     */
    public static function isValidFileName(string $fileName): bool
    {
        // Check if filename is empty
        if (empty(trim($fileName))) {
            return false;
        }

        // Trim the filename
        $fileName = trim($fileName);

        // Check for null bytes (security risk)
        if (strpos($fileName, "\0") !== false) {
            return false;
        }

        // Check for path separators (filename should not contain paths)
        if (strpos($fileName, '/') !== false || strpos($fileName, '\\') !== false) {
            return false;
        }

        // Check for dangerous characters that could cause file system issues
        // Windows forbidden characters: < > : " | ? *
        // Also check for control characters (ASCII 0-31)
        if (preg_match('/[<>:"|?*\x00-\x1f]/', $fileName)) {
            return false;
        }

        // Prevent path traversal patterns
        if (strpos($fileName, '..') !== false) {
            return false;
        }

        // Check filename length (typical filesystem limit is 255 bytes)
        if (strlen($fileName) > 255) {
            return false;
        }

        // Check for Windows reserved names (case-insensitive)
        // First, remove extension to check the base name
        $baseName = pathinfo($fileName, PATHINFO_FILENAME);
        $reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
        if (in_array(strtoupper($baseName), $reservedNames)) {
            return false;
        }

        // Check for filenames that are just dots
        if ($fileName === '.' || $fileName === '..') {
            return false;
        }

        // Check for filenames starting or ending with spaces or dots (problematic on Windows)
        if (preg_match('/^[\s.]+|[\s.]+$/', $fileName)) {
            return false;
        }

        return true;
    }

    /**
     * Check if a target path is under or equal to a specified base directory.
     *
     * @param string $basePath Base directory path to check against
     * @param string $targetPath Target path to validate
     * @return bool True if target path is under base path or equal to it, false otherwise
     *
     * Examples:
     * - isPathUnderDirectory('/workspace/project', '/workspace/project') → true (equal)
     * - isPathUnderDirectory('/workspace/project', '/workspace/project/file.txt') → true (under)
     * - isPathUnderDirectory('/workspace/project', '/workspace/project/subdir/file.txt') → true (nested)
     * - isPathUnderDirectory('/workspace/project', '/workspace') → false (parent)
     * - isPathUnderDirectory('/workspace/project', '/workspace/other') → false (sibling)
     * - isPathUnderDirectory('/workspace/project', '/workspace/project/../other') → false (traversal)
     */
    public static function isPathUnderDirectory(string $basePath, string $targetPath): bool
    {
        // Check for null bytes BEFORE trimming (security risk)
        if (strpos($basePath, "\0") !== false || strpos($targetPath, "\0") !== false) {
            return false;
        }

        // Check for empty paths
        if (empty(trim($basePath)) || empty(trim($targetPath))) {
            return false;
        }

        // Trim and normalize paths
        $basePath = trim($basePath);
        $targetPath = trim($targetPath);

        // Normalize paths by removing redundant separators and resolving . and .. components
        $normalizedBasePath = self::normalizePath($basePath);
        $normalizedTargetPath = self::normalizePath($targetPath);

        // If normalization failed (invalid paths), return false
        if ($normalizedBasePath === false || $normalizedTargetPath === false) {
            return false;
        }

        // Ensure both paths end with a trailing slash for proper comparison (except for exact equality)
        $basePathWithSlash = rtrim($normalizedBasePath, '/') . '/';
        $targetPathWithSlash = rtrim($normalizedTargetPath, '/') . '/';

        // Check if paths are exactly equal
        if ($normalizedBasePath === $normalizedTargetPath) {
            return true;
        }

        // Check if target path starts with base path (is under base directory)
        return strpos($targetPathWithSlash, $basePathWithSlash) === 0;
    }

    /**
     * Normalize a file path by resolving . and .. components and removing redundant separators.
     *
     * @param string $path Path to normalize
     * @return false|string Normalized path or false if path is invalid
     */
    private static function normalizePath(string $path): false|string
    {
        // Convert Windows backslashes to forward slashes
        $path = str_replace('\\', '/', $path);

        // Remove multiple consecutive slashes
        $path = preg_replace('#/+#', '/', $path);

        // Split path into components
        $isAbsolute = str_starts_with($path, '/');
        $components = array_filter(explode('/', $path), fn (string $part): bool => strlen($part) > 0);
        $normalizedComponents = [];

        foreach ($components as $component) {
            if ($component === '.') {
                // Current directory - skip
                continue;
            }
            if ($component === '..') {
                // Parent directory
                if (empty($normalizedComponents)) {
                    // If we're at the root and encounter .., this is invalid for absolute paths
                    if ($isAbsolute) {
                        return false;
                    }
                    // For relative paths, we can't go above the starting point in our context
                    return false;
                }
                // Go up one level
                array_pop($normalizedComponents);
            } else {
                // Regular component
                $normalizedComponents[] = $component;
            }
        }

        // Reconstruct the path
        $normalizedPath = ($isAbsolute ? '/' : '') . implode('/', $normalizedComponents);

        // Handle root directory case
        if ($isAbsolute && $normalizedPath === '/') {
            return '/';
        }

        // Remove trailing slash for non-root paths
        return rtrim($normalizedPath, '/');
    }
}
