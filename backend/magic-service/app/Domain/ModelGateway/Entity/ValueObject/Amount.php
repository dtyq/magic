<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject;

class Amount
{
    public const int Scale = 6;

    public static function isEnough(float $total, float $used): bool
    {
        if (bccomp(bcsub((string) $total, (string) $used, self::Scale), '0', self::Scale) <= 0) {
            return false;
        }
        return true;
    }

    public static function calculateCost(int $token, float $costPer1000, float $exchangeRate): string
    {
        if ($token <= 0 || $costPer1000 <= 0 || $exchangeRate <= 0) {
            return '0';
        }
        $inputCost = bcmul(bcdiv((string) $token, '1000', self::Scale), (string) $costPer1000, self::Scale);
        return bcmul($inputCost, (string) $exchangeRate, self::Scale);
    }
}
