<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\FileCollection\Repository\Facade;

use Dtyq\SuperMagic\Domain\FileCollection\Entity\FileCollectionItemEntity;

/**
 * 文件集项仓储接口.
 */
interface FileCollectionItemRepositoryInterface
{
    /**
     * 通过文件集ID获取所有文件项.
     *
     * @param int $collectionId 文件集ID
     * @return FileCollectionItemEntity[] 文件集项实体数组
     */
    public function getByCollectionId(int $collectionId): array;

    /**
     * 批量插入文件集项.
     *
     * @param FileCollectionItemEntity[] $items 文件集项实体数组
     * @return bool 是否成功
     */
    public function batchInsert(array $items): bool;

    /**
     * 删除文件集的所有文件项.
     *
     * @param int $collectionId 文件集ID
     * @return bool 是否成功
     */
    public function deleteByCollectionId(int $collectionId): bool;

    /**
     * 批量统计文件集的文件数量.
     *
     * @param array $collectionIds 文件集ID数组
     * @return array 文件集ID => 文件数量的映射 [collection_id => count]
     */
    public function countByCollectionIds(array $collectionIds): array;

    /**
     * 批量通过文件集ID获取所有文件项.
     *
     * @param array $collectionIds 文件集ID数组
     * @return array 文件集ID => FileCollectionItemEntity[] 的映射 [collection_id => [item1, item2, ...]]
     */
    public function getByCollectionIds(array $collectionIds): array;

    /**
     * 查找包含指定文件的单文件文件集ID（文件集中只有这一个文件）.
     *
     * @param int $fileId 文件ID
     * @param string $userId 用户ID
     * @param string $organizationCode 组织代码
     * @return array 文件集ID数组
     */
    public function getSingleFileCollectionIdsByFileId(int $fileId, string $userId, string $organizationCode): array;

    /**
     * 查找与指定文件列表完全匹配的文件集ID.
     * 完全匹配定义：文件集中的文件数量和内容与传入的文件列表完全一致。
     *
     * @param array $fileIds 文件ID数组
     * @param string $userId 用户ID
     * @param string $organizationCode 组织代码
     * @param int $exactFileCount 精确的文件数量
     * @return array 文件集ID数组
     */
    public function getCollectionIdsByFileIds(array $fileIds, string $userId, string $organizationCode, int $exactFileCount): array;
}
