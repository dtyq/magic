<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use InvalidArgumentException;

/** Normalize URL/data-URI/base64 media inputs for video providers. */
final class ReferenceMediaPayload
{
    /** @var array<string, true> */
    private const array ALLOWED_MIME_TYPES = [
        'image/jpeg' => true,
        'image/jpg' => true,
        'image/png' => true,
        'image/webp' => true,
        'video/mp4' => true,
        'video/webm' => true,
        'audio/mpeg' => true,
        'audio/mp3' => true,
        'audio/wav' => true,
        'audio/x-wav' => true,
    ];

    public static function normalize(array $media, string $context = 'reference media', ?string $defaultMimeType = null): string
    {
        $uri = is_string($media['uri'] ?? null) ? trim($media['uri']) : '';
        if ($uri !== '') {
            return self::normalizeUri($uri, $context);
        }

        $base64 = is_string($media['base64'] ?? null) && $media['base64'] !== ''
            ? $media['base64']
            : ($media['base64_data'] ?? null);
        if (! is_string($base64) || $base64 === '') {
            throw new InvalidArgumentException($context . ' must contain a valid uri or base64 value.');
        }
        $mimeType = self::normalizeMimeType($media['mime_type'] ?? $defaultMimeType, $context);
        self::decodeBase64($base64, $context);

        return 'data:' . $mimeType . ';base64,' . $base64;
    }

    private static function normalizeUri(string $uri, string $context): string
    {
        $scheme = strtolower((string) parse_url($uri, PHP_URL_SCHEME));
        if ($scheme === 'http' || $scheme === 'https') {
            if (filter_var($uri, FILTER_VALIDATE_URL) === false) {
                throw new InvalidArgumentException($context . ' URL is invalid.');
            }
            return $uri;
        }
        if ($scheme !== 'data') {
            throw new InvalidArgumentException($context . ' uri must be an HTTP(S) URL or data URI.');
        }
        if (! preg_match('/^data:([^;,\s]+);base64,(.*)$/s', $uri, $matches)) {
            throw new InvalidArgumentException($context . ' data URI is invalid.');
        }
        $mimeType = self::normalizeMimeType($matches[1], $context);
        self::decodeBase64($matches[2], $context);

        return 'data:' . $mimeType . ';base64,' . $matches[2];
    }

    private static function normalizeMimeType(mixed $mimeType, string $context): string
    {
        $mimeType = is_string($mimeType) ? strtolower(trim($mimeType)) : '';
        if ($mimeType === '' || ! isset(self::ALLOWED_MIME_TYPES[$mimeType])) {
            throw new InvalidArgumentException($context . ' MIME type is unsupported.');
        }
        return $mimeType;
    }

    private static function decodeBase64(string $base64, string $context): string
    {
        if ($base64 === '' || strlen($base64) % 4 !== 0 || preg_match('/[^A-Za-z0-9+\/=]/', $base64) === 1 || preg_match('/={3,}/', $base64) === 1) {
            throw new InvalidArgumentException($context . ' base64 value is invalid.');
        }
        $decoded = base64_decode($base64, true);
        if ($decoded === false) {
            throw new InvalidArgumentException($context . ' base64 value is invalid.');
        }
        return $decoded;
    }
}
