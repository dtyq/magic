<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileVersionEntity;

interface TaskFileVersionRepositoryInterface
{
    /**
     * 根据ID获取文件版本.
     */
    public function getById(int $id): ?TaskFileVersionEntity;

    /**
     * 根据文件ID获取所有版本列表，按版本号倒序.
     *
     * @return TaskFileVersionEntity[]
     */
    public function getByFileId(int $fileId): array;

    /**
     * 获取指定文件的版本数量.
     */
    public function countByFileId(int $fileId): int;

    /**
     * 获取指定文件的最新版本号.
     */
    public function getLatestVersionNumber(int $fileId): int;

    /**
     * 插入文件版本.
     */
    public function insert(TaskFileVersionEntity $entity): TaskFileVersionEntity;

    /**
     * 根据文件ID删除超出数量限制的旧版本.
     */
    public function deleteOldVersionsByFileId(int $fileId, int $keepCount): int;

    /**
     * 根据文件ID批量删除所有版本.
     */
    public function deleteAllVersionsByFileId(int $fileId): int;

    /**
     * 获取需要清理的版本实体列表.
     *
     * @return TaskFileVersionEntity[]
     */
    public function getVersionsToCleanup(int $fileId, int $keepCount): array;

    /**
     * 分页获取指定文件的版本列表，按版本号倒序.
     *
     * @param int $fileId 文件ID
     * @param int $page 页码（从1开始）
     * @param int $pageSize 每页数量
     * @return array 包含 list 和 total 的数组
     */
    public function getByFileIdWithPage(int $fileId, int $page, int $pageSize): array;

    /**
     * 根据文件ID和版本号获取特定版本.
     */
    public function getByFileIdAndVersion(int $fileId, int $version): ?TaskFileVersionEntity;
}
