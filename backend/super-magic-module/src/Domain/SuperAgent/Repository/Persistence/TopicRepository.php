<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TopicRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\TopicModel;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\WorkspaceModel;
use Hyperf\DbConnection\Db;

class TopicRepository implements TopicRepositoryInterface
{
    public function __construct(protected TopicModel $model)
    {
    }

    public function getTopicById(int $id): ?TopicEntity
    {
        $model = $this->model::query()->whereNull('deleted_at')
            ->where('id', $id)
            ->orWhere('chat_topic_id', $id)
            ->first();
        if (! $model) {
            return null;
        }

        $data = $this->convertModelToEntityData($model->toArray());
        return new TopicEntity($data);
    }

    public function getTopicBySandboxId(string $sandboxId): ?TopicEntity
    {
        $model = $this->model::query()->whereNull('deleted_at')->where('sandbox_id', $sandboxId)->first();
        if (! $model) {
            return null;
        }

        $data = $this->convertModelToEntityData($model->toArray());
        return new TopicEntity($data);
    }

    /**
     * 根据条件获取话题列表.
     * 支持过滤、分页和排序.
     *
     * @param array $conditions 查询条件，如 ['workspace_id' => 1, 'user_id' => 'xxx']
     * @param bool $needPagination 是否需要分页
     * @param int $pageSize 分页大小
     * @param int $page 页码
     * @param string $orderBy 排序字段
     * @param string $orderDirection 排序方向，asc 或 desc
     * @return array{list: TopicEntity[], total: int} 话题列表和总数
     */
    public function getTopicsByConditions(
        array $conditions = [],
        bool $needPagination = true,
        int $pageSize = 10,
        int $page = 1,
        string $orderBy = 'id',
        string $orderDirection = 'desc'
    ): array {
        // 构建基础查询
        $query = $this->model::query();

        // 默认过滤已删除的数据
        $query->whereNull('deleted_at');

        // 应用条件过滤
        foreach ($conditions as $field => $value) {
            if (is_array($value)) {
                $query->whereIn($field, $value);
            } elseif ($field === 'topic_name') {
                // topic_name 字段使用 like 操作进行模糊匹配
                $query->where($field, 'like', '%' . $value . '%');
            } else {
                $query->where($field, $value);
            }
        }

        // 获取总数
        $total = $query->count();

        // 应用排序
        $query->orderBy($orderBy, $orderDirection);

        // 应用分页
        if ($needPagination) {
            $offset = ($page - 1) * $pageSize;
            $query->skip($offset)->take($pageSize);
        }

        // 获取数据
        $topics = Db::select($query->toSql(), $query->getBindings());

        // 转换为实体对象
        $list = [];
        foreach ($topics as $topic) {
            $list[] = new TopicEntity($topic);
        }

        return [
            'list' => $list,
            'total' => $total,
        ];
    }

    public function createTopic(TopicEntity $topicEntity): TopicEntity
    {
        $date = date('Y-m-d H:i:s');
        $topicEntity->setId(IdGenerator::getSnowId());
        $topicEntity->setCreatedAt($date);
        $topicEntity->setUpdatedAt($date);

        $entityArray = $topicEntity->toArray();

        $model = $this->model::query()->create($entityArray);
        /* @var TopicModel $model */
        $topicEntity->setId($model->id);

        return $topicEntity;
    }

    public function updateTopic(TopicEntity $topicEntity): bool
    {
        $topicEntity->setUpdatedAt(date('Y-m-d H:i:s'));
        $entityArray = $topicEntity->toArray();

        return $this->model::query()
            ->where('id', $topicEntity->getId())
            ->update($entityArray) > 0;
    }

    // 使用updated_at 作为乐观锁
    public function updateTopicWithUpdatedAt(TopicEntity $topicEntity, string $updatedAt): bool
    {
        $topicEntity->setUpdatedAt(date('Y-m-d H:i:s'));
        $entityArray = $topicEntity->toArray();
        return $this->model::query()
            ->where('id', $topicEntity->getId())
            ->where('updated_at', $updatedAt)
            ->update($entityArray) > 0;
    }

    public function updateTopicByCondition(array $condition, array $data): bool
    {
        return $this->model::query()
            ->where($condition)
            ->update($data) > 0;
    }

    public function deleteTopic(int $id): bool
    {
        return $this->model::query()
            ->where('id', $id)
            ->update([
                'deleted_at' => date('Y-m-d H:i:s'),
            ]) > 0;
    }

    /**
     * 通过话题ID集合获取工作区信息.
     *
     * @param array $topicIds 话题ID集合
     * @return array 以话题ID为键，工作区信息为值的关联数组，格式：['话题ID' => ['workspace_id' => '工作区ID', 'workspace_name' => '工作区名称']]
     */
    public function getWorkspaceInfoByTopicIds(array $topicIds): array
    {
        if (empty($topicIds)) {
            return [];
        }

        // 转换所有ID为整数
        $topicIds = array_map('intval', $topicIds);

        // 使用原生SQL联表查询，提高性能
        $sql = 'SELECT t.id as topic_id, w.id as workspace_id, w.name as workspace_name
                FROM ' . $this->model->getTable() . ' t
                JOIN ' . (new WorkspaceModel())->getTable() . ' w ON t.workspace_id = w.id
                WHERE t.id IN (' . implode(',', $topicIds) . ')
                AND t.deleted_at IS NULL
                AND w.deleted_at IS NULL';

        $results = Db::select($sql);

        // 整理结果为以话题ID为键的关联数组
        $workspaceInfo = [];
        foreach ($results as $row) {
            $workspaceInfo[$row['topic_id']] = [
                'workspace_id' => (string) $row['workspace_id'],
                'workspace_name' => $row['workspace_name'],
            ];
        }

        return $workspaceInfo;
    }

    /**
     * 获取话题状态统计数据.
     *
     * @param array $conditions 统计条件，如 ['user_id' => '123', 'organization_code' => 'abc']
     * @return array 包含各状态数量的数组
     */
    public function getTopicStatusMetrics(array $conditions = []): array
    {
        // 使用原生SQL查询以提高性能，按状态分组获取计数
        $baseQuery = $this->model::query();

        // 处理过滤条件
        foreach ($conditions as $field => $value) {
            if (is_array($value)) {
                $baseQuery->whereIn($field, $value);
            } else {
                $baseQuery->where($field, $value);
            }
        }

        // 默认过滤已删除的数据
        $baseQuery->whereNull('deleted_at');

        // 统计唯一用户数
        $userCount = $baseQuery->distinct()->count('user_id');

        // 统计话题总数
        $topicCount = $baseQuery->count();

        // 统计各状态的话题数量
        $statusCounts = $baseQuery
            ->selectRaw('current_task_status, COUNT(*) as count')
            ->groupBy('current_task_status')
            ->get()
            ->keyBy('current_task_status')
            ->map(function ($item) {
                return (int) $item->count;
            })
            ->toArray();

        // 准备返回结果
        return [
            'status_metrics' => [
                'error_count' => $statusCounts['error'] ?? 0,
                'completed_count' => $statusCounts['finished'] ?? 0,
                'running_count' => $statusCounts['running'] ?? 0,
                'waiting_count' => $statusCounts['waiting'] ?? 0,
                'paused_count' => ($statusCounts['suspended'] ?? 0) + ($statusCounts['stopped'] ?? 0),
            ],
            'total_metrics' => [
                'user_count' => $userCount,
                'topic_count' => $topicCount,
            ],
        ];
    }

    public function updateTopicStatus(int $id, $taskId, string $sandboxId, TaskStatus $status): bool
    {
        return $this->model::query()
            ->where('id', $id)
            ->update([
                'sandbox_id' => $sandboxId,
                'current_task_id' => $taskId,
                'current_task_status' => $status->value,
                'updated_at' => date('Y-m-d H:i:s'),
            ]) > 0;
    }

    public function updateTopicStatusAndSandboxId(int $id, $taskId, TaskStatus $status, string $sandboxId): bool
    {
        return $this->model::query()
            ->where('id', $id)
            ->update([
                'current_task_id' => $taskId,
                'current_task_status' => $status->value,
                'sandbox_id' => $sandboxId,
                'updated_at' => date('Y-m-d H:i:s'),
            ]) > 0;
    }

    /**
     * 获取最近更新时间超过指定时间的话题列表.
     *
     * @param string $timeThreshold 时间阈值，如果话题的更新时间早于此时间，则会被包含在结果中
     * @param int $limit 返回结果的最大数量
     * @return array<TopicEntity> 话题实体列表
     */
    public function getTopicsExceedingUpdateTime(string $timeThreshold, int $limit = 100): array
    {
        $models = $this->model::query()
            ->where('updated_at', '<', $timeThreshold)
            ->where('current_task_status', TaskStatus::RUNNING->value)
            ->whereNull('deleted_at')
            ->orderBy('id', 'asc')
            ->limit($limit)
            ->get();

        $result = [];
        foreach ($models as $model) {
            $data = $this->convertModelToEntityData($model->toArray());
            $result[] = new TopicEntity($data);
        }

        return $result;
    }

    public function updateTopicStatusBySandboxIds(array $sandboxIds, string $status): bool
    {
        return $this->model::query()
            ->whereIn('sandbox_id', $sandboxIds)
            ->update([
                'current_task_status' => $status,
                'updated_at' => date('Y-m-d H:i:s'),
            ]) > 0;
    }

    /**
     * 根据项目ID获取话题列表.
     */
    public function getTopicsByProjectId(int $projectId, string $userId): array
    {
        $models = $this->model::query()
            ->where('project_id', $projectId)
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->orderBy('updated_at', 'desc')
            ->get();

        $result = [];
        foreach ($models as $model) {
            $data = $this->convertModelToEntityData($model->toArray());
            $result[] = new TopicEntity($data);
        }

        return $result;
    }

    /**
     * 统计项目下的话题数量.
     */
    public function countTopicsByProjectId(int $projectId): int
    {
        return $this->model::query()
            ->where('project_id', $projectId)
            ->whereNull('deleted_at')
            ->count();
    }

    /**
     * 批量获取有运行中话题的工作区ID列表.
     *
     * @param array $workspaceIds 工作区ID数组
     * @return array 有运行中话题的工作区ID数组
     */
    public function getRunningWorkspaceIds(array $workspaceIds): array
    {
        if (empty($workspaceIds)) {
            return [];
        }

        return $this->model::query()
            ->whereIn('workspace_id', $workspaceIds)
            ->where('current_task_status', TaskStatus::RUNNING->value)
            ->whereNull('deleted_at')
            ->distinct()
            ->pluck('workspace_id')
            ->toArray();
    }

    /**
     * 批量获取有运行中话题的项目ID列表.
     *
     * @param array $projectIds 项目ID数组
     * @return array 有运行中话题的项目ID数组
     */
    public function getRunningProjectIds(array $projectIds): array
    {
        if (empty($projectIds)) {
            return [];
        }

        return $this->model::query()
            ->whereIn('project_id', $projectIds)
            ->where('current_task_status', TaskStatus::RUNNING->value)
            ->whereNull('deleted_at')
            ->distinct()
            ->pluck('project_id')
            ->toArray();
    }

    /**
     * 将数据库模型数据转换为实体数据.
     * @param array $modelData 模型数据
     * @return array 实体数据
     */
    private function convertModelToEntityData(array $modelData): array
    {
        // 将下划线命名转换为驼峰命名
        $entityData = [];
        foreach ($modelData as $key => $value) {
            $camelKey = $this->snakeToCamel($key);
            $entityData[$camelKey] = $value;
        }
        return $entityData;
    }

    /**
     * 将下划线命名转换为驼峰命名.
     * 例如：user_id => userId, topic_name => topicName.
     *
     * @param string $snake 下划线命名的字符串
     * @return string 驼峰命名的字符串
     */
    private function snakeToCamel(string $snake): string
    {
        // 处理连字符和下划线的情况
        return lcfirst(str_replace(' ', '', ucwords(str_replace(['_', '-'], ' ', $snake))));
    }
}
