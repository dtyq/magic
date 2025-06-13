<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskFileEntity;

interface TaskFileRepositoryInterface
{
    /**
     * 根据ID获取文件.
     */
    public function getById(int $id): ?TaskFileEntity;

    /**
     * 根据fileKey获取文件.
     */
    public function getByFileKey(string $fileKey): ?TaskFileEntity;

    /**
     * 根据话题ID获取文件列表.
     *
     * @param int $topicId 话题ID
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @param array $fileType 文件类型过滤
     * @param string $storageType 存储类型
     * @return array{list: TaskFileEntity[], total: int} 文件列表和总数
     */
    public function getByTopicId(int $topicId, int $page, int $pageSize, array $fileType = [], string $storageType = 'workspace'): array;

    /**
     * 根据任务ID获取文件列表.
     *
     * @param int $taskId 任务ID
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @return array{list: TaskFileEntity[], total: int} 文件列表和总数
     */
    public function getByTaskId(int $taskId, int $page, int $pageSize): array;

    /**
     * 根据话题任务ID获取文件列表.
     *
     * @param int $topicTaskId 话题任务ID
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @return array{list: TaskFileEntity[], total: int} 文件列表和总数
     * @deprecated 使用 getByTopicId 和 getByTaskId 方法替代
     */
    public function getByTopicTaskId(int $topicTaskId, int $page, int $pageSize): array;

    /**
     * 插入文件.
     */
    public function insert(TaskFileEntity $entity): TaskFileEntity;

    /**
     * 插入文件，如果存在冲突则忽略.
     * 根据file_key和topic_id判断是否存在冲突
     */
    public function insertOrIgnore(TaskFileEntity $entity): ?TaskFileEntity;

    /**
     * 更新文件.
     */
    public function updateById(TaskFileEntity $entity): TaskFileEntity;

    /**
     * 删除文件.
     */
    public function deleteById(int $id): void;

    /**
     * 根据文件ID数组和用户ID批量获取用户文件.
     *
     * @param array $fileIds 文件ID数组
     * @param string $userId 用户ID
     * @return TaskFileEntity[] 用户文件列表
     */
    public function findUserFilesByIds(array $fileIds, string $userId): array;
}
