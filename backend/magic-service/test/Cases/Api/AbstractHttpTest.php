<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api;

use HyperfTest\HttpTestCase;

/**
 * 本文件属于灯塔引擎版权所有，泄漏必究。
 * @internal
 */
class AbstractHttpTest extends HttpTestCase
{
    public function getOrganizationCode(): string
    {
        return '000';
    }

    protected function getApiKey(): string
    {
        // 优先使用单元测试指定的token，如果不存在则使用默认token
        return \Hyperf\Support\env('UNIT_TEST_USER_TOKEN') ?: \Hyperf\Support\env('MAGIC_API_DEFAULT_ACCESS_TOKEN', 'unit_test_user_token');
    }
}
