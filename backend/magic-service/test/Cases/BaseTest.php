<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases;

use HyperfTest\HttpTestCase;

/**
 * @internal
 */
class BaseTest extends HttpTestCase
{
    public function testO()
    {
        $this->assertTrue(defined('MAGIC_ACCESS_TOKEN'));
    }
}
