<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\FileCollection\Service;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\Domain\FileCollection\Entity\FileCollectionEntity;
use Dtyq\SuperMagic\Domain\FileCollection\Entity\FileCollectionItemEntity;
use Dtyq\SuperMagic\Domain\FileCollection\Repository\Facade\FileCollectionItemRepositoryInterface;
use Dtyq\SuperMagic\Domain\FileCollection\Repository\Facade\FileCollectionRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskFileRepositoryInterface;
use Dtyq\SuperMagic\ErrorCode\ShareErrorCode;

/**
 * 文件集领域服务.
 */
class FileCollectionDomainService
{
    public function __construct(
        private FileCollectionRepositoryInterface $fileCollectionRepository,
        private FileCollectionItemRepositoryInterface $fileCollectionItemRepository,
        private TaskFileRepositoryInterface $taskFileRepository
    ) {
    }

    /**
     * 创建文件集.
     *
     * @param string $userId 用户ID
     * @param string $organizationCode 组织代码
     * @param array $fileIds 文件ID数组
     * @param null|int $collectionId 可选的文件集ID，不提供则自动生成
     * @return FileCollectionEntity 创建后的文件集实体
     */
    public function createFileCollection(
        string $userId,
        string $organizationCode,
        array $fileIds,
        ?int $collectionId = null
    ): FileCollectionEntity {
        // 1. 获取或创建文件集实体
        $entity = null;
        $isExistingCollection = false;
        if ($collectionId !== null) {
            $entity = $this->fileCollectionRepository->getById($collectionId);
            $isExistingCollection = $entity !== null;

            // 🔒 安全检查：如果文件集已存在，验证所有权
            if ($isExistingCollection) {
                // 检查组织代码是否匹配（防止跨组织覆盖）
                if ($entity->getOrganizationCode() !== $organizationCode) {
                    ExceptionBuilder::throw(
                        ShareErrorCode::PERMISSION_DENIED,
                        'share.cannot_modify_other_organization_file_collection',
                        [$collectionId]
                    );
                }

                // 检查创建者是否匹配（防止用户覆盖他人的文件集）
                if ($entity->getCreatedUid() !== $userId) {
                    ExceptionBuilder::throw(
                        ShareErrorCode::PERMISSION_DENIED,
                        'share.cannot_modify_other_user_file_collection',
                        [$collectionId]
                    );
                }
            }
        }

        // 2. 如果文件集不存在，创建新的并保存
        if (! $isExistingCollection) {
            $entity = new FileCollectionEntity();
            if ($collectionId !== null) {
                $entity->setId($collectionId);
            }
            $entity->setCreatedUid($userId);
            $entity->setUpdatedUid($userId);
            $entity->setOrganizationCode($organizationCode);
            $entity = $this->fileCollectionRepository->save($entity);
        }

        // 3. 如果文件集已存在，先删除该集合的所有集合项（现在已经验证过所有权）
        if ($isExistingCollection) {
            $this->fileCollectionItemRepository->deleteByCollectionId($entity->getId());
        }

        // 4. 如果有文件ID，添加到文件集（无论文件集是否存在都需要执行）
        if (! empty($fileIds)) {
            $this->addFilesToCollection($entity->getId(), $fileIds);
        }

        return $entity;
    }

    /**
     * 向文件集添加文件.
     *
     * @param int $collectionId 文件集ID
     * @param array $fileIds 文件ID数组
     * @return bool 是否成功
     */
    public function addFilesToCollection(int $collectionId, array $fileIds): bool
    {
        // 构建文件集项实体数组
        $items = [];
        foreach ($fileIds as $fileId) {
            $item = new FileCollectionItemEntity();
            $item->setCollectionId($collectionId);
            $item->setFileId((string) $fileId);
            $items[] = $item;
        }

        // 批量插入
        return $this->fileCollectionItemRepository->batchInsert($items);
    }

    /**
     * 从文件集移除文件.
     *
     * @param int $collectionId 文件集ID
     * @param array $fileIds 要移除的文件ID数组
     * @return bool 是否成功
     */
    public function removeFilesFromCollection(int $collectionId, array $fileIds): bool
    {
        // 获取现有文件项
        $existingItems = $this->fileCollectionItemRepository->getByCollectionId($collectionId);

        // 找出要删除的文件项
        $itemsToDelete = [];
        foreach ($existingItems as $item) {
            if (in_array($item->getFileId(), $fileIds, true)) {
                $itemsToDelete[] = $item;
            }
        }

        // 标记为删除
        if (! empty($itemsToDelete)) {
            foreach ($itemsToDelete as $item) {
                $item->setDeletedAt(date('Y-m-d H:i:s'));
            }
            return $this->fileCollectionItemRepository->batchInsert($itemsToDelete);
        }

        return true;
    }

    /**
     * 获取文件集详情.
     *
     * @param int $collectionId 文件集ID
     * @return null|FileCollectionEntity 文件集实体
     */
    public function getFileCollection(int $collectionId): ?FileCollectionEntity
    {
        return $this->fileCollectionRepository->getById($collectionId);
    }

    /**
     * 获取文件集中的所有文件.
     *
     * @param int $collectionId 文件集ID
     * @return FileCollectionItemEntity[] 文件集项实体数组
     */
    public function getFilesByCollectionId(int $collectionId): array
    {
        return $this->fileCollectionItemRepository->getByCollectionId($collectionId);
    }

    /**
     * 删除文件集（会同时删除文件集项）.
     *
     * @param int $collectionId 文件集ID
     * @return bool 是否成功
     */
    public function deleteFileCollection(int $collectionId): bool
    {
        // 1. 删除文件集项
        $this->fileCollectionItemRepository->deleteByCollectionId($collectionId);

        // 2. 删除文件集
        return $this->fileCollectionRepository->delete($collectionId);
    }

    /**
     * 批量统计文件集的文件数量.
     *
     * @param array $collectionIds 文件集ID数组
     * @return array 文件集ID => 文件数量的映射
     */
    public function countFilesByCollectionIds(array $collectionIds): array
    {
        return $this->fileCollectionItemRepository->countByCollectionIds($collectionIds);
    }

    /**
     * 根据文件集ID获取项目ID.
     *
     * @param int $collectionId 文件集ID
     * @return null|int 项目ID，如果文件集为空或文件不存在则返回 null
     */
    public function getProjectIdByCollectionId(int $collectionId): ?int
    {
        // 1. 获取文件集中的文件列表
        $fileCollectionItems = $this->getFilesByCollectionId($collectionId);
        if (empty($fileCollectionItems)) {
            return null;
        }

        // 2. 提取文件ID列表
        $fileIds = array_map(fn ($item) => (int) $item->getFileId(), $fileCollectionItems);
        if (empty($fileIds)) {
            return null;
        }

        // 3. 文件集中的文件都属于同一个项目，取第一个文件的 project_id
        $fileEntity = $this->taskFileRepository->getById($fileIds[0]);
        if ($fileEntity === null) {
            return null;
        }

        return $fileEntity->getProjectId();
    }
}
