<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Repository\Persistence;

use Dtyq\TaskScheduler\Entity\Query\Page;
use Dtyq\TaskScheduler\Entity\Query\TaskSchedulerCrontabQuery;
use Dtyq\TaskScheduler\Entity\TaskSchedulerCrontab;
use Dtyq\TaskScheduler\Factory\TaskSchedulerCrontabFactory;
use Dtyq\TaskScheduler\Repository\Persistence\Model\TaskSchedulerCrontabModel;

class TaskSchedulerCrontabRepository extends AbstractRepository
{
    public function create(TaskSchedulerCrontab $crontab): TaskSchedulerCrontab
    {
        if ($this->existsByExternalIdAndCrontab($crontab->getExternalId(), $crontab->getCrontab())) {
            return $crontab;
        }
        $model = new TaskSchedulerCrontabModel();
        $model->fill($crontab->toModelArray());
        $model->save();

        $crontab->setId($model->id);
        return $crontab;
    }

    public function save(TaskSchedulerCrontab $crontab): void
    {
        $builder = $this->createBuilder(TaskSchedulerCrontabModel::query());

        $model = $builder->find($crontab->getId());
        if (! $model) {
            return;
        }
        $model->fill($crontab->toModelArray());
        $model->save();
    }

    public function existsByExternalIdAndCrontab(string $externalId, string $crontab): bool
    {
        return $this->createBuilder(TaskSchedulerCrontabModel::query())->where('external_id', $externalId)->where('crontab', $crontab)->exists();
    }

    public function existsByExternalId(string $externalId): bool
    {
        return $this->createBuilder(TaskSchedulerCrontabModel::query())->where('external_id', $externalId)->exists();
    }

    /**
     * @return array{total: int, list: array<TaskSchedulerCrontab>}
     */
    public function queries(TaskSchedulerCrontabQuery $query, Page $page): array
    {
        $queryBuilder = $this->createBuilder(TaskSchedulerCrontabModel::query());
        if ($query->getLastGenTimeGt()) {
            $queryBuilder->where('last_gen_time', '<=', $query->getLastGenTimeGt()->format('Y-m-d H:i:s'));
        }
        if (! is_null($query->getEnable())) {
            $queryBuilder->where('enabled', $query->getEnable());
        }

        if ($query->getCreator()) {
            $queryBuilder->where('creator', $query->getCreator());
        }

        if ($query->getFilterId()) {
            $queryBuilder->where('filter_id', 'like', '%' . $query->getFilterId() . '%');
        }

        foreach ($query->getOrder() as $column => $order) {
            $queryBuilder->orderBy($column, $order);
        }
        if (! $page->isEnable()) {
            $collection = $queryBuilder->get();
            $resultList = [];

            foreach ($collection as $model) {
                if ($model instanceof TaskSchedulerCrontabModel) {
                    $resultList[] = TaskSchedulerCrontabFactory::modelToEntity($model);
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
                if ($model instanceof TaskSchedulerCrontabModel) {
                    $list[] = TaskSchedulerCrontabFactory::modelToEntity($model);
                }
            }
        }

        return [
            'total' => $total,
            'list' => $list,
        ];
    }

    public function clearByExternalId(string $externalId): void
    {
        $queryBuilder = $this->createBuilder(TaskSchedulerCrontabModel::query());
        $queryBuilder->where('external_id', $externalId)->delete();
    }

    public function getByCrontabId(int $crontabId): ?TaskSchedulerCrontabModel
    {
        return $this->createBuilder(TaskSchedulerCrontabModel::query())->where('id', $crontabId)->first();
    }
}
