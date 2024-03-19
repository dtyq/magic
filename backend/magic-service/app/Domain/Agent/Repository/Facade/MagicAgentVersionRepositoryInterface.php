<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Repository\Facade;

use App\Domain\Agent\Entity\MagicAgentVersionEntity;

interface MagicAgentVersionRepositoryInterface
{
    public function insert(MagicAgentVersionEntity $agentVersionEntity): MagicAgentVersionEntity;

    public function getAgentById(string $id): ?MagicAgentVersionEntity;

    public function getAgentsByOrganization(string $organizationCode, array $agentIds, int $page, int $pageSize, string $agentName): array;

    public function getAgentsByOrganizationCount(string $organizationCode, array $agentIds, string $agentName): int;

    public function getAgentsFromMarketplace(array $agentIds, int $page, int $pageSize): array;

    public function getAgentsFromMarketplaceCount(array $agentIds): int;
}
