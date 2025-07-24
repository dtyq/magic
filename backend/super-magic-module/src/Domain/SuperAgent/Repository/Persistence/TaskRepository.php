<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\TaskModel;
use Hyperf\DbConnection\Db;

class TaskRepository implements TaskRepositoryInterface
{
    public function __construct(protected TaskModel $model)
    {
    }

    /**
     * 获取任务模型.
     *
     * @return TaskModel 任务模型
     */
    public function getModel(): TaskModel
    {
        return $this->model;
    }

    public function getTaskById(int $id): ?TaskEntity
    {
        $model = $this->model::query()->find($id);
        if (! $model) {
            return null;
        }
        return new TaskEntity($model->toArray());
    }

    /**
     * 通过任务ID(沙箱服务返回的taskId)获取任务
     */
    public function getTaskByTaskId(string $taskId): ?TaskEntity
    {
        $model = $this->model::query()->where('task_id', $taskId)->first();
        if (! $model) {
            return null;
        }
        return new TaskEntity($model->toArray());
    }

    /**
     * 通过话题ID获取任务列表.
     * @return array{list: TaskEntity[], total: int}
     */
    public function getTasksByTopicId(int $topicId, int $page, int $pageSize, array $conditions = []): array
    {
        $offset = ($page - 1) * $pageSize;
        $query = $this->model::query()->where('topic_id', $topicId);
        // 构造条件
        foreach ($conditions as $field => $value) {
            if (is_array($value)) {
                $query->whereIn($field, $value);
            } else {
                $query->where($field, $value);
            }
        }
        // 先获取总数
        $total = $query->count();

        // 获取分页数据
        $query = $query->skip($offset)
            ->take($pageSize)
            ->orderBy('id', 'desc');

        $result = Db::select($query->toSql(), $query->getBindings());

        $list = [];
        foreach ($result as $item) {
            $list[] = new TaskEntity((array) $item);
        }

        return [
            'list' => $list,
            'total' => $total,
        ];
    }

    public function createTask(TaskEntity $taskEntity): TaskEntity
    {
        $date = date('Y-m-d H:i:s');

        // 如果ID未设置，则自动生成
        if (empty($taskEntity->getId())) {
            $taskEntity->setId(IdGenerator::getSnowId());
        }

        $taskEntity->setCreatedAt($date);
        $taskEntity->setUpdatedAt($date);

        $entityArray = $taskEntity->toArray();
        $model = $this->model::query()->create($entityArray);
        $taskEntity->setId($model->id);

        return $taskEntity;
    }

    public function updateTask(TaskEntity $taskEntity): bool
    {
        $taskEntity->setUpdatedAt(date('Y-m-d H:i:s'));
        $entityArray = $taskEntity->toArray();

        return $this->model::query()
            ->where('id', $taskEntity->getId())
            ->update($entityArray) > 0;
    }

    public function updateTaskStatus(int $id, TaskStatus $status): bool
    {
        return $this->model::query()
            ->where('id', $id)
            ->update([
                'task_status' => $status->value,
                'updated_at' => date('Y-m-d H:i:s'),
            ]) > 0;
    }

    /**
     * 根据沙箱任务ID更新任务状态
     */
    public function updateTaskStatusByTaskId(int $id, TaskStatus $status): bool
    {
        return $this->model::query()
            ->where('id', $id)
            ->update([
                'task_status' => $status->value,
                'updated_at' => date('Y-m-d H:i:s'),
            ]) > 0;
    }

    public function deleteTask(int $id): bool
    {
        return $this->model::query()
            ->where('id', $id)
            ->update([
                'deleted_at' => date('Y-m-d H:i:s'),
            ]) > 0;
    }

    /**
     * 通过用户ID和任务ID(沙箱服务返回的taskId)获取任务
     */
    public function getTaskByUserIdAndTaskId(string $userId, string $taskId): ?TaskEntity
    {
        $model = $this->model::query()
            ->where('user_id', $userId)
            ->where('id', $taskId)
            ->first();

        if (empty($model->toArray())) {
            return null;
        }

        return new TaskEntity($model->toArray());
    }

    /**
     * 通过沙箱ID获取任务
     */
    public function getTaskBySandboxId(string $sandboxId): ?TaskEntity
    {
        $model = $this->model::query()->where('sandbox_id', $sandboxId)->first();
        if (! $model) {
            return null;
        }
        return new TaskEntity($model->toArray());
    }

    /**
     * 根据用户ID获取任务列表.
     *
     * @param string $userId 用户ID
     * @param array $conditions 条件数组，如 ['task_status' => 'running']
     * @return array 任务列表
     */
    public function getTasksByUserId(string $userId, array $conditions = []): array
    {
        $query = $this->model::query()
            ->where('user_id', $userId);

        // 添加其他过滤条件
        foreach ($conditions as $field => $value) {
            $query->where($field, $value);
        }

        $tasks = Db::select($query->toSql(), $query->getBindings());

        $result = [];
        foreach ($tasks as $task) {
            $result[] = new TaskEntity((array) $task);
        }

        return $result;
    }

    /**
     * 更新长时间处于运行状态的任务为错误状态
     *
     * @param string $timeThreshold 时间阈值，早于此时间的运行中任务将被标记为错误
     * @return int 更新的任务数量
     */
    public function updateStaleRunningTasks(string $timeThreshold): int
    {
        return $this->model::query()
            ->where('task_status', TaskStatus::RUNNING->value)
            ->where('updated_at', '<', $timeThreshold)
            ->whereNull('deleted_at')
            ->update([
                'task_status' => TaskStatus::ERROR->value,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
    }

    /**
     * 获取指定状态的任务列表.
     *
     * @param TaskStatus $status 任务状态
     * @return array<TaskEntity> 任务实体列表
     */
    public function getTasksByStatus(TaskStatus $status): array
    {
        $models = $this->model::query()
            ->where('task_status', $status->value)
            ->whereNull('deleted_at')
            ->get();

        $result = [];
        foreach ($models as $model) {
            $result[] = new TaskEntity($model->toArray());
        }

        return $result;
    }

    /**
     * 批量删除指定话题下的所有任务（软删除）.
     *
     * @param int $topicId 话题ID
     * @return int 被删除的任务数量
     */
    public function deleteTasksByTopicId(int $topicId): int
    {
        // 使用批量更新操作，将指定话题下所有未删除的任务的 deleted_at 字段设置为当前时间
        $now = date('Y-m-d H:i:s');
        return $this->model::query()
            ->where('topic_id', $topicId)
            ->whereNull('deleted_at')  // 确保只更新未删除的任务
            ->update(['deleted_at' => $now]);
    }

    /**
     * 更新任务状态和错误信息.
     */
    public function updateTaskStatusAndErrMsg(int $id, TaskStatus $status, ?string $errMsg = null): bool
    {
        $updateData = [
            'task_status' => $status->value,
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        if ($errMsg !== null) {
            $updateData['err_msg'] = $errMsg;
        }

        return $this->model::query()
            ->where('id', $id)
            ->update($updateData) > 0;
    }

    /**
     * 根据沙箱任务ID更新任务状态和错误信息.
     */
    public function updateTaskStatusAndErrMsgByTaskId(int $id, TaskStatus $status, ?string $errMsg = null): bool
    {
        $updateData = [
            'task_status' => $status->value,
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        if ($errMsg !== null) {
            $updateData['err_msg'] = $errMsg;
        }

        return $this->model::query()
            ->where('id', $id)
            ->update($updateData) > 0;
    }

    /**
     * 获取最近更新时间超过指定时间的任务列表.
     *
     * @param string $timeThreshold 时间阈值，如果任务的更新时间早于此时间，则会被包含在结果中
     * @param int $limit 返回结果的最大数量
     * @return array<TaskEntity> 任务实体列表
     */
    public function getTasksExceedingUpdateTime(string $timeThreshold, int $limit = 100): array
    {
        $models = $this->model::query()
            ->where('updated_at', '<', $timeThreshold)
            ->where('task_status', TaskStatus::RUNNING->value)
            ->whereNull('deleted_at')
            ->orderBy('id', 'asc')
            ->limit($limit)
            ->get();

        $result = [];
        foreach ($models as $model) {
            $result[] = new TaskEntity($model->toArray());
        }

        return $result;
    }

    /**
     * 获取指定话题下的任务数量.
     */
    public function getTaskCountByTopicId(int $topicId): int
    {
        return $this->model::query()
            ->where('topic_id', $topicId)
            ->whereNull('deleted_at')
            ->count();
    }

    /**
     * 根据项目ID获取任务列表.
     */
    public function getTasksByProjectId(int $projectId, string $userId): array
    {
        $models = $this->model::query()
            ->where('project_id', $projectId)
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->orderBy('updated_at', 'desc')
            ->get();

        $result = [];
        foreach ($models as $model) {
            $result[] = new TaskEntity($model->toArray());
        }

        return $result;
    }

    public function updateTaskStatusBySandboxIds(array $sandboxIds, string $status, string $errMsg = ''): int
    {
        return $this->model::query()
            ->whereIn('sandbox_id', $sandboxIds)
            ->update([
                'task_status' => $status,
                'err_msg' => $errMsg,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
    }

    /**
     * 统计项目下的任务数量.
     */
    public function countTasksByProjectId(int $projectId): int
    {
        return $this->model::query()
            ->where('project_id', $projectId)
            ->whereNull('deleted_at')
            ->count();
    }

    public function updateTaskByCondition(array $condition, array $data): bool
    {
        return $this->model::query()
            ->where($condition)
            ->update($data) > 0;
    }
}
