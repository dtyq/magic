<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\RecycleBin\Repository\Facade;

use Dtyq\SuperMagic\Domain\RecycleBin\Entity\RecycleBinEntity;
use Dtyq\SuperMagic\Domain\RecycleBin\Enum\RecycleBinResourceType;

/**
 * 回收站仓储接口.
 */
interface RecycleBinRepositoryInterface
{
    /**
     * 插入回收站记录.
     */
    public function insert(RecycleBinEntity $entity): RecycleBinEntity;

    /**
     * 根据ID查询.
     */
    public function findById(int $id): ?RecycleBinEntity;

    /**
     * 根据ID删除(物理删除).
     */
    public function deleteById(int $id): bool;

    /**
     * 根据资源类型和ID查找回收站记录.
     */
    public function findByResource(
        RecycleBinResourceType $resourceType,
        int $resourceId
    ): ?RecycleBinEntity;

    /**
     * 查询某个父级下在回收站有记录的资源ID列表.
     * 用于恢复项目/工作区时排除用户曾删的子资源.
     *
     * @param int $parentId 父级资源ID
     * @param RecycleBinResourceType $resourceType 子资源类型
     * @return array 资源ID数组
     */
    public function findResourceIdsByParent(
        int $parentId,
        RecycleBinResourceType $resourceType
    ): array;

    /**
     * 批量查询多个父级下在回收站有记录的资源ID列表.
     * 用于恢复工作区时排除用户曾删的话题（需要查询多个项目下的话题）.
     *
     * @param array $parentIds 父级资源ID数组
     * @param RecycleBinResourceType $resourceType 子资源类型
     * @return array 资源ID数组
     */
    public function findResourceIdsByParents(
        array $parentIds,
        RecycleBinResourceType $resourceType
    ): array;

    /**
     * 获取回收站列表(分页).
     *
     * @param string $userId 用户ID
     * @param null|int $resourceType 资源类型(可选)
     * @param null|string $keyword 关键词搜索(可选)
     * @param string $order 排序方向 asc|desc
     * @param int $page 页码
     * @param int $pageSize 每页大小
     * @return array ['total' => int, 'list' => RecycleBinEntity[]]
     */
    public function getRecycleBinList(
        string $userId,
        ?int $resourceType = null,
        ?string $keyword = null,
        string $order = 'desc',
        int $page = 1,
        int $pageSize = 20
    ): array;

    /**
     * 批量查询当前用户可访问的回收站记录（带类型过滤）.
     * 与列表使用同一套可访问条件，供检查父级/恢复等使用.
     *
     * @param array $ids 回收站记录ID数组
     * @param int $resourceType 资源类型（RecycleBinResourceType->value）
     * @param string $userId 当前用户ID
     * @return RecycleBinEntity[] 回收站实体数组
     */
    public function findByIdsAndTypeVisibleToUser(array $ids, int $resourceType, string $userId): array;

    /**
     * 批量查询回收站记录（不过滤类型）.
     *
     * @param array $ids 回收站记录ID数组
     * @param string $userId 用户ID（权限校验）
     * @return RecycleBinEntity[] 回收站实体数组
     */
    public function findByIds(array $ids, string $userId): array;

    /**
     * 批量删除回收站记录（物理删除）.
     *
     * @param array $ids 回收站记录ID数组
     * @return int 删除的记录数
     */
    public function deleteByIds(array $ids): int;

    /**
     * 根据资源ID批量查询回收站记录（用于恢复）.
     * 每个资源在回收站中只有一条记录（恢复时会物理删除回收站记录）.
     *
     * @param array $resourceIds 资源ID数组
     * @param RecycleBinResourceType $resourceType 资源类型
     * @param string $userId 用户ID（权限校验）
     * @return RecycleBinEntity[] 回收站实体数组
     */
    public function findLatestByResourceIds(array $resourceIds, RecycleBinResourceType $resourceType, string $userId): array;

    /**
     * 查找过期的回收站记录ID（系统定时任务使用）.
     * 不校验用户权限，因为是系统全局清理.
     *
     * @param int $limit 限制返回数量，避免一次处理过多（默认 1000）
     * @return string[] 过期的回收站记录ID数组（字符串类型，避免大整数精度问题）
     */
    public function findExpiredRecordIds(int $limit = 1000): array;

    /**
     * 按 ID 批量查询回收站记录（不校验用户权限）.
     * 仅用于系统行为（如定时任务清理过期记录），不可用于用户请求.
     *
     * @param array $ids 回收站记录ID数组
     * @return RecycleBinEntity[] 回收站实体数组
     */
    public function findByIdsWithoutPermission(array $ids): array;
}
