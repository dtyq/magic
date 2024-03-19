<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\VendorCases\AsyncEvent;

use Dtyq\AsyncEvent\AsyncEventUtil;
use Dtyq\AsyncEvent\Demo\DemoEvent;
use HyperfTest\HttpTestCase;

/**
 * @internal
 */
class DemoEventTest extends HttpTestCase
{
    public function testDemoEvent(): void
    {
        AsyncEventUtil::dispatch(new DemoEvent('xxx'));
        $this->assertTrue(true);
    }
}
