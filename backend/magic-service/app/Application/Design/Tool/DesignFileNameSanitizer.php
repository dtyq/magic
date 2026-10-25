<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Tool;

final class DesignFileNameSanitizer
{
    private const string REFERENCE_TOKEN_PATTERN = '/(?:\[(?:图片|视频|音频|image|video|audio)\s*\d+\]|\{\{(?:image|video|audio)_\d+\}\}|@(?:图片|视频|音频|image|video|audio)\s*\d+)/iu';

    public static function sanitize(string $fileName): string
    {
        $fileName = (string) preg_replace(self::REFERENCE_TOKEN_PATTERN, '', $fileName);
        $fileName = preg_replace('/[`\'\"]+/', '', $fileName) ?? '';
        $fileName = preg_replace('/[\/\:*?"<>|\x00-\x1F]+/u', '_', $fileName) ?? '';
        $fileName = preg_replace('/_+/u', '_', $fileName) ?? '';
        $fileName = trim($fileName, " \t\n\r\0\x0B_.-");
        if (mb_strlen($fileName) > 30) {
            $fileName = mb_substr($fileName, 0, 30);
        }

        return $fileName;
    }

    public static function sanitizePrompt(string $prompt): string
    {
        $prompt = (string) preg_replace(self::REFERENCE_TOKEN_PATTERN, ' ', $prompt);
        return trim((string) preg_replace('/\s+/u', ' ', $prompt));
    }
}
