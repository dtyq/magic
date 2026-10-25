<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Event;

/** Indicates that a reviewed Skill version is now published in the market. */
final readonly class SkillMarketPublishedEvent
{
    public function __construct(
        public string $skillMarketId,
        public string $organizationCode,
        public string $operatorId,
    ) {
    }
}
