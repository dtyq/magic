<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Service;

use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentVersionRepositoryInterface;

/**
 * Agent 版本领域服务.
 */
class SuperMagicAgentVersionDomainService
{
    public function __construct(
        protected AgentVersionRepositoryInterface $agentVersionRepository
    ) {
    }
}
