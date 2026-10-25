<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Task\Repository\Persistence;

use App\Domain\SuperMagic\Task\Entity\TaskEntity;
use App\Domain\SuperMagic\Task\Entity\ValueObject\TaskStatus;
use App\Domain\SuperMagic\Task\Repository\Facade\TaskRepositoryInterface;
use App\Domain\SuperMagic\Task\Repository\Model\TaskModel;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\DbConnection\Db;
use InvalidArgumentException;

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

    public function getTasksByIds(array $ids): array
    {
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids), static fn (int $id): bool => $id > 0)));
        if ($ids === []) {
            return [];
        }

        $result = [];
        foreach ($this->model::query()->whereIn('id', $ids)->get() as $model) {
            $entity = new TaskEntity($model->toArray());
            $result[$entity->getId()] = $entity;
        }
        return $result;
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
     * 获取开始时间早于指定阈值且状态为 running/waiting 的任务列表（超时任务扫描）.
     *
     * 索引契约：走 idx_status_deleted_started (task_status, deleted_at, started_at)，
     * 「IN 等值 → IS NULL 等值 → started_at 范围」配合 LIMIT 早停，扫描行数约等于 limit。
     * 不要加 ORDER BY：两个 status range 的返回本无全局顺序，且 ORDER BY id 会诱导优化器
     * 放弃索引改走主键全表扫描，增加查询开销；
     * 批内最老优先由下方 PHP usort 保证。
     *
     * 注意：started_at 在建任务时即写入（TaskDomainService::initTopicTask），实际语义是创建时间；
     * started_at 为 NULL 的存量行永远不会被本查询命中，应单独回填治理，
     * 不要在此改成 orWhereNull 兜底。
     *
     * @param string $timeThreshold 时间阈值，开始时间早于此时间的任务会被包含在结果中
     * @param int $limit 返回结果的最大数量
     * @return array<TaskEntity> 任务实体列表
     */
    public function getRunningTasksExceedingCreatedTime(string $timeThreshold, int $limit = 100): array
    {
        $models = $this->model::query()
            ->where('started_at', '<', $timeThreshold)
            ->whereIn('task_status', [TaskStatus::RUNNING->value, TaskStatus::WAITING->value])
            ->whereNull('deleted_at')
            ->limit($limit)
            ->get();

        $result = [];
        foreach ($models as $model) {
            $result[] = new TaskEntity($model->toArray());
        }

        usort($result, static fn (TaskEntity $a, TaskEntity $b): int => $a->getId() <=> $b->getId());

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

    public function updateTaskStatusByTopicIds(array $topicIds, string $status, string $errMsg = '', $finishedTime = null, array $fromStatuses = []): int
    {
        $query = $this->model::query()
            ->whereIn('topic_id', $topicIds);

        // Only update tasks with specified statuses
        if (! empty($fromStatuses)) {
            $query->whereIn('task_status', $fromStatuses);
        }

        return $query->update([
            'task_status' => $status,
            'err_msg' => $errMsg,
            'updated_at' => date('Y-m-d H:i:s'),
            'finished_at' => $finishedTime,
        ]);
    }

    /**
     * 按条件批量更新任务.
     * 条件值为数组时走 whereIn，标量走 where。
     *
     * 仅允许包含 id 或 topic_id 的条件：索引整治后本表有索引的查询维度只有主键与
     * topic_id（idx_topic_deleted），user_id / project_id / sandbox_id 等维度的更新会
     * 全表扫描并对全部扫描行加锁；项目/用户维度请先经 topics 表转换为 topic_id 后再更新。
     * 空条件会静默更新全表，同样被守卫拦截。
     *
     * @throws InvalidArgumentException 条件为空或不含 id / topic_id 时
     */
    public function updateTaskByCondition(array $condition, array $data): bool
    {
        if (empty($condition) || (! array_key_exists('id', $condition) && ! array_key_exists('topic_id', $condition))) {
            throw new InvalidArgumentException(
                'updateTaskByCondition 仅允许按 id 或 topic_id 维度更新，项目/用户维度请先经 topics 表转换为 topic_id。'
            );
        }

        $query = $this->model::query();
        foreach ($condition as $field => $value) {
            if (is_array($value)) {
                $query->whereIn($field, $value);
            } else {
                $query->where($field, $value);
            }
        }
        return $query->update($data) > 0;
    }

    public function batchCreateTasks(array $taskEntities): array
    {
        if (empty($taskEntities)) {
            return [];
        }

        $date = date('Y-m-d H:i:s');
        $insertData = [];

        foreach ($taskEntities as $taskEntity) {
            // 如果ID未设置，则自动生成（向下兼容）
            if (empty($taskEntity->getId())) {
                $taskEntity->setId(IdGenerator::getSnowId());
            }

            // 确保时间戳设置正确
            if (empty($taskEntity->getCreatedAt())) {
                $taskEntity->setCreatedAt($date);
            }
            if (empty($taskEntity->getUpdatedAt())) {
                $taskEntity->setUpdatedAt($date);
            }

            $insertData[] = $taskEntity->toArray();
        }

        // 批量插入
        $this->model::query()->insert($insertData);

        return $taskEntities; // 直接返回传入的entities，因为它们已经包含了正确的ID
    }
}
