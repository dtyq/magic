<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

class WorkFileUtil
{
    public static function isHiddenFile(string $fileKey): bool
    {
        // Remove leading slash, uniform processing
        $fileKey = ltrim($fileKey, '/');

        // Split path into parts
        $pathParts = explode('/', $fileKey);

        // Check if each path part starts with .
        foreach ($pathParts as $part) {
            if (! empty($part) && str_starts_with($part, '.')) {
                return true; // It's a hidden file
            }
        }

        return false; // It's not a hidden file
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
     * Check if a file path is a snapshot file.
     * Snapshot files are located in .webview-reports or .browser_screenshots directories.
     *
     * @param string $filePath File path to check
     * @return bool True if the file is a snapshot file, false otherwise
     */
    public static function isSnapshotFile(string $filePath): bool
    {
        // Check if file path is empty
        if (empty(trim($filePath))) {
            return false;
        }

        // Normalize path separators and trim
        $normalizedPath = str_replace('\\', '/', trim($filePath));

        // Split path into components
        $components = explode('/', $normalizedPath);

        // Check if any component is exactly .webview-reports or .browser_screenshots
        foreach ($components as $component) {
            if ($component === '.webview-reports' || $component === '.browser_screenshots' || $component === '.visual') {
                return true;
            }
        }

        return false;
    }
}
