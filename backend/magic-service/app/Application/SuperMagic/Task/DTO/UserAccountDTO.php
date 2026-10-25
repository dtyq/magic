<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Task\DTO;

final readonly class UserAccountDTO
{
    public function __construct(
        public UserSubscriptionDTO $subscription,
        public UserPointsDTO $points,
    ) {
    }
}
