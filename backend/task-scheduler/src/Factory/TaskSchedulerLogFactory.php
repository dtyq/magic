<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Factory;

use Dtyq\TaskScheduler\Entity\TaskScheduler;
use Dtyq\TaskScheduler\Entity\TaskSchedulerLog;

class TaskSchedulerLogFactory
{
    public static function createByScheduleTask(TaskScheduler $scheduleTask): TaskSchedulerLog
    {
        $scheduleTaskLog = new TaskSchedulerLog();
        $scheduleTaskLog->setTaskId($scheduleTask->getId());
        $scheduleTaskLog->setEnvironment($scheduleTask->getEnvironment());
        $scheduleTaskLog->setExternalId($scheduleTask->getExternalId());
        $scheduleTaskLog->setName($scheduleTask->getName());
        $scheduleTaskLog->setExpectTime($scheduleTask->getExpectTime());
        $scheduleTaskLog->setActualTime($scheduleTask->getActualTime());
        $scheduleTaskLog->setCostTime($scheduleTask->getCostTime());
        $scheduleTaskLog->setType($scheduleTask->getType());
        $scheduleTaskLog->setStatus($scheduleTask->getStatus());
        $scheduleTaskLog->setCallbackMethod($scheduleTask->getCallbackMethod());
        $scheduleTaskLog->setCallbackParams($scheduleTask->getCallbackParams());
        $scheduleTaskLog->setRemark($scheduleTask->getRemark());
        $scheduleTaskLog->setCreator($scheduleTask->getCreator());
        $scheduleTaskLog->setCreatedAt($scheduleTask->getCreatedAt());
        return $scheduleTaskLog;
    }
}
