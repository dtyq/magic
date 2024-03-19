<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Event;

/**
 * 服务商模型删除事件.
 */
class ProviderModelDeletedEvent
{
    public function __construct(
        public readonly string $modelId,
        public readonly int $serviceProviderConfigId,
        public readonly string $organizationCode
    ) {
    }
}
