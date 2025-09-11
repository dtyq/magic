<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Repository\LongTermMemory;

use App\Domain\LongTermMemory\DTO\MemoryQueryDTO;
use App\Domain\LongTermMemory\Entity\LongTermMemoryEntity;
use App\Domain\LongTermMemory\Entity\ValueObject\MemoryCategory;
use App\Domain\LongTermMemory\Entity\ValueObject\MemoryStatus;
use App\Domain\LongTermMemory\Entity\ValueObject\MemoryType;
use App\Domain\LongTermMemory\Repository\LongTermMemoryRepositoryInterface;
use App\Infrastructure\Repository\LongTermMemory\Model\LongTermMemoryModel;
use Exception;
use Hyperf\Codec\Json;
use Hyperf\Database\Model\Builder;
use Hyperf\DbConnection\Db;
use Ramsey\Uuid\Uuid;

/**
 * 基于 MySQL 的长期记忆仓储实现.
 */
class MySQLLongTermMemoryRepository implements LongTermMemoryRepositoryInterface
{
    public function __construct(protected LongTermMemoryModel $model)
    {
    }

    /**
     * 根据ID查找记忆.
     */
    public function findById(string $id): ?LongTermMemoryEntity
    {
        $model = $this->query()
            ->where('id', $id)
            ->whereNull('deleted_at')
            ->first();

        return $model ? $this->entityFromArray($model->toArray()) : null;
    }

    /**
     * 根据ID列表批量查找记忆.
     */
    public function findByIds(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        $data = $this->query()
            ->whereIn('id', $ids)
            ->whereNull('deleted_at')
            ->get();

        return $this->entitiesFromArray($data->toArray());
    }

    /**
     * 通用查询方法 (使用 DTO).
     */
    public function findMemories(MemoryQueryDTO $dto): array
    {
        $query = $this->query()
            ->where('org_id', $dto->orgId)
            ->where('app_id', $dto->appId)
            ->where('user_id', $dto->userId)
            ->whereNull('deleted_at');

        // 状态筛选
        if ($dto->status !== null && ! empty($dto->status)) {
            if (is_array($dto->status)) {
                $query->whereIn('status', $dto->status);
            } else {
                $query->where('status', $dto->status);
            }
        }

        // 类型筛选
        if ($dto->type !== null) {
            $query->where('memory_type', $dto->type->value);
        }

        // 项目ID筛选
        if ($dto->projectId !== null) {
            $query->where('project_id', $dto->projectId);
        }

        // 启用状态筛选
        if ($dto->enabled !== null) {
            $query->where('enabled', $dto->enabled ? 1 : 0);
        }

        // 标签筛选
        if (! empty($dto->tags)) {
            foreach ($dto->tags as $tag) {
                $query->whereRaw('JSON_CONTAINS(tags, ?)', [Json::encode($tag)]);
            }
        }

        // 关键词搜索
        if ($dto->keyword !== null) {
            $query->where(function (Builder $subQuery) use ($dto) {
                $subQuery->where('content', 'like', "%{$dto->keyword}%")
                    ->orWhere('explanation', 'like', "%{$dto->keyword}%");
            });
        }

        // 简单分页：使用 offset
        if ($dto->offset > 0) {
            $query->offset($dto->offset);
        }

        // 排序
        $query->orderBy($dto->orderBy, $dto->orderDirection);
        // 添加 ID 作为次要排序字段，确保结果一致性
        if ($dto->orderBy !== 'id') {
            $query->orderBy('id', $dto->orderDirection);
        }

        // 限制条数
        if ($dto->limit > 0) {
            $query->limit($dto->limit);
        }

        $data = $query->get();

        return $this->entitiesFromArray($data->toArray());
    }

    /**
     * 根据查询条件统计记忆数量.
     */
    public function countMemories(MemoryQueryDTO $dto): int
    {
        $query = $this->query()
            ->where('org_id', $dto->orgId)
            ->where('app_id', $dto->appId)
            ->where('user_id', $dto->userId)
            ->whereNull('deleted_at');

        // 状态筛选
        if ($dto->status !== null && ! empty($dto->status)) {
            if (is_array($dto->status)) {
                $query->whereIn('status', $dto->status);
            } else {
                $query->where('status', $dto->status);
            }
        }

        // 类型筛选
        if ($dto->type !== null) {
            $query->where('memory_type', $dto->type->value);
        }

        // 项目ID筛选
        if ($dto->projectId !== null) {
            $query->where('project_id', $dto->projectId);
        }

        // 启用状态筛选
        if ($dto->enabled !== null) {
            $query->where('enabled', $dto->enabled ? 1 : 0);
        }

        // 标签筛选
        if (! empty($dto->tags)) {
            foreach ($dto->tags as $tag) {
                $query->whereRaw('JSON_CONTAINS(tags, ?)', [Json::encode($tag)]);
            }
        }

        // 关键词搜索
        if ($dto->keyword !== null) {
            $query->where(function (Builder $subQuery) use ($dto) {
                $subQuery->where('content', 'like', "%{$dto->keyword}%")
                    ->orWhere('explanation', 'like', "%{$dto->keyword}%");
            });
        }

        return $query->count();
    }

    /**
     * 根据组织、应用、用户查找所有记忆.
     */
    public function findByUser(string $orgId, string $appId, string $userId, ?string $status = null): array
    {
        $query = $this->query()
            ->where('org_id', $orgId)
            ->where('app_id', $appId)
            ->where('user_id', $userId)
            ->whereNull('deleted_at');

        if ($status !== null) {
            $query->where('status', $status);
        }

        $data = $query->orderBy('created_at', 'desc')->get();

        return $this->entitiesFromArray($data->toArray());
    }

    /**
     * 根据组织、应用、用户查找有效记忆（按分数排序）.
     */
    public function findEffectiveMemoriesByUser(string $orgId, string $appId, string $userId, string $projectId, int $limit = 50): array
    {
        $query = $this->query()
            ->where('org_id', $orgId)
            ->where('app_id', $appId)
            ->where('user_id', $userId)
            ->whereIn('status', [MemoryStatus::ACTIVE->value, MemoryStatus::PENDING_REVISION->value])
            ->where('enabled', 1) // 只获取启用的记忆
            ->whereNull('deleted_at')
            ->where(function (Builder $query) {
                $query->whereNull('expires_at')
                    ->orWhere('expires_at', '>', date('Y-m-d H:i:s'));
            });

        // 根据 projectId 过滤记忆
        if (empty($projectId)) {
            // 获取没有项目ID的记忆（全局记忆）
            $query->whereNull('project_id');
        } else {
            // 获取指定项目ID的记忆
            $query->where('project_id', $projectId);
        }

        $data = $query->get();

        // Convert to entities
        $entities = $this->entitiesFromArray($data->toArray());

        // Sort by effective score in PHP (descending order)
        usort($entities, function ($a, $b) {
            return $b->getEffectiveScore() <=> $a->getEffectiveScore();
        });

        // Apply limit after sorting
        return array_slice($entities, 0, $limit);
    }

    /**
     * 根据标签查找记忆.
     */
    public function findByTags(string $orgId, string $appId, string $userId, array $tags, ?string $status = null): array
    {
        $query = $this->query()
            ->where('org_id', $orgId)
            ->where('app_id', $appId)
            ->where('user_id', $userId)
            ->whereNull('deleted_at');

        foreach ($tags as $tag) {
            $query->whereRaw('JSON_CONTAINS(tags, ?)', [Json::encode($tag)]);
        }

        if ($status !== null) {
            $query->where('status', $status);
        }

        $data = $query->orderBy('created_at', 'desc')->get();

        return $this->entitiesFromArray($data->toArray());
    }

    /**
     * 根据记忆类型查找记忆.
     */
    public function findByType(string $orgId, string $appId, string $userId, MemoryType $type, ?string $status = null): array
    {
        $query = $this->query()
            ->where('org_id', $orgId)
            ->where('app_id', $appId)
            ->where('user_id', $userId)
            ->where('memory_type', $type->value)
            ->whereNull('deleted_at');

        if ($status !== null) {
            $query->where('status', $status);
        }

        $data = $query->orderBy('created_at', 'desc')->get();

        return $this->entitiesFromArray($data->toArray());
    }

    /**
     * 根据内容关键词搜索记忆.
     */
    public function searchByContent(string $orgId, string $appId, string $userId, string $keyword, ?string $status = null): array
    {
        $query = $this->query()
            ->where('org_id', $orgId)
            ->where('app_id', $appId)
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->where(function (Builder $query) use ($keyword) {
                $query->where('content', 'like', "%{$keyword}%");
            });

        if ($status !== null) {
            $query->where('status', $status);
        }

        $data = $query->orderBy('created_at', 'desc')->get();

        return $this->entitiesFromArray($data->toArray());
    }

    /**
     * 查找需要淘汰的记忆.
     */
    public function findMemoriesToEvict(string $orgId, string $appId, string $userId): array
    {
        $data = $this->query()
            ->where('org_id', $orgId)
            ->where('app_id', $appId)
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->where(function (Builder $query) {
                $query->where('expires_at', '<', date('Y-m-d H:i:s'))
                    ->orWhere(function (Builder $subQuery) {
                        $subQuery->where('importance', '<', 0.2)
                            ->where('last_accessed_at', '<', date('Y-m-d H:i:s', strtotime('-30 days')));
                    })
                    ->orWhereRaw('(importance * confidence * decay_factor) < 0.1');
            })
            ->get();

        return $this->entitiesFromArray($data->toArray());
    }

    /**
     * 查找需要压缩的记忆.
     */
    public function findMemoriesToCompress(string $orgId, string $appId, string $userId): array
    {
        $data = $this->query()
            ->where('org_id', $orgId)
            ->where('app_id', $appId)
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->where(function (Builder $query) {
                $query->where(function (Builder $subQuery) {
                    $subQuery->whereRaw('CHAR_LENGTH(content) > 1000')
                        ->where('importance', '<', 0.6);
                })
                    ->orWhere(function (Builder $subQuery) {
                        $subQuery->where('last_accessed_at', '<', date('Y-m-d H:i:s', strtotime('-7 days')))
                            ->whereRaw('(importance * confidence * decay_factor) >= 0.1');
                    });
            })
            ->get();

        return $this->entitiesFromArray($data->toArray());
    }

    /**
     * 保存记忆.
     */
    public function save(LongTermMemoryEntity $memory): bool
    {
        $data = $this->entityToArray($memory);

        // 生成ID
        if (empty($data['id'])) {
            $data['id'] = Uuid::uuid4()->toString();
            $memory->setId($data['id']);
        }

        return $this->query()->insert($data);
    }

    /**
     * 批量保存记忆.
     */
    public function saveBatch(array $memories): bool
    {
        $data = [];
        foreach ($memories as $memory) {
            $memoryData = $this->entityToArray($memory);

            // 生成ID
            if (empty($memoryData['id'])) {
                $memoryData['id'] = Uuid::uuid4()->toString();
                $memory->setId($memoryData['id']);
            }

            $data[] = $memoryData;
        }

        return $this->query()->insert($data);
    }

    /**
     * 更新记忆.
     */
    public function update(LongTermMemoryEntity $memory): bool
    {
        $data = $this->entityToArray($memory);
        unset($data['id']); // 不更新ID

        return $this->query()
            ->where('id', $memory->getId())
            ->update($data) > 0;
    }

    /**
     * 批量更新记忆.
     * @param array<LongTermMemoryEntity> $memories 记忆实体列表
     */
    public function updateBatch(array $memories): bool
    {
        if (empty($memories)) {
            return true;
        }

        return Db::transaction(function () use ($memories) {
            $table = $this->model->getTable();

            // 转换实体为数组数据
            $dataArray = [];
            foreach ($memories as $memory) {
                $dataArray[] = $this->entityToArray($memory);
            }

            // 从第一个数据项自动获取字段列表
            $fields = array_keys($dataArray[0]);

            // 构建 VALUES 部分
            $valueRows = [];
            $bindings = [];

            foreach ($dataArray as $data) {
                $placeholders = [];
                foreach ($fields as $field) {
                    $placeholders[] = '?';
                    $bindings[] = $data[$field] ?? null;
                }
                $valueRows[] = '(' . implode(', ', $placeholders) . ')';
            }

            // 构建 REPLACE INTO SQL
            $fieldsStr = implode(', ', $fields);
            $valuesStr = implode(', ', $valueRows);
            $sql = "REPLACE INTO {$table} ({$fieldsStr}) VALUES {$valuesStr}";

            $result = Db::statement($sql, $bindings);

            if (! $result) {
                throw new Exception('Failed to batch replace memories');
            }

            return true;
        });
    }

    /**
     * 删除记忆.
     */
    public function delete(string $id): bool
    {
        return $this->query()
            ->where('id', $id)
            ->delete() > 0;
    }

    /**
     * 批量删除记忆.
     */
    public function deleteBatch(array $ids): bool
    {
        return $this->query()
            ->whereIn('id', $ids)
            ->delete() > 0;
    }

    /**
     * 根据项目ID删除记忆.
     */
    public function deleteByProjectId(string $orgId, string $appId, string $userId, string $projectId): int
    {
        return $this->query()
            ->where('org_id', $orgId)
            ->where('app_id', $appId)
            ->where('user_id', $userId)
            ->where('project_id', $projectId)
            ->delete();
    }

    /**
     * 根据项目ID列表批量删除记忆.
     */
    public function deleteByProjectIds(string $orgId, string $appId, string $userId, array $projectIds): int
    {
        if (empty($projectIds)) {
            return 0;
        }

        return $this->query()
            ->where('org_id', $orgId)
            ->where('app_id', $appId)
            ->where('user_id', $userId)
            ->whereIn('project_id', $projectIds)
            ->delete();
    }

    /**
     * 软删除记忆.
     */
    public function softDelete(string $id): bool
    {
        return $this->query()
            ->where('id', $id)
            ->update(['deleted_at' => date('Y-m-d H:i:s')]) > 0;
    }

    /**
     * 统计用户的记忆数量.
     */
    public function countByUser(string $orgId, string $appId, string $userId): int
    {
        return $this->query()
            ->where('org_id', $orgId)
            ->where('app_id', $appId)
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->count();
    }

    /**
     * 统计用户各类型记忆的数量.
     */
    public function countByUserAndType(string $orgId, string $appId, string $userId): array
    {
        $data = $this->query()
            ->where('org_id', $orgId)
            ->where('app_id', $appId)
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->selectRaw('memory_type, COUNT(*) as count')
            ->groupBy('memory_type')
            ->get();

        $result = [];
        foreach ($data as $row) {
            $result[$row['memory_type']] = $row['count'];
        }

        return $result;
    }

    /**
     * 获取用户记忆的总大小（字符数）.
     */
    public function getTotalSizeByUser(string $orgId, string $appId, string $userId): int
    {
        $result = $this->query()
            ->where('org_id', $orgId)
            ->where('app_id', $appId)
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->selectRaw('SUM(CHAR_LENGTH(content)) as total_size')
            ->first();
        if (! $result) {
            return 0;
        }
        return $result['total_size'] ?? 0;
    }

    /**
     * 批量检查记忆是否属于用户.
     */
    public function filterMemoriesByUser(array $memoryIds, string $orgId, string $appId, string $userId): array
    {
        if (empty($memoryIds)) {
            return [];
        }

        return $this->query()
            ->whereIn('id', $memoryIds)
            ->where('org_id', $orgId)
            ->where('app_id', $appId)
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->pluck('id')
            ->toArray();
    }

    /**
     * 批量更新记忆的启用状态.
     */
    public function batchUpdateEnabled(array $memoryIds, bool $enabled, string $orgId, string $appId, string $userId): int
    {
        if (empty($memoryIds)) {
            return 0;
        }

        // 只能更新 active 状态的记忆
        return LongTermMemoryModel::query()
            ->whereIn('id', $memoryIds)
            ->where('org_id', $orgId)
            ->where('app_id', $appId)
            ->where('user_id', $userId)
            ->where('status', 'active') // 只有已生效的记忆可以启用/禁用
            ->whereNull('deleted_at')
            ->update([
                'enabled' => $enabled ? 1 : 0,
            ]);
    }

    /**
     * 获取指定分类的已启用记忆数量.
     * @param string $orgId 组织ID
     * @param string $appId 应用ID
     * @param string $userId 用户ID
     * @param MemoryCategory $category 记忆分类
     * @return int 记忆数量
     */
    public function getEnabledMemoryCountByCategory(string $orgId, string $appId, string $userId, MemoryCategory $category): int
    {
        $query = $this->query()
            ->where('org_id', $orgId)
            ->where('app_id', $appId)
            ->where('user_id', $userId)
            ->where('enabled', 1)
            ->where('status', MemoryStatus::ACTIVE->value)
            ->whereNull('deleted_at');

        if ($category === MemoryCategory::PROJECT) {
            // 项目记忆：project_id 不为空且不为空字符串
            $query->whereNotNull('project_id')
                ->where('project_id', '!=', '');
        } else {
            // 全局记忆：project_id 为空或为空字符串
            $query->where(function ($subQuery) {
                $subQuery->whereNull('project_id')
                    ->orWhere('project_id', '');
            });
        }

        return $query->count();
    }

    /**
     * 获取查询构建器.
     */
    private function query(): Builder
    {
        return $this->model::query();
    }

    /**
     * 将实体转换为数组以进行存储.
     */
    private function entityToArray(LongTermMemoryEntity $memory): array
    {
        return [
            'id' => $memory->getId(),
            'content' => $memory->getContent(),
            'pending_content' => $memory->getPendingContent(),
            'explanation' => $memory->getExplanation(),
            'origin_text' => $memory->getOriginText(),
            'memory_type' => $memory->getMemoryType()->value,
            'status' => $memory->getStatus()->value,
            'enabled' => $memory->isEnabled() ? 1 : 0, // 将布尔值转换为数据库可接受的值
            'confidence' => $memory->getConfidence(),
            'importance' => $memory->getImportance(),
            'access_count' => $memory->getAccessCount(),
            'reinforcement_count' => $memory->getReinforcementCount(),
            'decay_factor' => $memory->getDecayFactor(),
            'tags' => Json::encode($memory->getTags()),
            'metadata' => Json::encode($memory->getMetadata()),
            'org_id' => $memory->getOrgId(),
            'app_id' => $memory->getAppId(),
            'project_id' => $memory->getProjectId(),
            'user_id' => $memory->getUserId(),
            'last_accessed_at' => $memory->getLastAccessedAt()?->format('Y-m-d H:i:s'),
            'last_reinforced_at' => $memory->getLastReinforcedAt()?->format('Y-m-d H:i:s'),
            'expires_at' => $memory->getExpiresAt()?->format('Y-m-d H:i:s'),
            'created_at' => $memory->getCreatedAt()?->format('Y-m-d H:i:s') ?? date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
            'deleted_at' => $memory->getDeletedAt()?->format('Y-m-d H:i:s'),
        ];
    }

    /**
     * 将数组转换为实体.
     */
    private function entityFromArray(array $data): LongTermMemoryEntity
    {
        return new LongTermMemoryEntity($data);
    }

    /**
     * 将数组集合转换为实体集合.
     * @return LongTermMemoryEntity[]
     */
    private function entitiesFromArray(array $dataArray): array
    {
        return array_map(function ($data) {
            return $this->entityFromArray((array) $data);
        }, $dataArray);
    }
}
