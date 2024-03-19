<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

class ModelGatewayOfficialApp
{
    public const string APP_CODE = 'Magic';

    public static function isOfficialApp(string $code): bool
    {
        return strtolower($code) === strtolower(self::APP_CODE);
    }
}
