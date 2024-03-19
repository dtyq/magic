<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Event\Subscribe\Agent\Agents;

use App\Domain\Chat\Event\Agent\UserCallAgentEvent;

interface AgentInterface
{
    public function execute(UserCallAgentEvent $event);
}
