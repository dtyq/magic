<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskMessageEntity;

interface TaskMessageRepositoryInterface
{
    /**
     * 通过ID获取消息.
     */
    public function getById(int $id): ?TaskMessageEntity;

    /**
     * 保存消息.
     */
    public function save(TaskMessageEntity $message): void;

    /**
     * 批量保存消息.
     * @param TaskMessageEntity[] $messages
     */
    public function batchSave(array $messages): void;

    /**
     * 根据任务ID获取消息列表.
     * @return TaskMessageEntity[]
     */
    public function findByTaskId(string $taskId): array;

    /**
     * 根据话题ID获取消息列表，支持分页.
     * @param int $topicId 话题ID
     * @param int $page 页码
     * @param int $pageSize 每页大小
     * @param bool $shouldPage 是否需要分页
     * @param string $sortDirection 排序方向，支持asc和desc
     * @param bool $showInUi 是否只显示UI可见的消息
     * @return array 返回包含消息列表和总数的数组 ['list' => TaskMessageEntity[], 'total' => int]
     */
    public function findByTopicId(int $topicId, int $page = 1, int $pageSize = 20, bool $shouldPage = true, string $sortDirection = 'asc', bool $showInUi = true): array;

    public function getUserFirstMessageByTopicId(int $topicId, string $userId): ?TaskMessageEntity;
}
