<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Cases\Application\Flow\Collector\BuiltInToolSet;

use App\Infrastructure\Core\Collector\BuiltInToolSet\BuiltInToolSetCollector;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class BuiltInToolSetCollectorTest extends BaseTest
{
    public function testList()
    {
        $list = BuiltInToolSetCollector::list();
        $this->assertTrue(is_array($list));
    }
}
