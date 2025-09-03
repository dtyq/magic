<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\SuperAgent;

use HyperfTest\Cases\Api\AbstractHttpTest;

/**
 * @internal
 */
class AbstractApiTest extends AbstractHttpTest
{
    private string $authorization = '';

    protected function switchUserTest1(): string
    {
        return $this->authorization = env('TEST_TOKEN');
    }

    protected function switchUserTest2(): string
    {
        return $this->authorization = env('TEST2_TOKEN');
    }

    protected function getCommonHeaders(): array
    {
        return [
            'organization-code' => env('TEST_ORGANIZATION_CODE'),
            // 换成自己的
            'Authorization' => $this->authorization,
        ];
    }
}
