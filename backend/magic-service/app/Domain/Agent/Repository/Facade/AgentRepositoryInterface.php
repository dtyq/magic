<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Repository\Facade;

use App\Domain\Agent\Entity\MagicAgentEntity;
use App\Domain\Agent\Entity\ValueObject\AgentDataIsolation;
use App\Domain\Agent\Entity\ValueObject\Query\MagicAgentQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface AgentRepositoryInterface
{
    /**
     * 查询 Agent 列表.
     *
     * @return array{total: int, list: array<MagicAgentEntity>}
     */
    public function queries(AgentDataIsolation $agentDataIsolation, MagicAgentQuery $agentQuery, Page $page): array;
}
