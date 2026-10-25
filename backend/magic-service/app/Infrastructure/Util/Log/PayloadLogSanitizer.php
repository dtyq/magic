<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Log;

use Hyperf\Codec\Json;
use Throwable;

/**
 * Sanitize provider payloads for logs without changing their structure.
 */
final class PayloadLogSanitizer
{
    private const int MIN_BASE64_BYTES = 64;

    /**
     * Recursively summarize base64 values while keeping all other values unchanged.
     */
    public static function sanitizeValue(mixed $value): mixed
    {
        if (is_array($value)) {
            $sanitized = [];
            foreach ($value as $itemKey => $item) {
                $sanitized[$itemKey] = self::sanitizeValue($item);
            }

            return $sanitized;
        }

        if (is_string($value)) {
            return self::sanitizeString($value);
        }

        return $value;
    }

    /**
     * Sanitize a raw provider error body before writing it to logs.
     */
    public static function sanitizeResponseBody(string $body): string
    {
        try {
            $decoded = Json::decode($body);
            if (is_array($decoded)) {
                return Json::encode(
                    self::sanitizeValue($decoded),
                    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
                );
            }
        } catch (Throwable) {
        }

        $sanitized = self::sanitizeValue($body);

        return is_string($sanitized)
            ? $sanitized
            : Json::encode($sanitized, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private static function sanitizeString(string $value): mixed
    {
        $trimmedValue = trim($value);
        if ($trimmedValue === '') {
            return $value;
        }

        if (preg_match('#^data:(?<mime>[-\w.+/]+);base64,(?<data>.*)$#is', $trimmedValue, $matches) === 1) {
            return self::summarizeDataUri((string) $matches['mime'], (string) $matches['data']);
        }

        if (self::looksLikeBase64($trimmedValue)) {
            return self::summarizeBase64($trimmedValue);
        }

        return $value;
    }

    /**
     * @return array{type: string, mime_type: string, base64_length: int}
     */
    private static function summarizeDataUri(string $mimeType, string $base64Data): array
    {
        return [
            'type' => 'data_uri',
            'mime_type' => strtolower(trim($mimeType)),
            'base64_length' => strlen($base64Data),
        ];
    }

    /**
     * @return array{type: string, base64_length: int}
     */
    private static function summarizeBase64(string $base64Data): array
    {
        return [
            'type' => 'base64',
            'base64_length' => strlen($base64Data),
        ];
    }

    private static function looksLikeBase64(string $value): bool
    {
        if (strlen($value) < self::MIN_BASE64_BYTES) {
            return false;
        }

        return strspn($value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\r\n') === strlen($value);
    }
}
