<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item;

enum BillingType: string
{
    case Token = 'Token'; // token 计价
    case Time = 'Time'; // 次数计价
}
