<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Event;

use App\Domain\Provider\Entity\ProviderModelEntity;

/**
 * 服务商模型更新事件.
 */
class ProviderModelUpdatedEvent
{
    public function __construct(
        public readonly ProviderModelEntity $providerModelEntity,
        public readonly string $organizationCode
    ) {
    }
}
