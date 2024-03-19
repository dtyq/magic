<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Persistence;

use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\PublishStatus;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\AgentCategoryRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\AgentCategoryModel;

/**
 * Agent 分类仓储实现.
 */
class AgentCategoryRepository extends SuperMagicAbstractRepository implements AgentCategoryRepositoryInterface
{
    public function __construct(
        protected AgentCategoryModel $agentCategoryModel
    ) {
    }

    /**
     * 查询分类列表（包含每个分类下的员工数量统计）.
     */
    public function getCategoriesWithCrewCount(SuperMagicAgentDataIsolation $dataIsolation): array
    {
        $builder = $this->agentCategoryModel::query();

        $results = $builder
            ->select([
                'magic_super_magic_agent_categories.id',
                'magic_super_magic_agent_categories.name_i18n',
                'magic_super_magic_agent_categories.logo',
                'magic_super_magic_agent_categories.sort_order',
                'magic_super_magic_agent_categories.created_at',
            ])
            ->selectRaw('COUNT(store_agent.id) as crew_count')
            ->leftJoin('magic_super_magic_agent_market as store_agent', function ($join) {
                $join->on('magic_super_magic_agent_categories.id', '=', 'store_agent.category_id')
                    ->where('store_agent.publish_status', '=', PublishStatus::PUBLISHED->value)
                    ->whereNull('store_agent.deleted_at');
            })
            ->whereNull('magic_super_magic_agent_categories.deleted_at')
            ->groupBy(
                'magic_super_magic_agent_categories.id',
                'magic_super_magic_agent_categories.name_i18n',
                'magic_super_magic_agent_categories.logo',
                'magic_super_magic_agent_categories.sort_order',
                'magic_super_magic_agent_categories.created_at'
            )
            ->orderBy('magic_super_magic_agent_categories.sort_order', 'DESC')
            ->orderBy('magic_super_magic_agent_categories.created_at', 'ASC')
            ->get();

        $categories = [];
        foreach ($results as $result) {
            $categories[] = [
                'id' => $result->id,
                'name_i18n' => $result->name_i18n,
                'logo' => $result->logo,
                'sort_order' => $result->sort_order,
                'crew_count' => (int) $result->crew_count,
            ];
        }

        return $categories;
    }
}
