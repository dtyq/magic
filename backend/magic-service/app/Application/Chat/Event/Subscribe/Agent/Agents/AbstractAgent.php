<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Event\Subscribe\Agent\Agents;

use App\Domain\Chat\Event\Agent\UserCallAgentEvent;
use RuntimeException;

class AbstractAgent implements AgentInterface
{
    public function execute(UserCallAgentEvent $event)
    {
        throw new RuntimeException('execute方法未实现');
    }
}
