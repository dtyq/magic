<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Repository\Facade;

use App\Domain\Agent\Entity\MagicAgentEntity;
use App\Domain\Agent\Entity\ValueObject\Query\MagicAgentQuery;
use App\Infrastructure\Core\ValueObject\Page;

interface MagicAgentRepositoryInterface
{
    /**
     * @return array{total: int, list: array<MagicAgentEntity>}
     */
    public function queries(MagicAgentQuery $query, Page $page): array;

    public function getByFlowCode(string $flowCode): ?MagicAgentEntity;

    /**
     * @return MagicAgentEntity[]
     */
    public function getByFlowCodes(array $flowCodes): array;

    public function insert(MagicAgentEntity $agentEntity);

    public function updateById(MagicAgentEntity $agentEntity): MagicAgentEntity;

    public function updateStatus(string $agentId, int $status);

    public function getAgentsByUserId(string $userId, int $page, int $pageSize, string $agentName): array;

    public function getAgentsByUserIdCount(string $userId, string $agentName): int;

    public function deleteAgentById(string $id, string $organizationCode);

    public function getAgentById(string $agentId): MagicAgentEntity;

    public function getByCode(string $organizationCode, string $code): MagicAgentEntity;

    public function findByCode(string $organizationCode, string $code): ?MagicAgentEntity;
}
