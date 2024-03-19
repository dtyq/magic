<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Service;

use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentCategoryRepositoryInterface;

/**
 * Agent 分类领域服务.
 */
class SuperMagicAgentCategoryDomainService
{
    public function __construct(
        protected AgentCategoryRepositoryInterface $agentCategoryRepository
    ) {
    }

    /**
     * 获取分类列表（包含每个分类下的员工数量统计）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @return array<array{id: int, name_i18n: array, logo: ?string, sort_order: int, crew_count: int}> 分类列表
     */
    public function getCategoriesWithCrewCount(SuperMagicAgentDataIsolation $dataIsolation): array
    {
        return $this->agentCategoryRepository->getCategoriesWithCrewCount($dataIsolation);
    }
}
