<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Transport\Ipc\Uds;

use RuntimeException;

final class IpcFrameCodec
{
    public const string MAGIC = 'MIPC';

    public const int VERSION = 2;

    public const int CODEC_IDENTITY = 0;

    public const int CODEC_GZIP = 1;

    public const int HEADER_SIZE = 10;

    public const int IDENTITY_THRESHOLD_BYTES = 10 * 1024;

    /**
     * @return array{raw_json_bytes:int,frame_bytes:int,frame_codec:string}
     */
    public static function summarizeJson(string $rawJson): array
    {
        $frame = self::buildFrame($rawJson);

        return [
            'raw_json_bytes' => $frame['raw_json_bytes'],
            'frame_bytes' => self::HEADER_SIZE + strlen($frame['payload']),
            'frame_codec' => self::codecName($frame['codec']),
        ];
    }

    public static function encodeFrame(string $rawJson, int $maxMessageBytes): string
    {
        $frame = self::buildFrame($rawJson);
        $frameBody = self::MAGIC
            . chr(self::VERSION)
            . chr($frame['codec'])
            . pack('N', $frame['raw_json_bytes'])
            . $frame['payload'];

        if ($maxMessageBytes > 0 && strlen($frameBody) > $maxMessageBytes) {
            throw new RuntimeException(sprintf(
                'IPC frame too large: codec=%s frame_bytes=%d raw_json_bytes=%d max=%d',
                self::codecName($frame['codec']),
                strlen($frameBody),
                $frame['raw_json_bytes'],
                $maxMessageBytes,
            ));
        }

        return $frameBody;
    }

    public static function decodeFrame(string $frameBody): string
    {
        return self::decodeFrameWithSummary($frameBody)['payload'];
    }

    /**
     * @return array{payload:string,raw_json_bytes:int,frame_bytes:int,frame_codec:string}
     */
    public static function decodeFrameWithSummary(string $frameBody): array
    {
        if (strlen($frameBody) < self::HEADER_SIZE) {
            throw new RuntimeException('IPC frame too short');
        }
        if (! str_starts_with($frameBody, self::MAGIC)) {
            throw new RuntimeException('Invalid IPC frame magic');
        }

        $version = ord($frameBody[4]);
        if ($version !== self::VERSION) {
            throw new RuntimeException(sprintf('Unsupported IPC frame version: %d', $version));
        }

        $codec = ord($frameBody[5]);
        $rawJsonBytes = unpack('N', substr($frameBody, 6, 4))[1];
        $payload = substr($frameBody, self::HEADER_SIZE);

        $rawJson = match ($codec) {
            self::CODEC_IDENTITY => $payload,
            self::CODEC_GZIP => self::decodeGzipPayload($payload),
            default => throw new RuntimeException(sprintf('Unsupported IPC frame codec: %d', $codec)),
        };

        if (strlen($rawJson) !== $rawJsonBytes) {
            throw new RuntimeException(sprintf(
                'IPC frame raw length mismatch: codec=%s decoded=%d expected=%d',
                self::codecName($codec),
                strlen($rawJson),
                $rawJsonBytes,
            ));
        }

        return [
            'payload' => $rawJson,
            'raw_json_bytes' => $rawJsonBytes,
            'frame_bytes' => strlen($frameBody),
            'frame_codec' => self::codecName($codec),
        ];
    }

    /**
     * @return array{codec:int,payload:string,raw_json_bytes:int}
     */
    private static function buildFrame(string $rawJson): array
    {
        $rawJsonBytes = strlen($rawJson);
        if ($rawJsonBytes > 0xFFFFFFFF) {
            throw new RuntimeException(sprintf('IPC raw JSON payload too large: %d', $rawJsonBytes));
        }

        if ($rawJsonBytes <= self::IDENTITY_THRESHOLD_BYTES) {
            return [
                'codec' => self::CODEC_IDENTITY,
                'payload' => $rawJson,
                'raw_json_bytes' => $rawJsonBytes,
            ];
        }

        $compressed = gzencode($rawJson, -1, ZLIB_ENCODING_GZIP);
        if (! is_string($compressed)) {
            throw new RuntimeException('Failed to gzip IPC payload');
        }

        return [
            'codec' => self::CODEC_GZIP,
            'payload' => $compressed,
            'raw_json_bytes' => $rawJsonBytes,
        ];
    }

    private static function decodeGzipPayload(string $payload): string
    {
        $decoded = @gzdecode($payload);
        if (! is_string($decoded)) {
            throw new RuntimeException('Failed to decode IPC gzip payload');
        }
        return $decoded;
    }

    private static function codecName(int $codec): string
    {
        return match ($codec) {
            self::CODEC_IDENTITY => 'identity',
            self::CODEC_GZIP => 'gzip',
            default => 'unknown',
        };
    }
}
