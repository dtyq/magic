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
}
