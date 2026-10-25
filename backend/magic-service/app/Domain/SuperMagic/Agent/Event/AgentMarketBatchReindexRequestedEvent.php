<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Agent\Event;

final readonly class AgentMarketBatchReindexRequestedEvent
{
    /** @param array<int, string> $agentMarketIds */
    public function __construct(
        public array $agentMarketIds,
        public string $organizationCode,
        public string $operatorId,
        public bool $forceReEmbedding = false,
    ) {
    }
}
