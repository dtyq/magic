<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Persistence;

use App\Domain\Provider\Entity\ModelIdentifierMappingEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Query\ModelIdentifierMappingQuery;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Repository\Facade\ModelIdentifierMappingRepositoryInterface;
use App\Domain\Provider\Repository\Persistence\Model\ModelIdentifierMappingModel;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Database\Model\Builder as ModelBuilder;
use Hyperf\DbConnection\Db;

class ModelIdentifierMappingRepository extends AbstractRepository implements ModelIdentifierMappingRepositoryInterface
{
    /**
     * 查询映射组并在数据库层完成分页和组内聚合。
     */
    public function queryGroups(ProviderDataIsolation $dataIsolation, ModelIdentifierMappingQuery $query, Page $page): array
    {
        $baseQuery = $this->createBuilder($dataIsolation, ModelIdentifierMappingModel::query())->whereNull('deleted_at');
        if ($query->getKeyword() !== '') {
            $baseQuery->where(static function (ModelBuilder $builder) use ($query): void {
                $like = '%' . $query->getKeyword() . '%';
                $builder->where('group_name', 'like', $like)
                    ->orWhere('source_model_id', 'like', $like)
                    ->orWhere('target_model_id', 'like', $like);
            });
        }
        if ($query->getStatus() !== null) {
            $baseQuery->where('status', $query->getStatus()->value);
        }

        $total = $page->isTotal()
            ? (clone $baseQuery)->select('group_id')->distinct()->count('group_id')
            : -1;
        $groupIdQuery = (clone $baseQuery)
            ->select('group_id')
            ->groupBy('group_id')
            ->orderByRaw('MAX(id) DESC');
        if ($page->isEnabled()) {
            $groupIdQuery->forPage($page->getPage(), $page->getPageNum());
        }
        $groupIds = $groupIdQuery->pluck('group_id')->all();

        if ($groupIds === []) {
            return ['total' => (int) $total, 'list' => []];
        }

        $rows = $this->createBuilder($dataIsolation, ModelIdentifierMappingModel::query())
            ->whereIn('group_id', $groupIds)
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->get()
            ->all();
        $groups = [];
        foreach ($rows as $row) {
            $groupId = (string) $row->group_id;
            if (! isset($groups[$groupId])) {
                $groups[$groupId] = [
                    'group_id' => $groupId,
                    'group_name' => (string) $row->group_name,
                    'target_model_id' => (string) $row->target_model_id,
                    'status' => (int) $row->status,
                    'source_model_ids' => [],
                    'created_at' => $row->created_at?->format('Y-m-d H:i:s'),
                    'updated_at' => $row->updated_at?->format('Y-m-d H:i:s'),
                ];
            }
            $groups[$groupId]['source_model_ids'][] = (string) $row->source_model_id;
        }

        $orderedGroups = [];
        foreach ($groupIds as $groupId) {
            if (isset($groups[(string) $groupId])) {
                $orderedGroups[] = $groups[(string) $groupId];
            }
        }
        return ['total' => (int) $total, 'list' => $orderedGroups];
    }

    /**
     * 查询单个映射组的所有拆分记录。
     */
    public function getByGroupId(ProviderDataIsolation $dataIsolation, string $groupId): array
    {
        return $this->getByGroupIds($dataIsolation, [$groupId])[$groupId] ?? [];
    }

    /**
     * 批量获取多个映射组的拆分记录，并按映射组归集返回。
     */
    public function getByGroupIds(ProviderDataIsolation $dataIsolation, array $groupIds): array
    {
        $groupIds = array_values(array_unique(array_filter($groupIds)));
        if ($groupIds === []) {
            return [];
        }

        $rows = $this->createBuilder($dataIsolation, ModelIdentifierMappingModel::query())
            ->whereIn('group_id', $groupIds)
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->get()
            ->all();
        $groups = [];
        foreach ($rows as $row) {
            $groupId = (string) $row->group_id;
            $groups[$groupId] ??= [];
            $groups[$groupId][] = $row;
        }

        foreach ($groups as $groupId => $groupRows) {
            $groups[$groupId] = $this->toEntities($groupRows);
        }
        return $groups;
    }

    /**
     * 查询已经被其他映射组占用的源模型标识，并排除当前编辑组的数据行。
     */
    public function findConflictingSourceModelIds(ProviderDataIsolation $dataIsolation, array $sourceModelIds, ?string $excludeGroupId = null, array $excludeIds = []): array
    {
        if ($sourceModelIds === []) {
            return [];
        }
        $query = $this->createBuilder($dataIsolation, ModelIdentifierMappingModel::query())
            ->whereIn('source_model_id', array_values(array_unique($sourceModelIds)))
            ->whereNull('deleted_at');
        if ($excludeGroupId !== null) {
            $query->where('group_id', '<>', $excludeGroupId);
        }
        $excludeIds = array_values(array_filter(array_map('intval', $excludeIds), static fn (int $id): bool => $id > 0));
        if ($excludeIds !== []) {
            $query->whereNotIn('id', $excludeIds);
        }
        return array_values(array_unique(array_map(
            static fn ($row): string => (string) $row->source_model_id,
            $query->get(['source_model_id'])->all()
        )));
    }

    /**
     * 查询指定源模型当前启用的目标模型标识。
     */
    public function findActiveTargetModelId(ProviderDataIsolation $dataIsolation, string $sourceModelId): ?string
    {
        $targetModelId = $this->createBuilder($dataIsolation, ModelIdentifierMappingModel::query())
            ->where('source_model_id', $sourceModelId)
            ->where('status', Status::Enabled->value)
            ->whereNull('deleted_at')
            ->value('target_model_id');
        return $targetModelId === null ? null : (string) $targetModelId;
    }

    /**
     * 事务保存一个映射组，并将每个源标识拆成独立记录。
     */
    public function saveGroup(ProviderDataIsolation $dataIsolation, string $groupId, string $groupName, string $targetModelId, array $sourceModelIds): array
    {
        return Db::transaction(function () use ($dataIsolation, $groupId, $groupName, $targetModelId, $sourceModelIds): array {
            $now = date('Y-m-d H:i:s');
            $existingStatus = $this->createBuilder($dataIsolation, ModelIdentifierMappingModel::query())
                ->where('group_id', $groupId)
                ->whereNull('deleted_at')
                ->value('status');
            $groupStatus = $existingStatus === null ? Status::Enabled->value : (int) $existingStatus;
            // 锁定已有源标识，确保并发保存至少一方得到冲突结果。
            $this->createBuilder($dataIsolation, ModelIdentifierMappingModel::query())
                ->whereIn('source_model_id', $sourceModelIds)
                ->whereNull('deleted_at')
                ->lockForUpdate()
                ->get(['id']);

            $this->createBuilder($dataIsolation, ModelIdentifierMappingModel::query())
                ->where('group_id', $groupId)
                ->whereNull('deleted_at')
                ->update(['deleted_at' => $now, 'updated_at' => $now]);

            $rows = [];
            foreach ($sourceModelIds as $sourceModelId) {
                $rows[] = [
                    'id' => IdGenerator::getSnowId(),
                    'group_id' => $groupId,
                    'group_name' => $groupName,
                    'source_model_id' => $sourceModelId,
                    'target_model_id' => $targetModelId,
                    'status' => $groupStatus,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            $this->createBuilder($dataIsolation, ModelIdentifierMappingModel::query())->insert($rows);
            return $this->getByGroupId($dataIsolation, $groupId);
        });
    }

    /**
     * 更新单个映射组状态。
     */
    public function updateGroupStatus(ProviderDataIsolation $dataIsolation, string $groupId, int $status): void
    {
        $this->updateGroupsStatus($dataIsolation, [$groupId], $status);
    }

    /**
     * 批量更新映射组状态。
     */
    public function updateGroupsStatus(ProviderDataIsolation $dataIsolation, array $groupIds, int $status): void
    {
        if ($groupIds === []) {
            return;
        }
        $this->createBuilder($dataIsolation, ModelIdentifierMappingModel::query())
            ->whereIn('group_id', array_values(array_unique($groupIds)))
            ->whereNull('deleted_at')
            ->update(['status' => $status, 'updated_at' => date('Y-m-d H:i:s')]);
    }

    /**
     * 删除单个映射组的有效记录。
     */
    public function deleteGroup(ProviderDataIsolation $dataIsolation, string $groupId): void
    {
        $this->deleteGroups($dataIsolation, [$groupId]);
    }

    /**
     * 批量软删除映射组的有效记录。
     */
    public function deleteGroups(ProviderDataIsolation $dataIsolation, array $groupIds): void
    {
        if ($groupIds === []) {
            return;
        }
        $now = date('Y-m-d H:i:s');
        $this->createBuilder($dataIsolation, ModelIdentifierMappingModel::query())
            ->whereIn('group_id', array_values(array_unique($groupIds)))
            ->whereNull('deleted_at')
            ->update(['deleted_at' => $now, 'updated_at' => $now]);
    }

    /**
     * 将持久化记录转换为领域实体。
     *
     * @param array<int, array<string, mixed>|object> $rows
     * @return ModelIdentifierMappingEntity[]
     */
    private function toEntities(array $rows): array
    {
        return array_map(static function ($row): ModelIdentifierMappingEntity {
            $data = is_array($row)
                ? $row
                : (method_exists($row, 'getAttributes') ? $row->getAttributes() : get_object_vars($row));
            return (new ModelIdentifierMappingEntity())
                ->setId($data['id'] ?? null)
                ->setGroupId((string) ($data['group_id'] ?? ''))
                ->setGroupName((string) ($data['group_name'] ?? ''))
                ->setSourceModelId((string) ($data['source_model_id'] ?? ''))
                ->setTargetModelId((string) ($data['target_model_id'] ?? ''))
                ->setStatus((int) ($data['status'] ?? Status::Enabled->value))
                ->setCreatedAt($data['created_at'] ?? null)
                ->setUpdatedAt($data['updated_at'] ?? null)
                ->setDeletedAt($data['deleted_at'] ?? null);
        }, $rows);
    }
}
