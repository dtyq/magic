<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Common\Repository;

use App\Domain\SuperMagic\Agent\Entity\ValueObject\AgentMarketType;
use App\Domain\SuperMagic\Agent\Repository\Persistence\Model\AgentMarketModel;
use App\Domain\SuperMagic\Agent\Repository\Persistence\Model\SuperMagicAgentModel;
use App\Domain\SuperMagic\Project\Repository\Model\ProjectModel;
use App\Domain\SuperMagic\Skill\Repository\Persistence\Model\SkillModel;
use Hyperf\Database\Model\Model;

/** Persistence seam for locking and changing ownership without rewriting resource content. */
class ResourceTransferRepository
{
    public function lock(bool $isAgent, string $organizationCode, string $code): ?Model
    {
        $model = $isAgent ? SuperMagicAgentModel::class : SkillModel::class;
        return $model::query()->where('organization_code', $organizationCode)
            ->where('code', $code)->lockForUpdate()->first();
    }

    public function lockProject(int $projectId): ?Model
    {
        return ProjectModel::query()->where('id', $projectId)->lockForUpdate()->first();
    }

    /** Keep shelf scope and version snapshots intact, including hidden/offline shelves. */
    public function transferOrganizationMarketOwner(string $organizationCode, string $code, string $receiverId): array
    {
        $query = AgentMarketModel::query()->where('organization_code', $organizationCode)
            ->where('agent_code', $code)->where('market_type', AgentMarketType::ORGANIZATION->value);
        $ids = (clone $query)->lockForUpdate()->pluck('id')->all();
        if ($ids !== []) {
            $query->whereIn('id', $ids)->update(['publisher_id' => $receiverId]);
        }
        return $ids;
    }

    public function changeOwner(Model $resource, bool $isAgent, string $receiverId): void
    {
        $resource->setAttribute($isAgent ? 'creator' : 'creator_id', $receiverId);
        $resource->save();
    }
}
