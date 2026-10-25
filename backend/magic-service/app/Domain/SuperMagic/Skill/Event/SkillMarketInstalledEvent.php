<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Skill\Event;

/** Indicates that a skill has been successfully installed from the market. */
final readonly class SkillMarketInstalledEvent
{
    public function __construct(
        public string $skillMarketId,
        public string $organizationCode,
        public string $operatorId,
    ) {
    }
}
