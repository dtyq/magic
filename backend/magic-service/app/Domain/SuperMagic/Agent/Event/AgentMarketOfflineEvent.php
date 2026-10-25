<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Agent\Event;

final readonly class AgentMarketOfflineEvent
{
    public function __construct(
        public string $agentMarketId,
        public string $organizationCode,
        public string $operatorId,
    ) {
    }
}
