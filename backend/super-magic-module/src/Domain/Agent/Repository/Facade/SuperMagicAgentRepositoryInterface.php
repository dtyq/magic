<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Facade;

use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\SuperMagicAgentQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;

interface SuperMagicAgentRepositoryInterface
{
    public function getByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?SuperMagicAgentEntity;

    /**
     * @return array{total: int, list: array<SuperMagicAgentEntity>}
     */
    public function queries(SuperMagicAgentDataIsolation $dataIsolation, SuperMagicAgentQuery $query, Page $page): array;

    /**
     * 保存SuperMagic Agent.
     */
    public function save(SuperMagicAgentDataIsolation $dataIsolation, SuperMagicAgentEntity $entity): SuperMagicAgentEntity;

    /**
     * 删除SuperMagic Agent.
     */
    public function delete(SuperMagicAgentDataIsolation $dataIsolation, string $code): bool;

    /**
     * 统计指定创建者的智能体数量.
     */
    public function countByCreator(SuperMagicAgentDataIsolation $dataIsolation, string $creator): int;
}
