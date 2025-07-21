<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Repository\Facade;

use App\Domain\Agent\Entity\MagicAgentVersionEntity;
use App\Domain\Agent\Entity\ValueObject\AgentDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowVersionQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface AgentVersionRepositoryInterface
{
    /**
     * 获取组织内可用的 Agent 版本.
     *
     * @return array{total: int, list: array<MagicAgentVersionEntity>}
     */
    public function getOrgAvailableAgents(AgentDataIsolation $dataIsolation, MagicFLowVersionQuery $query, Page $page): array;
}
