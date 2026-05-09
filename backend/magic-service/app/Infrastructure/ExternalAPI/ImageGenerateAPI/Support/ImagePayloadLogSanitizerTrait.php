<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Support;

trait ImagePayloadLogSanitizerTrait
{
    /**
     * Mask base64 images before writing request payloads to logs.
     */
    protected function sanitizePayloadForLog(array $payload): array
    {
        return $this->sanitizeValueForLog($payload);
    }

    /**
     * Recursively sanitize payload values while preserving non-base64 data.
     */
    private function sanitizeValueForLog(mixed $value): mixed
    {
        if (is_string($value)) {
            return $this->summarizeBase64DataUri($value) ?? $value;
        }

        if (! is_array($value)) {
            return $value;
        }

        if (isset($value['inlineData']) && is_array($value['inlineData']) && isset($value['inlineData']['data'])) {
            $inlineData = $value['inlineData'];
            $inlineData['data'] = $this->summarizeRawBase64ImageForLog(
                (string) $inlineData['data'],
                (string) ($inlineData['mimeType'] ?? 'application/octet-stream')
            );
            $value['inlineData'] = $inlineData;
        }

        $sanitized = [];
        foreach ($value as $key => $item) {
            $sanitized[$key] = $this->sanitizeValueForLog($item);
        }

        return $sanitized;
    }

    /**
     * Summarize a base64 image data URI for logs without exposing image content.
     */
    private function summarizeBase64DataUri(string $value): ?array
    {
        $base64Image = ImageBase64DataUriParser::parse($value);
        if ($base64Image === null) {
            return null;
        }

        return $this->summarizeRawBase64ImageForLog(
            $base64Image['base64_data'],
            $base64Image['mime_type']
        );
    }

    /**
     * Summarize raw base64 image content for logs without exposing image content.
     */
    private function summarizeRawBase64ImageForLog(string $base64Data, string $mimeType): array
    {
        $data = base64_decode($base64Data, true);
        if ($data === false) {
            return [
                'type' => 'base64_image',
                'mime_type' => ImageBase64DataUriParser::normalizeMimeType($mimeType),
                'bytes' => null,
                'sha256' => null,
            ];
        }

        return [
            'type' => 'base64_image',
            'mime_type' => ImageBase64DataUriParser::normalizeMimeType($mimeType),
            'bytes' => strlen($data),
            'sha256' => hash('sha256', $data),
        ];
    }
}
