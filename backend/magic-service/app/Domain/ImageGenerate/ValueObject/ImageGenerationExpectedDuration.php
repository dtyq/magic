<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ImageGenerate\ValueObject;

final class ImageGenerationExpectedDuration
{
    public static function resolveSeconds(?string $resolution, ?string $size): int
    {
        $resolution = strtolower(trim((string) $resolution));
        if (! in_array($resolution, ['1k', '2k', '4k'], true)) {
            $resolution = self::resolveResolution($size);
        }

        return match ($resolution) {
            '4k' => 120,
            '2k' => 90,
            default => 60,
        };
    }

    private static function resolveResolution(?string $size): string
    {
        $size = strtolower(trim((string) $size));
        if (in_array($size, ['1k', '2k', '4k'], true)) {
            return $size;
        }
        if (preg_match('/^(\d+)[x×*](\d+)$/u', $size, $matches) !== 1) {
            return '1k';
        }

        $totalPixels = (int) $matches[1] * (int) $matches[2];
        if ($totalPixels >= 4096 * 2160) {
            return '4k';
        }
        if ($totalPixels >= 2048 * 1080) {
            return '2k';
        }
        return '1k';
    }
}
