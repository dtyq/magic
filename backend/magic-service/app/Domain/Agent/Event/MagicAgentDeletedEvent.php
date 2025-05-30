<?php

namespace App\Domain\Agent\Event;

use App\Domain\Agent\Entity\MagicAgentEntity;

class MagicAgentDeletedEvent
{

    public function __construct(public MagicAgentEntity $agentEntity)
    {
    }

}