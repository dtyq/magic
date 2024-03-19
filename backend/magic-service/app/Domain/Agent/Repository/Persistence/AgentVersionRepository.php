<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Repository\Persistence;

use App\Domain\Agent\Constant\MagicAgentReleaseStatus;
use App\Domain\Agent\Constant\MagicAgentVersionStatus;
use App\Domain\Agent\Entity\MagicAgentVersionEntity;
use App\Domain\Agent\Entity\ValueObject\AgentDataIsolation;
use App\Domain\Agent\Factory\MagicAgentVersionFactory;
use App\Domain\Agent\Repository\Facade\AgentVersionRepositoryInterface;
use App\Domain\Agent\Repository\Persistence\Model\MagicAgentModel;
use App\Domain\Agent\Repository\Persistence\Model\MagicAgentVersionModel;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowVersionQuery;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Core\ValueObject\Page;

class AgentVersionRepository extends AbstractRepository implements AgentVersionRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    /**
     * 获取组织内可用的 Agent 版本.
     *
     * @return array{total: int, list: array<MagicAgentVersionEntity>}
     */
    public function getOrgAvailableAgents(AgentDataIsolation $dataIsolation, MagicFLowVersionQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, MagicAgentModel::query());
        $versionBuilder = $this->createBuilder($dataIsolation, MagicAgentVersionModel::query());

        // 查询所有的启用版本 id
        $botVersionIds = $builder
            ->where('status', '=', MagicAgentVersionStatus::ENTERPRISE_ENABLED->value)
            ->whereNotNull('bot_version_id')
            ->pluck('bot_version_id')->toArray();
        if (empty($botVersionIds)) {
            return ['total' => 0, 'list' => []];
        }

        $versionBuilder->whereIn('id', $botVersionIds);
        $versionBuilder->where('release_scope', '=', MagicAgentReleaseStatus::PUBLISHED_TO_ENTERPRISE->value);
        $data = $this->getByPage($versionBuilder, $page, $query);
        $list = [];
        /** @var MagicAgentVersionModel $item */
        foreach ($data['list'] as $item) {
            $list[] = MagicAgentVersionFactory::toEntity($item->toArray());
        }
        $data['list'] = $list;
        return $data;
    }
}
