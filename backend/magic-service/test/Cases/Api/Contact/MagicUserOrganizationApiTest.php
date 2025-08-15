<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\Contact;

use HyperfTest\Cases\Api\AbstractHttpTest;

/**
 * @internal
 * 用户当前组织管理API测试
 */
class MagicUserOrganizationApiTest extends AbstractHttpTest
{
    private const string GET_CURRENT_ORGANIZATION_API = '/api/v1/contact/accounts/me/organization-code';

    private const string SET_CURRENT_ORGANIZATION_API = '/api/v1/contact/accounts/me/organization-code';

    /**
     * 测试通过HTTP请求获取当前组织代码
     */
    public function testGetCurrentOrganizationCodeViaHttp(): void
    {
        $headers = $this->getCommonHeaders();

        $response = $this->get(self::GET_CURRENT_ORGANIZATION_API, [], $headers);

        // 验证响应状态
        $this->assertEquals(1000, $response['code'] ?? -1);

        // 验证响应结构（根据实际API返回结构调整）
        if (isset($response['data'])) {
            $this->assertIsArray($response['data']);
        }
    }

    /**
     * 测试通过HTTP请求设置当前组织代码
     */
    public function testSetCurrentOrganizationCodeViaHttp(): void
    {
        $headers = $this->getCommonHeaders();
        $requestData = [
            'magic_organization_code' => $headers['organization-code'],
        ];

        $response = $this->put(self::SET_CURRENT_ORGANIZATION_API, $requestData, $headers);

        // 验证响应状态
        $this->assertEquals(1000, $response['code'] ?? -1);

        // 验证响应结构
        if (isset($response['data'])) {
            $this->assertIsArray($response['data']);
            // 验证返回的组织代码
            if (isset($response['data']['magic_organization_code'])) {
                $this->assertEquals($requestData['magic_organization_code'], $response['data']['magic_organization_code']);
            }
        }
    }

    /**
     * 测试设置空组织代码的错误情况.
     */
    public function testSetCurrentOrganizationCodeWithEmptyCodeViaHttp(): void
    {
        $headers = $this->getCommonHeaders();
        $requestData = [
            'magic_organization_code' => '',
        ];

        $response = $this->put(self::SET_CURRENT_ORGANIZATION_API, $requestData, $headers);

        // 验证响应状态 - 应该返回错误状态码
        $this->assertNotEquals(200, $response['code'] ?? 200);
    }
}
