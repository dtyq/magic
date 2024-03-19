<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Repository\Persistence;

use Dtyq\TaskScheduler\Entity\TaskSchedulerLog;
use Dtyq\TaskScheduler\Repository\Persistence\Model\TaskSchedulerLogModel;

class TaskSchedulerLogRepository
{
    public function create(TaskSchedulerLog $log): TaskSchedulerLog
    {
        $model = new TaskSchedulerLogModel();
        $model->fill($log->toModelArray());
        $model->save();
        $log->setId($model->id);
        return $log;
    }
}
