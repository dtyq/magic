<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\LongTermMemory\Repository;

use App\Domain\LongTermMemory\DTO\MemoryQueryDTO;
use App\Domain\LongTermMemory\Entity\LongTermMemoryEntity;
use App\Domain\LongTermMemory\Entity\ValueObject\MemoryCategory;
use App\Domain\LongTermMemory\Entity\ValueObject\MemoryType;

/**
 * 长期记忆仓储接口.
 */
interface LongTermMemoryRepositoryInterface
{
    /**
     * 根据ID查找记忆.
     */
    public function findById(string $id): ?LongTermMemoryEntity;

    /**
     * 根据ID列表批量查找记忆.
     * @param array $ids ID列表
     * @return array<LongTermMemoryEntity> 记忆实体列表
     */
    public function findByIds(array $ids): array;

    /**
     * 通用查询方法 (使用 DTO).
     * @return LongTermMemoryEntity[]
     */
    public function findMemories(MemoryQueryDTO $dto): array;

    /**
     * 根据查询条件统计记忆数量.
     */
    public function countMemories(MemoryQueryDTO $dto): int;

    /**
     * 根据组织、应用、用户查找所有记忆.
     */
    public function findByUser(string $orgId, string $appId, string $userId, ?string $status = null): array;

    /**
     * 根据组织、应用、用户查找有效记忆（按分数排序）.
     */
    public function findEffectiveMemoriesByUser(string $orgId, string $appId, string $userId, string $projectId, int $limit = 50): array;

    /**
     * 根据标签查找记忆.
     */
    public function findByTags(string $orgId, string $appId, string $userId, array $tags, ?string $status = null): array;

    /**
     * 根据记忆类型查找记忆.
     */
    public function findByType(string $orgId, string $appId, string $userId, MemoryType $type, ?string $status = null): array;

    /**
     * 根据内容关键词搜索记忆.
     */
    public function searchByContent(string $orgId, string $appId, string $userId, string $keyword, ?string $status = null): array;

    /**
     * 查找需要淘汰的记忆.
     */
    public function findMemoriesToEvict(string $orgId, string $appId, string $userId): array;

    /**
     * 查找需要压缩的记忆.
     */
    public function findMemoriesToCompress(string $orgId, string $appId, string $userId): array;

    /**
     * 保存记忆.
     */
    public function save(LongTermMemoryEntity $memory): bool;

    /**
     * 批量保存记忆.
     */
    public function saveBatch(array $memories): bool;

    /**
     * 更新记忆.
     */
    public function update(LongTermMemoryEntity $memory): bool;

    /**
     * 批量更新记忆.
     * @param array<LongTermMemoryEntity> $memories 记忆实体列表
     * @return bool 是否更新成功
     */
    public function updateBatch(array $memories): bool;

    /**
     * 删除记忆.
     */
    public function delete(string $id): bool;

    /**
     * 批量删除记忆.
     */
    public function deleteBatch(array $ids): bool;

    /**
     * 软删除记忆.
     */
    public function softDelete(string $id): bool;

    /**
     * 统计用户的记忆数量.
     */
    public function countByUser(string $orgId, string $appId, string $userId): int;

    /**
     * 统计用户各类型记忆的数量.
     */
    public function countByUserAndType(string $orgId, string $appId, string $userId): array;

    /**
     * 获取用户记忆的总大小（字符数）.
     */
    public function getTotalSizeByUser(string $orgId, string $appId, string $userId): int;

    /**
     * 批量检查记忆是否属于用户.
     * @param array $memoryIds 记忆ID列表
     * @param string $orgId 组织ID
     * @param string $appId 应用ID
     * @param string $userId 用户ID
     * @return array 返回属于用户的记忆ID列表
     */
    public function filterMemoriesByUser(array $memoryIds, string $orgId, string $appId, string $userId): array;

    /**
     * 批量更新记忆的启用状态.
     * @param array $memoryIds 记忆ID列表
     * @param bool $enabled 启用状态
     * @param string $orgId 组织ID
     * @param string $appId 应用ID
     * @param string $userId 用户ID
     * @return int 更新的记录数量
     */
    public function batchUpdateEnabled(array $memoryIds, bool $enabled, string $orgId, string $appId, string $userId): int;

    /**
     * 获取指定分类的已启用记忆数量.
     * @param string $orgId 组织ID
     * @param string $appId 应用ID
     * @param string $userId 用户ID
     * @param MemoryCategory $category 记忆分类
     * @return int 记忆数量
     */
    public function getEnabledMemoryCountByCategory(string $orgId, string $appId, string $userId, MemoryCategory $category): int;

    /**
     * 根据项目ID删除记忆.
     * @param string $orgId 组织ID
     * @param string $appId 应用ID
     * @param string $userId 用户ID
     * @param string $projectId 项目ID
     * @return int 删除的记录数量
     */
    public function deleteByProjectId(string $orgId, string $appId, string $userId, string $projectId): int;

    /**
     * 根据项目ID列表批量删除记忆.
     * @param string $orgId 组织ID
     * @param string $appId 应用ID
     * @param string $userId 用户ID
     * @param array $projectIds 项目ID列表
     * @return int 删除的记录数量
     */
    public function deleteByProjectIds(string $orgId, string $appId, string $userId, array $projectIds): int;
}
