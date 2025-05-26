<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Event;

use Hyperf\Odin\Api\Response\Usage;

class ChatUsageEvent
{
    public function __construct(
        public string $modelId,
        public Usage $usage,
        public string $organizationCode,
        public string $userId,
        public string $appId = '',
        public string $serviceProviderModelId = '',
    ) {
    }
}
