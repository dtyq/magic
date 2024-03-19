<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Event\Agent;

interface AgentExecuteInterface
{
    public function agentExecEvent(UserCallAgentEvent $userCallAgentEvent);
}
