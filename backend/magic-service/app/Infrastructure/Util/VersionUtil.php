<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util;

final class VersionUtil
{
    public const INITIAL_VERSION = '1.0.0';

    public const INVALID_VERSION_FALLBACK = 'v1.0.0';

    private const VERSION_PATTERN = '/^(?<prefix>[vV]?)(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)(?:\.(?<patch>0|[1-9]\d*))?$/D';

    public static function getNextVersion(?string $version): string
    {
        if ($version === null || $version === '') {
            return self::INITIAL_VERSION;
        }

        if (preg_match(self::VERSION_PATTERN, $version, $matches) !== 1) {
            return self::INVALID_VERSION_FALLBACK;
        }

        $prefix = $matches['prefix'];
        $major = $matches['major'];
        $minor = (int) $matches['minor'];

        if (($matches['patch'] ?? '') === '') {
            return sprintf('%s%s.%d', $prefix, $major, $minor + 1);
        }

        return sprintf('%s%s.%d.%d', $prefix, $major, $minor, ((int) $matches['patch']) + 1);
    }

    public static function isValidVersion(string $version): bool
    {
        return preg_match(self::VERSION_PATTERN, $version) === 1;
    }

    public static function getValidationRule(): string
    {
        return 'regex:' . self::VERSION_PATTERN;
    }
}
