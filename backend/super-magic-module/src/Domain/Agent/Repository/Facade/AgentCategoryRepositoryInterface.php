<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Facade;

use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;

/**
 * Agent 分类仓储接口.
 */
interface AgentCategoryRepositoryInterface
{
    /**
     * 查询分类列表（包含每个分类下的员工数量统计）.
     *
     * @param SuperMagicAgentDataIsolation $dataIsolation 数据隔离对象
     * @return array<array{id: int, name_i18n: array, logo: ?string, sort_order: int, crew_count: int}> 分类列表，包含员工数量统计
     */
    public function getCategoriesWithCrewCount(SuperMagicAgentDataIsolation $dataIsolation): array;
}
