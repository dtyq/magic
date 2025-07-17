<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Repository\Persistence;

use App\Domain\Agent\Entity\MagicAgentEntity;
use App\Domain\Agent\Entity\ValueObject\AgentDataIsolation;
use App\Domain\Agent\Entity\ValueObject\Query\MagicAgentQuery;
use App\Domain\Agent\Factory\MagicAgentFactory;
use App\Domain\Agent\Repository\Facade\AgentRepositoryInterface;
use App\Domain\Agent\Repository\Persistence\Model\MagicAgentModel;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Core\ValueObject\Page;

class AgentRepository extends AbstractRepository implements AgentRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    /**
     * 查询 Agent 列表.
     *
     * @return array{total: int, list: array<MagicAgentEntity>}
     */
    public function queries(AgentDataIsolation $agentDataIsolation, MagicAgentQuery $agentQuery, Page $page): array
    {
        $builder = $this->createBuilder($agentDataIsolation, MagicAgentModel::query());

        // 设置查询条件
        if (! is_null($agentQuery->getIds())) {
            if (empty($agentQuery->getIds())) {
                return ['total' => 0, 'list' => []];
            }
            $builder->whereIn('id', $agentQuery->getIds());
        }
        if ($agentQuery->getStatus()) {
            $builder->where('status', '=', $agentQuery->getStatus());
        }
        if ($agentQuery->getAgentName()) {
            $builder->where('robot_name', 'like', '%' . $agentQuery->getAgentName() . '%');
        }

        // 分页查询
        $data = $this->getByPage($builder, $page, $agentQuery);
        $list = [];
        /** @var MagicAgentModel $agent */
        foreach ($data['list'] as $agent) {
            $list[] = MagicAgentFactory::modelToEntity($agent);
        }
        $data['list'] = $list;
        return $data;
    }
}
