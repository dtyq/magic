<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Event;

use App\Domain\Provider\Entity\ProviderConfigEntity;

/**
 * 服务商配置创建事件.
 */
class ProviderConfigCreatedEvent
{
    public function __construct(
        public readonly ProviderConfigEntity $providerConfigEntity,
        public readonly string $organizationCode,
        public readonly string $language,
    ) {
    }
}
