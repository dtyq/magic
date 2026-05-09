<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Support;

use InvalidArgumentException;

final class ImageBase64DataUriParser
{
    private const DATA_URI_PREFIX = 'data:';

    private const BASE64_SEPARATOR = ';base64,';

    private const SUPPORTED_IMAGE_MIME_TYPES = [
        'image/png' => true,
        'image/jpeg' => true,
        'image/jpg' => true,
        'image/gif' => true,
        'image/webp' => true,
    ];

    /**
     * Parse a supported image data URI; return null for normal URLs or unsupported strings.
     *
     * @return null|array{mime_type:string, extension:string, base64_data:string, binary_data?:string}
     */
    public static function parse(string $image, bool $decode = false): ?array
    {
        if (! str_starts_with($image, self::DATA_URI_PREFIX)) {
            return null;
        }

        $separatorPosition = strpos($image, self::BASE64_SEPARATOR);
        if ($separatorPosition === false) {
            return null;
        }

        $mimeType = strtolower(substr($image, strlen(self::DATA_URI_PREFIX), $separatorPosition - strlen(self::DATA_URI_PREFIX)));
        if (! isset(self::SUPPORTED_IMAGE_MIME_TYPES[$mimeType])) {
            return null;
        }

        $mimeType = self::normalizeMimeType($mimeType);
        $base64Data = trim(substr($image, $separatorPosition + strlen(self::BASE64_SEPARATOR)));
        $result = [
            'mime_type' => $mimeType,
            'extension' => self::extensionFromMimeType($mimeType),
            'base64_data' => $base64Data,
        ];

        if ($decode) {
            $binaryData = base64_decode($base64Data, true);
            if ($binaryData === false) {
                throw new InvalidArgumentException('Invalid base64 image data');
            }
            $result['binary_data'] = $binaryData;
        }

        return $result;
    }

    /**
     * Parse and decode a supported image data URI.
     *
     * @return null|array{mime_type:string, extension:string, base64_data:string, binary_data:string}
     */
    public static function parseDecoded(string $image): ?array
    {
        $result = self::parse($image, true);
        if ($result === null) {
            return null;
        }

        /* @var array{mime_type:string, extension:string, base64_data:string, binary_data:string} $result */
        return $result;
    }

    /**
     * Validate whether the input is a decodable image data URI.
     */
    public static function isValid(string $image): bool
    {
        try {
            return self::parseDecoded($image) !== null;
        } catch (InvalidArgumentException) {
            return false;
        }
    }

    /**
     * Normalize MIME aliases used by clients and upstream providers.
     */
    public static function normalizeMimeType(string $mimeType): string
    {
        return $mimeType === 'image/jpg' ? 'image/jpeg' : $mimeType;
    }

    /**
     * Resolve the file extension used by multipart uploads.
     */
    private static function extensionFromMimeType(string $mimeType): string
    {
        return match ($mimeType) {
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            default => 'jpg',
        };
    }
}
