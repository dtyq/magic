<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Audit\Repository;

use App\Domain\Audit\ResourceAccess\Entity\ResourceAccessLogEntity;
use App\Domain\Audit\ResourceAccess\Repository\Facade\ResourceAccessLogRepositoryInterface;
use App\Infrastructure\Audit\Repository\Model\ResourceAccessLogModel;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\DbConnection\Db;

use function Hyperf\Support\now;

class ResourceAccessLogRepository implements ResourceAccessLogRepositoryInterface
{
    public function save(ResourceAccessLogEntity $entity): ResourceAccessLogEntity
    {
        $model = ResourceAccessLogModel::create([
            'organization_code' => $entity->getOrganizationCode(),
            'user_id' => $entity->getUserId(),
            'user_name' => $entity->getUserName(),
            'actor_type' => $entity->getActorType(),
            'resource_type' => $entity->getResourceType(),
            'resource_code' => $entity->getResourceCode(),
            'resource_name' => $entity->getResourceName(),
            'operation' => $entity->getOperation(),
            'source' => $entity->getSource(),
            'request_id' => $entity->getRequestId(),
            'context' => $entity->getContext(),
            'created_at' => $entity->getCreatedAt() ?? now(),
            'updated_at' => $entity->getUpdatedAt() ?? now(),
        ]);

        $entity->setId($model->id);
        return $entity;
    }

    /** @return array{list: array<int, array{resource_code: string, latest_used_at: null|string}>, total?: int} */
    public function queriesRecentlyUsedResources(
        string $organizationCode,
        string $userId,
        string $resourceType,
        string $operation,
        Page $page,
        bool $withTotal = false
    ): array {
        $builder = ResourceAccessLogModel::query()
            ->where('organization_code', $organizationCode)
            ->where('user_id', $userId)
            ->where('resource_type', $resourceType)
            ->where('operation', $operation)
            ->select('resource_code')
            ->selectRaw('MAX(created_at) AS latest_used_at')
            ->groupBy('resource_code')
            ->orderByDesc('latest_used_at')
            ->orderByDesc('resource_code');

        $total = $withTotal
            ? Db::table('magic_resource_access_logs')->fromSub($builder->getQuery(), 'recent_usage')->count()
            : null;

        if ($page->isEnabled()) {
            $builder->forPage($page->getPage(), $page->getPageNum());
        }

        $result = [
            'list' => array_map(static fn ($row): array => [
                'resource_code' => (string) $row->resource_code,
                'latest_used_at' => $row->latest_used_at === null ? null : (string) $row->latest_used_at,
            ], $builder->get()->all()),
        ];

        if ($total !== null) {
            $result['total'] = $total;
        }

        return $result;
    }
}
