<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Event\Agent;

use App\Domain\Agent\Entity\MagicAgentVersionEntity;
use App\Infrastructure\Core\AbstractEvent;

class MagicAgentInstructEvent extends AbstractEvent
{
    public function __construct(
        public MagicAgentVersionEntity $magicBotVersionEntity,
    ) {
    }
}
