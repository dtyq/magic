<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\TaskScheduler\Test\Cases\Entity;

use DateTime;
use Dtyq\TaskScheduler\Entity\TaskSchedulerCrontab;
use Dtyq\TaskScheduler\Test\Cases\AbstractTestCase;

/**
 * @internal
 * @coversNothing
 */
class TaskSchedulerCrontabTest extends AbstractTestCase
{
    public function testListCycleDate()
    {
        $crontab = new TaskSchedulerCrontab();
        $crontab->setLastGenTime(new DateTime('2021-01-01'));
        $crontab->setCrontab('* * * * *');

        $list = $crontab->listCycleDate(new DateTime('2021-01-02'), 1);
        $this->assertCount(1, $list);
        $list = $crontab->listCycleDate(new DateTime('2021-01-02'), 1);
        $this->assertCount(1, $list);
        $this->assertEquals('2021-01-01 00:02:00', $list[0]->format('Y-m-d H:i:s'));
    }
}
