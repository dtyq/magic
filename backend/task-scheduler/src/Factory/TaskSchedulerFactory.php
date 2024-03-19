<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Factory;

use DateTime;
use Dtyq\TaskScheduler\Entity\TaskScheduler;
use Dtyq\TaskScheduler\Entity\TaskSchedulerCrontab;
use Dtyq\TaskScheduler\Entity\ValueObject\TaskSchedulerStatus;
use Dtyq\TaskScheduler\Repository\Persistence\Model\TaskSchedulerModel;

class TaskSchedulerFactory
{
    public static function modelToEntity(TaskSchedulerModel $model): TaskScheduler
    {
        $entity = new TaskScheduler();
        $entity->setId($model->id);
        $entity->setEnvironment($model->environment);
        $entity->setExternalId($model->external_id);
        $entity->setName($model->name);
        $entity->setExpectTime($model->expect_time);
        $entity->setActualTime($model->actual_time);
        $entity->setCostTime($model->cost_time);
        $entity->setType($model->type);
        $entity->setRetryTimes($model->retry_times);
        $entity->setStatus(TaskSchedulerStatus::from($model->status));
        $entity->setCallbackMethod($model->callback_method);
        $entity->setCallbackParams($model->callback_params);
        $entity->setRemark($model->remark);
        $entity->setCreator($model->creator);
        $entity->setCreatedAt($model->created_at);
        return $entity;
    }

    public static function createByCrontab(TaskSchedulerCrontab $scheduleTaskCrontab, DateTime $expectTime): TaskScheduler
    {
        $entity = new TaskScheduler();
        $entity->setEnvironment($scheduleTaskCrontab->getEnvironment());
        $entity->setExternalId($scheduleTaskCrontab->getExternalId());
        $entity->setName($scheduleTaskCrontab->getName());
        $entity->setExpectTime($expectTime);
        $entity->setType(1);
        $entity->setRetryTimes($scheduleTaskCrontab->getRetryTimes());
        $entity->setCallbackMethod($scheduleTaskCrontab->getCallbackMethod());
        $entity->setCallbackParams($scheduleTaskCrontab->getCallbackParams());
        $entity->setRemark($scheduleTaskCrontab->getRemark());
        $entity->setCreator($scheduleTaskCrontab->getCreator());
        $entity->setCreatedAt(new DateTime());
        return $entity;
    }
}
