<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Event;

final readonly class SkillMarketUpdatedEvent
{
    public function __construct(
        public string $skillMarketId,
        public string $organizationCode,
        public string $operatorId,
    ) {
    }
}
