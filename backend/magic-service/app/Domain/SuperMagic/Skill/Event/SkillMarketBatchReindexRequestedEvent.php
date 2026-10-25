<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Event;

final readonly class SkillMarketBatchReindexRequestedEvent
{
    /**
     * @param array<int, string> $skillMarketIds
     */
    public function __construct(
        public array $skillMarketIds,
        public string $organizationCode,
        public string $operatorId,
        public bool $forceReEmbedding = false,
    ) {
    }
}
