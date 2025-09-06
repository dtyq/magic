<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Permission;

use App\Application\Permission\Service\OrganizationAdminAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use HyperfTest\HttpTestCase;

/**
 * @internal
 */
class OrganizationAdminApiTest extends HttpTestCase
{
    private OrganizationAdminAppService $superAdminAppService;

    private string $testOrganizationCode = 'test001';

    private string $testUserId;

    /**
     * 存储登录后的token.
     */
    private static string $accessToken = '';

    protected function setUp(): void
    {
        parent::setUp();
        $this->superAdminAppService = $this->getContainer()->get(OrganizationAdminAppService::class);

        // 为每个测试生成唯一的用户ID，避免测试之间的数据冲突
        $this->testUserId = 'test_user_' . uniqid();

        // 清理可能存在的测试数据
        $this->cleanUpTestData();
    }

    protected function tearDown(): void
    {
        // 清理测试数据
        $this->cleanUpTestData();

        parent::tearDown();
    }

    public function testGetSuperAdminList(): void
    {
        // 模拟HTTP请求获取列表
        $response = $this->get('/api/v1/admin/organization-admin/list?page=1&page_size=10', [], $this->getTestHeaders());

        // 验证响应格式和状态
        $this->assertIsArray($response, '响应应该是数组格式');

        $this->assertEquals(1000, $response['code'] ?? 0, '响应码应为1000');
        $this->assertArrayHasKey('data', $response, '响应应包含data字段');

        $data = $response['data'];
        $this->assertIsArray($data);
        $this->assertArrayHasKey('list', $data);
        $this->assertIsArray($data['list']);
    }

    public function testGrantSuperAdminPermission(): void
    {
        $userId = 'usi_71f7b56bec00b0cd9f9daba18caa7a4c';
        $response = $this->post('/api/v1/admin/organization-admin/grant', [
            'user_id' => $userId,
            'remarks' => 'Test grant via API',
        ], $this->getTestHeaders());

        $this->assertEquals(1000, $response['code'] ?? 0, '响应码不为1000');
    }

    private function createDataIsolation(string $organizationCode): DataIsolation
    {
        return DataIsolation::simpleMake($organizationCode);
    }

    private function cleanUpTestData(): void
    {
    }

    /**
     * 获取测试用的请求头.
     */
    private function getTestHeaders(): array
    {
        return [
            'Authorization' => env('TEST_TOKEN'),
            'organization-code' => env('TEST_ORGANIZATION_CODE'),
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];
    }
}
