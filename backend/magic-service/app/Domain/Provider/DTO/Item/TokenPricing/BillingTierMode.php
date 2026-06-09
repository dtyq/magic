<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\DTO\Item\TokenPricing;

enum BillingTierMode: string
{
    case Fixed = 'fixed';
    case Tiered = 'tiered';
}
