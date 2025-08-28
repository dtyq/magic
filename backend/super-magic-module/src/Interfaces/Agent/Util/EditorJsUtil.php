<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\Util;

/**
 * Editor.js data conversion utility
 * @see https://editorjs.io/saving-data/
 */
class EditorJsUtil
{
    /**
     * Convert Editor.js data format to plain text string
     * 
     * @param array $editorData Editor.js data format
     * @return string Plain text representation
     */
    public static function convertToString(array $editorData): string
    {
        if (empty($editorData['blocks'])) {
            return '';
        }

        $textParts = [];

        foreach ($editorData['blocks'] as $block) {
            $blockText = self::convertBlockToString($block);
            if (!empty($blockText)) {
                $textParts[] = $blockText;
            }
        }

        return implode("\n\n", $textParts);
    }

    /**
     * Convert a single block to string
     * 
     * @param array $block Single block data
     * @return string Block text representation
     */
    private static function convertBlockToString(array $block): string
    {
        $type = $block['type'] ?? '';
        $data = $block['data'] ?? [];

        switch ($type) {
            case 'paragraph':
                return self::stripHtmlTags($data['text'] ?? '');

            case 'header':
            case 'heading':
                $level = $data['level'] ?? 1;
                $text = self::stripHtmlTags($data['text'] ?? '');
                $prefix = str_repeat('#', $level);
                return "{$prefix} {$text}";

            case 'list':
                return self::convertListToString($data);

            case 'quote':
                $text = self::stripHtmlTags($data['text'] ?? '');
                $caption = !empty($data['caption']) ? ' - ' . self::stripHtmlTags($data['caption']) : '';
                return "> {$text}{$caption}";

            case 'code':
                return "```\n" . ($data['code'] ?? '') . "\n```";

            case 'delimiter':
                return '* * *';

            case 'table':
                return self::convertTableToString($data);

            case 'checklist':
                return self::convertChecklistToString($data);

            case 'embed':
                $service = $data['service'] ?? '';
                $source = $data['source'] ?? '';
                return "[{$service}]: {$source}";

            case 'image':
                $caption = !empty($data['caption']) ? $data['caption'] : 'Image';
                return "[Image: {$caption}]";

            case 'raw':
                return $data['html'] ?? '';

            default:
                // For unknown block types, try to extract any text content
                return self::extractTextFromUnknownBlock($data);
        }
    }

    /**
     * Convert list block to string
     */
    private static function convertListToString(array $data): string
    {
        $items = $data['items'] ?? [];
        $style = $data['style'] ?? 'unordered';
        
        if (empty($items)) {
            return '';
        }

        $listText = [];
        foreach ($items as $index => $item) {
            $text = self::stripHtmlTags($item);
            if ($style === 'ordered') {
                $listText[] = ($index + 1) . ". {$text}";
            } else {
                $listText[] = "• {$text}";
            }
        }

        return implode("\n", $listText);
    }

    /**
     * Convert table block to string
     */
    private static function convertTableToString(array $data): string
    {
        $content = $data['content'] ?? [];
        if (empty($content)) {
            return '';
        }

        $tableText = [];
        foreach ($content as $row) {
            if (is_array($row)) {
                $rowText = array_map(function($cell) {
                    return self::stripHtmlTags($cell);
                }, $row);
                $tableText[] = '| ' . implode(' | ', $rowText) . ' |';
            }
        }

        return implode("\n", $tableText);
    }

    /**
     * Convert checklist block to string
     */
    private static function convertChecklistToString(array $data): string
    {
        $items = $data['items'] ?? [];
        if (empty($items)) {
            return '';
        }

        $checklistText = [];
        foreach ($items as $item) {
            $text = self::stripHtmlTags($item['text'] ?? '');
            $checked = ($item['checked'] ?? false) ? '[x]' : '[ ]';
            $checklistText[] = "{$checked} {$text}";
        }

        return implode("\n", $checklistText);
    }

    /**
     * Extract text from unknown block types
     */
    private static function extractTextFromUnknownBlock(array $data): string
    {
        // Try to find text in common field names
        $textFields = ['text', 'content', 'caption', 'title', 'description'];
        
        foreach ($textFields as $field) {
            if (!empty($data[$field])) {
                return self::stripHtmlTags($data[$field]);
            }
        }

        // If no text found, return empty string
        return '';
    }

    /**
     * Strip HTML tags and decode entities
     */
    private static function stripHtmlTags(string $text): string
    {
        // Remove HTML tags but preserve content
        $text = strip_tags($text);
        
        // Decode HTML entities
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        
        // Clean up whitespace
        return trim($text);
    }

    /**
     * Validate Editor.js data format
     */
    public static function isValidEditorJsData(array $data): bool
    {
        // Basic validation: should have blocks array
        if (!isset($data['blocks']) || !is_array($data['blocks'])) {
            return false;
        }

        // Validate each block has required structure
        foreach ($data['blocks'] as $block) {
            if (!is_array($block) || !isset($block['type']) || !isset($block['data'])) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get plain text summary (first N characters)
     */
    public static function getSummary(array $editorData, int $maxLength = 200): string
    {
        $fullText = self::convertToString($editorData);
        
        if (mb_strlen($fullText) <= $maxLength) {
            return $fullText;
        }

        return mb_substr($fullText, 0, $maxLength) . '...';
    }
}
