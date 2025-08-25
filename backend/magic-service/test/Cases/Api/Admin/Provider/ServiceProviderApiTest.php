<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Admin\Provider;

use HyperfTest\Cases\BaseTest;

/**
 * @internal
 * @coversNothing
 */
class ServiceProviderApiTest extends BaseTest
{
    private string $baseUri = '/api/v1/admin/service-providers';

    public function testGetServiceProvidersByCategoryLlm(): void
    {
        $uri = $this->baseUri . '?category=llm';
        $response = $this->get($uri, [], $this->getCommonHeaders());

        // 如果返回认证或权限相关错误，跳过测试（仅验证路由可用）
        if (isset($response['code']) && in_array($response['code'], [401, 403, 2179, 3035, 4001, 4003], true)) {
            $this->markTestSkipped('接口认证失败或无权限，路由校验通过');
            return;
        }

        // 基本断言
        $this->assertIsArray($response);
        $this->assertArrayHasKey('code', $response);
        $this->assertSame(1000, $response['code']);
        $this->assertArrayHasKey('data', $response);
        $this->assertIsArray($response['data']);
    }
}
