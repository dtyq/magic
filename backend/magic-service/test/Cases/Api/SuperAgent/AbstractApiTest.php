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

    private string $userId = '';

    protected function switchUserTest1(): string
    {
        $this->userId = env('TEST1_USER_ID');
        $this->authorization = env('TEST1_TOKEN');
        return '';
    }

    protected function switchUserTest2(): string
    {
        $this->userId = env('TEST2_USER_ID');
        $this->authorization = env('TEST2_TOKEN');
        return '';
    }

    protected function getCommonHeaders(): array
    {
        return [
            'organization-code' => env('TEST_ORGANIZATION_CODE'),
            // 换成自己的
            'Authorization' => $this->authorization,
            'user-id' => $this->userId,
            'language' => 'en_US',
            'api-key' => env('TEST_API_KEY'),
        ];
    }
}
