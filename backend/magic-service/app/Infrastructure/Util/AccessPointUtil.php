<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util;

class AccessPointUtil
{
    // 国内接入点
    public const DOMESTIC = 'domestic_access_points';

    // 国际接入点
    public const INTERNATIONAL = 'international_access_point';

    public static function getAccessPointUrl(string $accessPoint): ?string
    {
        return [
            self::DOMESTIC => config('services.domestic_magic_service.host'),
            self::INTERNATIONAL => config('services.international_magic_service.host'),
        ][$accessPoint] ?? null;
    }
}
