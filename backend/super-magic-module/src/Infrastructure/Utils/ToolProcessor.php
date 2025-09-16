<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use App\Infrastructure\Util\IdGenerator\IdGenerator;

/**
 * Tool Processor Utility
 * Handles various tool processing operations including file ID matching and output content generation.
 */
class ToolProcessor
{
    /**
     * Process tool attachments and match file IDs.
     */
    public static function processToolAttachments(?array &$tool): void
    {
        ToolFileIdMatcher::matchFileIdForTools($tool);
    }

    /**
     * Generate output content tool based on attachments.
     * Prioritizes HTML files, then MD files, and selects files with specific keywords.
     */
    public static function generateOutputContentTool(array $attachments): ?array
    {
        if (empty($attachments)) {
            return null;
        }

        $file = self::selectBestOutputFile($attachments);

        if (empty($file)) {
            return null;
        }

        return [
            'id' => (string) IdGenerator::getSnowId(),
            'name' => 'finish_task',
            'action' => '',
            'detail' => [
                'type' => self::determineFileType($file['file_extension'] ?? ''),
                'data' => [
                    'file_name' => $file['filename'] ?? '',
                    'content' => '',
                    'file_id' => $file['file_id'] ?? '',
                    'metadata' => $file['metadata'] ?? [],
                ],
            ],
            'remark' => '',
            'status' => 'finished',
            'attachments' => [],
        ];
    }

    /**
     * Get supported tool types for file ID matching.
     */
    public static function getSupportedToolTypes(): array
    {
        return ToolFileIdMatcher::getSupportedToolTypes();
    }

    /**
     * Select the best output file from attachments.
     * Priority: HTML files with keywords > HTML files > MD files with keywords (exclude todo.md) > MD files (exclude todo.md) > Random file.
     */
    private static function selectBestOutputFile(array $attachments): ?array
    {
        $htmlFiles = [];
        $mdFiles = [];
        $otherFiles = [];

        // Group files by type
        foreach ($attachments as $attachment) {
            $extension = strtolower($attachment['file_extension'] ?? '');
            $filename = strtolower($attachment['filename'] ?? '');

            if ($extension === 'html') {
                $htmlFiles[] = $attachment;
            } elseif ($extension === 'md' && $filename !== 'todo.md') {
                // Exclude todo.md files
                $mdFiles[] = $attachment;
            } else {
                $otherFiles[] = $attachment;
            }
        }

        // Priority 1: HTML files with keywords
        if (! empty($htmlFiles)) {
            $keywordHtmlFiles = self::selectFileWithKeywords($htmlFiles);
            if ($keywordHtmlFiles !== null) {
                return $keywordHtmlFiles;
            }
        }

        // Priority 2: HTML files (largest)
        if (! empty($htmlFiles)) {
            return self::getMaxSizeFile($htmlFiles);
        }

        // Priority 3: MD files with keywords (excluding todo.md)
        if (! empty($mdFiles)) {
            $keywordMdFiles = self::selectFileWithKeywords($mdFiles);
            if ($keywordMdFiles !== null) {
                return $keywordMdFiles;
            }
        }

        // Priority 4: MD files (largest, excluding todo.md)
        if (! empty($mdFiles)) {
            return self::getMaxSizeFile($mdFiles);
        }

        // Priority 5: Random file from all remaining files
        $allRemainingFiles = array_merge($htmlFiles, $mdFiles, $otherFiles);
        if (! empty($allRemainingFiles)) {
            return self::getRandomFile($allRemainingFiles);
        }

        return null;
    }

    /**
     * Select files that contain specific keywords in their filename.
     */
    private static function selectFileWithKeywords(array $files): ?array
    {
        $keywordFiles = array_filter($files, function ($item) {
            $filename = strtolower($item['filename'] ?? '');
            return strpos($filename, 'final') !== false || strpos($filename, 'report') !== false;
        });

        return ! empty($keywordFiles) ? self::getMaxSizeFile($keywordFiles) : null;
    }

    /**
     * Get the file with the maximum size from an array of files.
     */
    private static function getMaxSizeFile(array $files): ?array
    {
        if (empty($files)) {
            return null;
        }

        return array_reduce($files, function ($carry, $item) {
            if ($carry === null || (int) ($item['file_size'] ?? 0) > (int) ($carry['file_size'] ?? 0)) {
                return $item;
            }
            return $carry;
        });
    }

    /**
     * Get a random file from an array of files.
     */
    private static function getRandomFile(array $files): ?array
    {
        if (empty($files)) {
            return null;
        }

        $randomIndex = array_rand($files);
        return $files[$randomIndex];
    }

    /**
     * Determine the appropriate file type for the tool detail.
     */
    private static function determineFileType(string $extension): string
    {
        $extension = strtolower($extension);

        // Image formats
        $imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif'];

        if (in_array($extension, $imageExtensions)) {
            return 'image';
        }

        return match ($extension) {
            'html' => 'html',
            'md' => 'md',
            default => 'text'
        };
    }
}
