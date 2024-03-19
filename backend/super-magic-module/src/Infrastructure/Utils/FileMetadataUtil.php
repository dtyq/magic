<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\Utils;

use Exception;

class FileMetadataUtil
{
    /**
     * Extract window.magicProjectConfig from JavaScript file and convert to PHP array
     * Supports any JSON object structure without caring about specific content.
     *
     * @param string $jsFilePath Path to the JavaScript file
     * @return null|array Returns the configuration array or null if not found
     * @throws Exception If file cannot be read or JSON is invalid
     */
    public static function extractMagicProjectConfig(string $jsFilePath): ?array
    {
        // Read file content with retry mechanism (max 3 attempts, 1 second delay)
        $jsContent = self::fetchFileContentWithRetry($jsFilePath, 3, 1);
        if ($jsContent === false || empty(trim($jsContent))) {
            throw new Exception('Failed to read file after retries: ' . $jsFilePath);
        }

        // Find window.magicProjectConfig assignment
        $startPos = strpos($jsContent, 'window.magicProjectConfig');
        if ($startPos === false) {
            return null;
        }

        // Find assignment operator and opening brace
        $assignPos = strpos($jsContent, '=', $startPos);
        if ($assignPos === false) {
            return null;
        }

        $bracePos = strpos($jsContent, '{', $assignPos);
        if ($bracePos === false) {
            return null;
        }

        // Extract complete JavaScript object
        $objectContent = self::extractJsObject($jsContent, $bracePos);
        if ($objectContent === null) {
            return null;
        }

        // Remove JavaScript comments before JSON conversion
        $objectContent = self::removeJsComments($objectContent);

        // Convert to valid JSON and decode
        $jsonString = self::jsObjectToJson($objectContent);
        $config = json_decode($jsonString, true);

        if ($config === null && json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid JSON: ' . json_last_error_msg());
        }

        return $config;
    }

    public static function getMetadataObject(?string $metadataStr): ?array
    {
        if ($metadataStr !== null) {
            $decodedMetadata = json_decode($metadataStr, true);
            return (json_last_error() === JSON_ERROR_NONE) ? $decodedMetadata : null;
        }
        return null;
    }

    /**
     * Extract JavaScript object by matching braces.
     */
    private static function extractJsObject(string $content, int $startPos): ?string
    {
        $braceCount = 0;
        $inString = false;
        $stringChar = null;
        $escaped = false;
        $length = strlen($content);

        for ($i = $startPos; $i < $length; ++$i) {
            $char = $content[$i];

            if ($escaped) {
                $escaped = false;
                continue;
            }

            if ($char === '\\') {
                $escaped = true;
                continue;
            }

            if (! $inString) {
                if ($char === '"' || $char === "'") {
                    $inString = true;
                    $stringChar = $char;
                } elseif ($char === '{') {
                    ++$braceCount;
                } elseif ($char === '}') {
                    --$braceCount;
                    if ($braceCount === 0) {
                        return substr($content, $startPos, $i - $startPos + 1);
                    }
                }
            } else {
                if ($char === $stringChar) {
                    $inString = false;
                    $stringChar = null;
                }
            }
        }

        return null;
    }

    /**
     * Convert JavaScript object to valid JSON.
     */
    private static function jsObjectToJson(string $jsObject)
    {
        // Remove trailing commas
        $jsObject = preg_replace('/,(\s*[}\]])/', '$1', $jsObject);

        // Quote unquoted property names
        $jsObject = preg_replace('/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/', '$1"$2":', $jsObject);

        // Convert single quotes to double quotes
        return preg_replace_callback(
            "/'([^'\\\\]*(\\\\.[^'\\\\]*)*)'/",
            function ($matches) {
                return '"' . str_replace('"', '\"', $matches[1]) . '"';
            },
            $jsObject
        );
    }

    /**
     * Safely remove JavaScript comments from content.
     *
     * Handles:
     * - Single-line comments: // comment
     * - Multi-line comments: /* comment * /
     * - Preserves comment-like content inside strings
     *
     * Performance optimizations:
     * - O(n) time complexity with single pass
     * - Quick check: returns immediately if no comment markers found
     * - Uses array for string building (faster than concatenation)
     *
     * @param string $jsContent JavaScript content to process
     * @return string Content with comments removed
     */
    private static function removeJsComments(string $jsContent): string
    {
        // Quick check: if no comment markers, return immediately
        if (strpos($jsContent, '//') === false && strpos($jsContent, '/*') === false) {
            return $jsContent;
        }

        $result = [];
        $length = strlen($jsContent);
        $i = 0;

        // State tracking
        $inString = false;
        $stringChar = null;
        $escaped = false;

        while ($i < $length) {
            $char = $jsContent[$i];
            $nextChar = ($i + 1 < $length) ? $jsContent[$i + 1] : null;

            // Handle escape sequences in strings
            if ($escaped) {
                $result[] = $char;
                $escaped = false;
                ++$i;
                continue;
            }

            // Inside a string
            if ($inString) {
                $result[] = $char;

                if ($char === '\\') {
                    $escaped = true;
                } elseif ($char === $stringChar) {
                    $inString = false;
                    $stringChar = null;
                }
                ++$i;
                continue;
            }

            // Not in a string - check for comments or string start
            if ($char === '"' || $char === "'") {
                // Start of string
                $inString = true;
                $stringChar = $char;
                $result[] = $char;
                ++$i;
                continue;
            }

            if ($char === '/' && $nextChar === '/') {
                // Single-line comment: skip until end of line
                $i += 2;
                while ($i < $length && $jsContent[$i] !== "\n") {
                    ++$i;
                }
                // Keep the newline to preserve line structure
                if ($i < $length) {
                    $result[] = "\n";
                    ++$i;
                }
                continue;
            }

            if ($char === '/' && $nextChar === '*') {
                // Multi-line comment: skip until */
                $i += 2;
                while ($i < $length - 1) {
                    if ($jsContent[$i] === '*' && $jsContent[$i + 1] === '/') {
                        $i += 2;
                        break;
                    }
                    // Preserve newlines to maintain line structure
                    if ($jsContent[$i] === "\n") {
                        $result[] = "\n";
                    }
                    ++$i;
                }
                continue;
            }

            // Regular character
            $result[] = $char;
            ++$i;
        }

        return implode('', $result);
    }

    /**
     * Fetch file content with retry mechanism.
     * Retries up to maxRetries times with retryDelay seconds between attempts if content is empty.
     *
     * @param string $filePath File path or URL to fetch
     * @param int $maxRetries Maximum number of retry attempts (default: 3)
     * @param int $retryDelay Delay in seconds between retries (default: 1)
     * @return false|string File content or false if failed after all retries
     */
    private static function fetchFileContentWithRetry(string $filePath, int $maxRetries = 3, int $retryDelay = 1): false|string
    {
        for ($attempt = 1; $attempt <= $maxRetries; ++$attempt) {
            // Suppress warnings with @ to handle them gracefully
            $content = @file_get_contents($filePath);

            // Check if content is successfully fetched and not empty
            if ($content !== false && ! empty(trim($content))) {
                // Success on first try or after retry
                if ($attempt > 1) {
                    error_log(sprintf(
                        'Successfully fetched file content on attempt %d/%d: %s',
                        $attempt,
                        $maxRetries,
                        $filePath
                    ));
                }
                return $content;
            }

            // Log retry attempt (only if not the last attempt)
            if ($attempt < $maxRetries) {
                error_log(sprintf(
                    'File content empty or failed, retrying... Attempt %d/%d, File: %s',
                    $attempt,
                    $maxRetries,
                    $filePath
                ));
                sleep($retryDelay);
            }
        }

        // All retries exhausted
        error_log(sprintf(
            'Failed to fetch file content after %d attempts: %s',
            $maxRetries,
            $filePath
        ));

        return false;
    }
}
