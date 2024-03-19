<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Task;

use HyperfTest\Cases\BaseTest;
use Magic\MagicApiPremium\HighAvailability\Task\EndpointStatisticsAggregateTask;

/**
 * @internal
 */
class EndpointTaskTest extends BaseTest
{
    public function testEndpointStatisticsAggregateTask()
    {
        make(EndpointStatisticsAggregateTask::class)->execute();
    }
}
