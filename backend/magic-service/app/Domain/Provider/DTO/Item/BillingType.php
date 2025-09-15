<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item;

enum BillingType: string
{
    case Token = 'Tokens'; // token 计价
    case Time = 'Times'; // 次数计价
}
