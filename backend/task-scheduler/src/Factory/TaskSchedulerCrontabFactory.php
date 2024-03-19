<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Factory;

use Dtyq\TaskScheduler\Entity\TaskSchedulerCrontab;
use Dtyq\TaskScheduler\Repository\Persistence\Model\TaskSchedulerCrontabModel;

class TaskSchedulerCrontabFactory
{
    public static function modelToEntity(TaskSchedulerCrontabModel $model): TaskSchedulerCrontab
    {
        $crontab = new TaskSchedulerCrontab();
        $crontab->setId($model->id);
        $crontab->setEnvironment($model->environment);
        $crontab->setExternalId($model->external_id);
        $crontab->setName($model->name);
        $crontab->setCrontab($model->crontab);
        $crontab->setLastGenTime($model->last_gen_time);
        $crontab->setEnabled($model->enabled);
        $crontab->setRetryTimes($model->retry_times);
        $crontab->setCallbackMethod($model->callback_method);
        $crontab->setCallbackParams($model->callback_params);
        $crontab->setRemark($model->remark);
        $crontab->setDeadline($model->deadline);
        $crontab->setCreator($model->creator);
        $crontab->setFilterId($model->filter_id);
        $crontab->setCreatedAt($model->created_at);
        return $crontab;
    }
}
