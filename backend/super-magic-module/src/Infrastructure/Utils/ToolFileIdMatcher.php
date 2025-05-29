<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use Throwable;

/**
 * Tool File ID Matcher Utility
 * Handles file ID matching for various tool types with their attachments.
 */
class ToolFileIdMatcher
{
    /**
     * Match file_id for various tool types
     * Handles special processing for different tool types that need file_id matching from attachments.
     */
    public static function matchFileIdForTools(?array &$tool): void
    {
        if (empty($tool) || empty($tool['attachments']) || empty($tool['detail'])) {
            return;
        }

        $toolType = $tool['detail']['type'] ?? '';
        if (empty($toolType)) {
            return;
        }

        try {
            $matcher = self::getToolFileIdMatcher($toolType);
            if ($matcher !== null) {
                $matcher($tool);
            }
        } catch (Throwable $e) {
            // Silent fail for utility methods
        }
    }

    /**
     * Get all supported tool types.
     */
    public static function getSupportedToolTypes(): array
    {
        return ['browser', 'image'];
    }

    /**
     * Get the appropriate file ID matcher for the given tool type.
     */
    private static function getToolFileIdMatcher(string $toolType): ?callable
    {
        $matchers = [
            'browser' => [self::class, 'matchBrowserToolFileId'],
            'image' => [self::class, 'matchImageToolFileId'],
        ];

        return $matchers[$toolType] ?? null;
    }

    /**
     * Match file_id for browser tool
     * Special handling: when tool type is browser and has file_key but no file_id (for frontend compatibility).
     */
    private static function matchBrowserToolFileId(array &$tool): void
    {
        if (empty($tool['detail']['data']['file_key'])) {
            return;
        }

        $fileKey = $tool['detail']['data']['file_key'];
        foreach ($tool['attachments'] as $attachment) {
            if (self::isFileKeyMatch($attachment, $fileKey)) {
                $tool['detail']['data']['file_id'] = $attachment['file_id'];
                break; // Exit loop immediately after finding match
            }
        }
    }

    /**
     * Match file_id for image tool
     * Fuzzy matching: match attachments by file_name using fuzzy matching against file_key.
     */
    private static function matchImageToolFileId(array &$tool): void
    {
        if (empty($tool['detail']['data']['file_name'])) {
            return;
        }

        $fileName = $tool['detail']['data']['file_name'];
        foreach ($tool['attachments'] as $attachment) {
            if (self::isFileNameMatch($attachment, $fileName)) {
                $tool['detail']['data']['file_id'] = $attachment['file_id'];
                break; // Exit loop immediately after finding match
            }
        }
    }

    /**
     * Check if attachment matches the given file key.
     */
    private static function isFileKeyMatch(array $attachment, string $fileKey): bool
    {
        return ! empty($attachment['file_key'])
            && $attachment['file_key'] === $fileKey
            && ! empty($attachment['file_id']);
    }

    /**
     * Check if attachment matches the given file name using fuzzy matching.
     * Supports multiple matching strategies for better compatibility.
     */
    private static function isFileNameMatch(array $attachment, string $fileName): bool
    {
        if (empty($attachment['file_key']) || empty($attachment['file_id'])) {
            return false;
        }

        // Extract filename from file_key path
        $attachmentFileName = basename($attachment['file_key']);

        // Strategy 1: Exact match
        if ($attachmentFileName === $fileName) {
            return true;
        }

        // Strategy 2: Case-insensitive match
        if (strcasecmp($attachmentFileName, $fileName) === 0) {
            return true;
        }

        // Strategy 3: Match without extension
        $attachmentBaseName = pathinfo($attachmentFileName, PATHINFO_FILENAME);
        $targetBaseName = pathinfo($fileName, PATHINFO_FILENAME);
        if (strcasecmp($attachmentBaseName, $targetBaseName) === 0) {
            return true;
        }

        // Strategy 4: Fuzzy match using similar_text for partial matches
        $similarity = 0;
        similar_text(strtolower($attachmentFileName), strtolower($fileName), $similarity);
        if ($similarity >= 90) { // 90% similarity threshold
            return true;
        }

        return false;
    }
}
