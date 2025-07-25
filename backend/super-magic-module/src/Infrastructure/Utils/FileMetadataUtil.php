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
        // Read file content
        $jsContent = file_get_contents($jsFilePath);
        if ($jsContent === false) {
            throw new Exception('Failed to read file: ' . $jsFilePath);
        }

        // Find window.magicProjectConfig assignment
        $startPos = strpos($jsContent, 'window.magicProjectConfig');
        if ($startPos === false) {
            return null;
        }

        // Find assignment operator and opening brace
        $assignPos = strpos($jsContent, '=', $startPos);
        $bracePos = strpos($jsContent, '{', $assignPos);
        if ($assignPos === false || $bracePos === false) {
            return null;
        }

        // Extract complete JavaScript object
        $objectContent = self::extractJsObject($jsContent, $bracePos);
        if ($objectContent === null) {
            return null;
        }

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
}
