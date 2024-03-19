<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Flow\Collector\ExecuteManager;

use App\Infrastructure\Core\Collector\ExecuteManager\AgentPluginCollector;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class AgentPluginCollectorTest extends BaseTest
{
    public function testList()
    {
        $list = AgentPluginCollector::list();
        var_dump($list);
        $this->assertTrue(true);
    }
}
