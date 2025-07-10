<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Repository\Facade;

use Dtyq\SuperMagic\Domain\Share\Entity\ResourceShareEntity;

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
     * @return bool 是否成功
     */
    public function delete(int $shareId): bool;

    /**
     * 增加分享查看次数.
     *
     * @param string $shareCode 分享码
     * @return bool 是否成功
     */
    public function incrementViewCount(string $shareCode): bool;

    /**
     * 分页查询.
     *
     * @param array $conditions 查询条件
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @return array 分页结果
     */
    public function paginate(array $conditions, int $page = 1, int $pageSize = 20): array;

    public function getShareByResource(string $userId, string $resourceId, int $resourceType): ?ResourceShareEntity;

    /**
     * 检查分享码是否已存在.
     *
     * @param string $shareCode 分享码
     * @return bool 是否已存在
     */
    public function isShareCodeExists(string $shareCode): bool;
}
