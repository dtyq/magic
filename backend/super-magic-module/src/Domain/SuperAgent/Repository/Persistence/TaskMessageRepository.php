<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Repository\Persistence;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TaskMessageEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Facade\TaskMessageRepositoryInterface;
use Dtyq\SuperMagic\Domain\SuperAgent\Repository\Model\TaskMessageModel;
use Hyperf\DbConnection\Db;

class TaskMessageRepository implements TaskMessageRepositoryInterface
{
    public function __construct(protected TaskMessageModel $model)
    {
    }

    public function getById(int $id): ?TaskMessageEntity
    {
        $record = $this->model::query()->find($id);
        if (! $record) {
            return null;
        }
        return new TaskMessageEntity($record->toArray());
    }

    public function save(TaskMessageEntity $message): void
    {
        $this->model::query()->create($message->toArray());
    }

    public function batchSave(array $messages): void
    {
        $data = array_map(function (TaskMessageEntity $message) {
            return $message->toArray();
        }, $messages);

        $this->model::query()->insert($data);
    }

    public function findByTaskId(string $taskId): array
    {
        $query = $this->model::query()
            ->where('task_id', $taskId)
            ->orderBy('send_timestamp', 'asc');

        $result = Db::select($query->toSql(), $query->getBindings());

        return array_map(function ($record) {
            return new TaskMessageEntity((array) $record);
        }, $result);
    }

    /**
     * 根据话题ID获取消息列表，支持分页.
     *
     * @param int $topicId 话题ID
     * @param int $page 页码
     * @param int $pageSize 每页大小
     * @param bool $shouldPage 是否需要分页
     * @param string $sortDirection 排序方向，支持asc和desc
     * @param bool $showInUi 是否只显示UI可见的消息
     * @return array 返回包含消息列表和总数的数组 ['list' => TaskMessageEntity[], 'total' => int]
     */
    public function findByTopicId(int $topicId, int $page = 1, int $pageSize = 20, bool $shouldPage = true, string $sortDirection = 'asc', bool $showInUi = true): array
    {
        // 确保排序方向是有效的
        $sortDirection = strtolower($sortDirection) === 'desc' ? 'desc' : 'asc';

        // 构建基础查询
        $query = $this->model::query()
            ->where('topic_id', $topicId);

        // 如果 $showInUi 为 true，则添加条件过滤
        if ($showInUi) {
            $query->where('show_in_ui', true);
        }

        $query->orderBy('id', $sortDirection);

        // 获取总记录数
        $total = $query->count();

        // 如果需要分页，则添加分页条件
        if ($shouldPage) {
            $offset = ($page - 1) * $pageSize;
            $query->offset($offset)->limit($pageSize);
        }

        // 执行查询
        $records = $query->get();

        // 将查询结果转换为实体对象
        $messages = [];
        foreach ($records as $record) {
            $messages[] = new TaskMessageEntity($record->toArray());
        }

        // 返回结构化结果
        return [
            'list' => $messages,
            'total' => $total,
        ];
    }
}
