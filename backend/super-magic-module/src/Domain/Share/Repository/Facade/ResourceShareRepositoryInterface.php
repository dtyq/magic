<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Repository\Facade;

use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareEntity;
use Dtyq\SuperMagic\Domain\Share\Repository\ValueObject\ResourceShareQueryVO;

/**
 * 资源分享仓储接口.
 */
interface ResourceShareRepositoryInterface
{
    /**
     * 通过ID获取分享.
     *
     * @param int $shareId 分享ID
     * @return null|ResourceShareEntity 资源分享实体
     */
    public function getShareById(int $shareId): ?ResourceShareEntity;

    /**
     * 通过分享码获取分享.
     *
     * @param string $shareCode 分享码
     * @return null|ResourceShareEntity 资源分享实体
     */
    public function getShareByCode(string $shareCode): ?ResourceShareEntity;

    public function getShareByResourceId(string $resourceId): ?ResourceShareEntity;

    /**
     * 通过资源ID获取分享（包括已删除的记录）.
     *
     * @param string $resourceId 资源ID
     * @return null|ResourceShareEntity 资源分享实体
     */
    public function getShareByResourceIdWithTrashed(string $resourceId): ?ResourceShareEntity;

    /**
     * 保存分享实体.
     *
     * @param ResourceShareEntity $shareEntity 资源分享实体
     * @return ResourceShareEntity 保存后的资源分享实体
     */
    public function save(ResourceShareEntity $shareEntity): ResourceShareEntity;

    /**
     * 删除分享.
     *
     * @param int $shareId 分享ID
     * @param bool $forceDelete 是否强制删除（物理删除），默认false为软删除
     * @return bool 是否成功
     */
    public function delete(int $shareId, bool $forceDelete = false): bool;

    /**
     * 增加分享查看次数.
     *
     * @param string $shareCode 分享码
     * @return bool 是否成功
     */
    public function incrementViewCount(string $shareCode): bool;

    /**
     * 通过分享ID增加分享查看次数（原子操作，解决并发问题）.
     *
     * @param int $shareId 分享ID
     * @return bool 是否成功
     */
    public function incrementViewCountByShareId(int $shareId): bool;

    /**
     * 分页查询.
     *
     * @param ResourceShareQueryVO $queryVO 查询条件值对象
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @return array 分页结果
     */
    public function paginate(ResourceShareQueryVO $queryVO, int $page = 1, int $pageSize = 20): array;

    public function getShareByResource(string $userId, string $resourceId, int $resourceType, bool $withTrashed = true): ?ResourceShareEntity;

    /**
     * 检查分享码是否已存在.
     *
     * @param string $shareCode 分享码
     * @return bool 是否已存在
     */
    public function isShareCodeExists(string $shareCode): bool;

    /**
     * 批量获取分享详情.
     *
     * @param array $resourceIds 资源ID数组
     * @return array ResourceShareEntity[] 分享实体数组
     */
    public function getSharesByResourceIds(array $resourceIds): array;

    /**
     * 根据项目ID查找项目分享.
     *
     * @param string $projectId 项目ID
     * @return array ResourceShareEntity[] 分享实体数组
     */
    public function getSharesByProjectId(string $projectId): array;

    /**
     * 批量保存分享实体.
     *
     * @param array $shareEntities ResourceShareEntity[] 分享实体数组
     * @return bool 是否保存成功
     */
    public function batchSave(array $shareEntities): bool;

    /**
     * 获取用户分享的项目ID列表（去重）.
     *
     * @param string $userId 用户ID
     * @param array $resourceTypes 资源类型数组
     * @return array 项目ID数组
     */
    public function getSharedProjectIdsByUser(string $userId, array $resourceTypes): array;
}
