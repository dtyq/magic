<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Service;

final readonly class ImageGenerationPayloadSanitizer
{
    private const string DATA_URI_PREFIX = 'data:';

    private const string BASE64_SEPARATOR = ';base64,';

    private const array SUPPORTED_IMAGE_MIME_TYPES = [
        'image/png' => true,
        'image/jpeg' => true,
        'image/jpg' => true,
        'image/gif' => true,
        'image/webp' => true,
    ];

    private const array RAW_BASE64_FIELD_NAMES = [
        'b64_json' => true,
        'binary_data_base64' => true,
        'bytesBase64Encoded' => true,
        'bytes_base64_encoded' => true,
    ];

    public function sanitize(array $payload): array
    {
        /* @var array $sanitized */
        return $this->sanitizeValue($payload, null);
    }

    private function sanitizeValue(mixed $value, null|int|string $key): mixed
    {
        if (is_string($value)) {
            return $this->summarizeBase64DataUri($value)
                ?? ($this->isRawBase64Field($key) ? $this->summarizeRawBase64($value) : null)
                ?? $value;
        }

        if (! is_array($value)) {
            return $value;
        }

        if (isset($value['inlineData']) && is_array($value['inlineData'])) {
            $value['inlineData'] = $this->sanitizeInlineData($value['inlineData']);
        }

        if (isset($value['data']) && is_string($value['data']) && $this->hasImageMimeType($value)) {
            $value['data'] = $this->summarizeRawBase64(
                $value['data'],
                (string) ($value['mimeType'] ?? $value['mime_type'] ?? 'application/octet-stream')
            );
        }

        $sanitized = [];
        foreach ($value as $key => $item) {
            $sanitized[$key] = $this->sanitizeValue($item, $key);
        }

        return $sanitized;
    }

    private function sanitizeInlineData(array $inlineData): array
    {
        if (isset($inlineData['data']) && is_string($inlineData['data'])) {
            $inlineData['data'] = $this->summarizeRawBase64(
                $inlineData['data'],
                (string) ($inlineData['mimeType'] ?? $inlineData['mime_type'] ?? 'application/octet-stream')
            );
        }

        return $inlineData;
    }

    private function summarizeBase64DataUri(string $value): ?array
    {
        if (! str_starts_with($value, self::DATA_URI_PREFIX)) {
            return null;
        }

        $separatorPosition = strpos($value, self::BASE64_SEPARATOR);
        if ($separatorPosition === false) {
            return null;
        }

        $mimeType = strtolower(substr($value, strlen(self::DATA_URI_PREFIX), $separatorPosition - strlen(self::DATA_URI_PREFIX)));
        if (! isset(self::SUPPORTED_IMAGE_MIME_TYPES[$mimeType])) {
            return null;
        }

        $base64Data = trim(substr($value, $separatorPosition + strlen(self::BASE64_SEPARATOR)));
        return $this->summarizeDecodedBase64Image(
            base64_decode($base64Data, true),
            $this->normalizeMimeType($mimeType)
        );
    }

    private function summarizeRawBase64(string $value, ?string $mimeType = null): ?array
    {
        $base64Data = preg_replace('/\s+/', '', $value);
        if (! is_string($base64Data) || $base64Data === '' || ! preg_match('/^[A-Za-z0-9+\/]+={0,2}$/', $base64Data)) {
            return null;
        }

        return $this->summarizeDecodedBase64Image(
            base64_decode($base64Data, true),
            $this->isSupportedImageMimeType($mimeType) ? $this->normalizeMimeType((string) $mimeType) : 'application/octet-stream'
        );
    }

    private function summarizeDecodedBase64Image(false|string $binaryData, string $mimeType): array
    {
        return [
            'type' => 'base64_image_omitted',
            'mime_type' => $this->normalizeMimeType($mimeType),
            'bytes' => $binaryData === false ? null : strlen($binaryData),
            'sha256' => $binaryData === false ? null : hash('sha256', $binaryData),
        ];
    }

    private function hasImageMimeType(array $value): bool
    {
        return $this->isSupportedImageMimeType($value['mimeType'] ?? $value['mime_type'] ?? null);
    }

    private function isSupportedImageMimeType(mixed $mimeType): bool
    {
        return is_string($mimeType) && isset(self::SUPPORTED_IMAGE_MIME_TYPES[strtolower($mimeType)]);
    }

    private function normalizeMimeType(string $mimeType): string
    {
        $mimeType = strtolower($mimeType);
        return $mimeType === 'image/jpg' ? 'image/jpeg' : $mimeType;
    }

    private function isRawBase64Field(null|int|string $key): bool
    {
        return is_string($key) && isset(self::RAW_BASE64_FIELD_NAMES[$key]);
    }
}
