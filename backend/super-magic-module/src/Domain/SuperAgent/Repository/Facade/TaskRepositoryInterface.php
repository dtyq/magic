<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\TaskModel;

interface TaskRepositoryInterface
{
    /**
     * 获取任务模型实例.
     *
     * @return TaskModel 任务模型实例
     */
    public function getModel(): TaskModel;

    /**
     * 通过ID获取任务
     */
    public function getTaskById(int $id): ?TaskEntity;

    /**
     * 通过任务ID(沙箱服务返回的taskId)获取任务
     */
    public function getTaskByTaskId(string $taskId): ?TaskEntity;

    /**
     * 通过话题ID获取任务列表.
     * @return array{list: TaskEntity[], total: int}
     */
    public function getTasksByTopicId(int $topicId, int $page, int $pageSize, array $conditions = []): array;

    /**
     * 创建任务
     */
    public function createTask(TaskEntity $taskEntity): TaskEntity;

    /**
     * 更新任务
     */
    public function updateTask(TaskEntity $taskEntity): bool;

    /**
     * 更新任务状态
     */
    public function updateTaskStatus(int $id, TaskStatus $status): bool;

    /**
     * 更新任务状态和错误信息.
     */
    public function updateTaskStatusAndErrMsg(int $id, TaskStatus $status, ?string $errMsg = null): bool;

    /**
     * 根据沙箱任务ID更新任务状态
     */
    public function updateTaskStatusByTaskId(int $id, TaskStatus $status): bool;

    /**
     * 根据沙箱任务ID更新任务状态和错误信息.
     */
    public function updateTaskStatusAndErrMsgByTaskId(int $id, TaskStatus $status, ?string $errMsg = null): bool;

    /**
     * 删除任务
     */
    public function deleteTask(int $id): bool;

    /**
     * 批量删除指定话题下的所有任务（软删除）.
     *
     * @param int $topicId 话题ID
     * @return int 被删除的任务数量
     */
    public function deleteTasksByTopicId(int $topicId): int;

    /**
     * 通过用户ID和任务ID(沙箱服务返回的taskId)获取任务
     */
    public function getTaskByUserIdAndTaskId(string $userId, string $taskId): ?TaskEntity;

    /**
     * 通过沙箱ID获取任务
     */
    public function getTaskBySandboxId(string $sandboxId): ?TaskEntity;

    /**
     * 根据用户ID获取任务列表.
     *
     * @param string $userId 用户ID
     * @param array $conditions 条件数组，如 ['task_status' => 'running']
     * @return array 任务列表
     */
    public function getTasksByUserId(string $userId, array $conditions = []): array;

    /**
     * 更新长时间处于运行状态的任务为错误状态
     *
     * @param string $timeThreshold 时间阈值，早于此时间的运行中任务将被标记为错误
     * @return int 更新的任务数量
     */
    public function updateStaleRunningTasks(string $timeThreshold): int;

    /**
     * 获取指定状态的任务列表.
     *
     * @param TaskStatus $status 任务状态
     * @return array<TaskEntity> 任务实体列表
     */
    public function getTasksByStatus(TaskStatus $status): array;

    /**
     * 获取最近更新时间超过指定时间的任务列表.
     *
     * @param string $timeThreshold 时间阈值，如果任务的更新时间早于此时间，则会被包含在结果中
     * @param int $limit 返回结果的最大数量
     * @return array<TaskEntity> 任务实体列表
     */
    public function getTasksExceedingUpdateTime(string $timeThreshold, int $limit = 100): array;

    /**
     * 获取指定话题下的任务数量.
     */
    public function getTaskCountByTopicId(int $topicId): int;

    /**
     * 根据项目ID获取任务列表.
     */
    public function getTasksByProjectId(int $projectId, string $userId): array;

    public function updateTaskStatusBySandboxIds(array $sandboxIds, string $status, string $errMsg = ''): int;

    /**
     * 统计项目下的任务数量.
     */
    public function countTasksByProjectId(int $projectId): int;

    public function updateTaskByCondition(array $condition, array $data): bool;
}
