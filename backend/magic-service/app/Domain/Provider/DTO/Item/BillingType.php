<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item;

enum BillingType: string
{
    case Tokens = 'Tokens'; // token 计价
    case Times = 'Times'; // 次数计价
    case Per_Second = 'Per_Second'; // 按秒计价

    public function isTokens(): bool
    {
        return $this->value === self::Tokens->value;
    }

    public function isTimes(): bool
    {
        return $this->value === self::Times->value;
    }

    public function isPerSecond(): bool
    {
        return $this->value === self::Per_Second->value;
    }
}
