<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Repository\Persistence;

use DateTime;
use Dtyq\TaskScheduler\Entity\Query\Page;
use Dtyq\TaskScheduler\Entity\Query\TaskSchedulerQuery;
use Dtyq\TaskScheduler\Entity\TaskScheduler;
use Dtyq\TaskScheduler\Entity\ValueObject\TaskSchedulerStatus;
use Dtyq\TaskScheduler\Factory\TaskSchedulerFactory;
use Dtyq\TaskScheduler\Repository\Persistence\Model\TaskSchedulerModel;

class TaskSchedulerRepository extends AbstractRepository
{
    public function save(TaskScheduler $scheduleTask): TaskScheduler
    {
        if ($scheduleTask->shouldCreate()) {
            $model = new TaskSchedulerModel();
            // 如果是创建过的，就不创建了
            if ($this->existsByExternalIdAndExpectTime($scheduleTask->getExternalId(), $scheduleTask->getExpectTime())) {
                return $scheduleTask;
            }
        } else {
            $model = $this->createBuilder(TaskSchedulerModel::query())->find($scheduleTask->getId());
            if (! $model) {
                return $scheduleTask;
            }
        }
        $model->fill($scheduleTask->toModelArray());
        $model->save();

        if (isset($model->id)) {
            $scheduleTask->setId($model->id);
        }

        return $scheduleTask;
    }

    // 批量写入
    public function batchCreate(array $scheduleTasks): void
    {
        $models = [];
        foreach ($scheduleTasks as $scheduleTask) {
            $models[] = $scheduleTask->toModelString();
        }

        // 拆分批量写入,每次写入500条
        $newModels = array_chunk($models, 500);
        foreach ($newModels as $model) {
            TaskSchedulerModel::query()->insert($model);
        }
    }

    public function existsByExternalIdAndExpectTime(string $externalId, DateTime $expectTime): bool
    {
        return $this->createBuilder(TaskSchedulerModel::query())
            ->where('external_id', $externalId)
            ->where('expect_time', $expectTime->format('Y-m-d H:i:s'))
            ->exists();
    }

    /**
     * @return array{total: int, list: array<TaskScheduler>}
     */
    public function queries(TaskSchedulerQuery $query, Page $page): array
    {
        $queryBuilder = $this->createBuilder(TaskSchedulerModel::query());
        if ($query->getIds()) {
            $queryBuilder->whereIn('id', $query->getIds());
        }
        if ($query->getExternalIds()) {
            $queryBuilder->whereIn('external_id', $query->getExternalIds());
        }
        if ($query->getStatus()) {
            $queryBuilder->where('status', $query->getStatus()->value);
        }
        if ($query->getExpectTimeLt()) {
            $queryBuilder->where('expect_time', '<=', $query->getExpectTimeLt()->format('Y-m-d H:i:s'));
        }
        foreach ($query->getOrder() as $column => $order) {
            $queryBuilder->orderBy($column, $order);
        }

        if (! $page->isEnable()) {
            $collection = $queryBuilder->get();
            $resultList = [];

            foreach ($collection as $model) {
                if ($model instanceof TaskSchedulerModel) {
                    $resultList[] = TaskSchedulerFactory::modelToEntity($model);
                }
            }

            return [
                'total' => 0,
                'list' => $resultList,
            ];
        }

        $total = $queryBuilder->count();
        $list = [];
        if ($total !== 0) {
            $collection = $queryBuilder->forPage($page->getPage(), $page->getPageNum())->get();

            foreach ($collection as $model) {
                if ($model instanceof TaskSchedulerModel) {
                    $list[] = TaskSchedulerFactory::modelToEntity($model);
                }
            }
        }

        return [
            'total' => $total,
            'list' => $list,
        ];
    }

    public function cancelByIds(array $ids): void
    {
        if (empty($ids)) {
            return;
        }
        $ids = array_values(array_unique($ids));
        $this->createBuilder(TaskSchedulerModel::query())->whereIn('id', $ids)->update(['status' => TaskSchedulerStatus::Canceled->value]);
    }

    public function deleteByIds(array $clearIds): void
    {
        if (empty($clearIds)) {
            return;
        }
        $this->createBuilder(TaskSchedulerModel::query())->whereIn('id', $clearIds)->delete();
    }

    public function changeStatus($id, TaskSchedulerStatus $status): void
    {
        if (empty($id)) {
            return;
        }

        $ids = is_array($id) ? $id : [$id];
        $this->createBuilder(TaskSchedulerModel::query())->whereIn('id', $ids)->update(['status' => $status->value]);
    }

    public function getById(int $id): ?TaskScheduler
    {
        /** @var TaskSchedulerModel $model */
        $model = $this->createBuilder(TaskSchedulerModel::query())->find($id);
        return TaskSchedulerFactory::modelToEntity($model);
    }

    public function clearByExternalId(string $externalId): void
    {
        $queryBuilder = $this->createBuilder(TaskSchedulerModel::query());
        $queryBuilder->where('external_id', $externalId)->delete();
    }
}
