<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Event;

/** Indicates that a market skill was successfully uninstalled. */
final readonly class SkillMarketUninstalledEvent
{
    public function __construct(
        public string $skillMarketId,
        public string $organizationCode,
        public string $operatorId,
    ) {
    }
}
