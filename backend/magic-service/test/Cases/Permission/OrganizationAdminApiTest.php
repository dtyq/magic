<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Permission;

use App\Application\Permission\Service\OrganizationAdminAppService;
use Exception;
use HyperfTest\HttpTestCase;

/**
 * @internal
 */
class OrganizationAdminApiTest extends HttpTestCase
{
    // 登录相关常量
    private const string LOGIN_API = '/api/v1/sessions';

    private const string TEST_PHONE = '13800138001';

    private const string TEST_PASSWORD = '123456';

    private const string TEST_STATE_CODE = '+86';

    private OrganizationAdminAppService $superAdminAppService;

    private string $testOrganizationCode = 'test001';

    private string $testUserId;

    private string $testGrantorUserId = 'test_grantor_user_id';

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
        // 先创建一个超级管理员
        $this->superAdminAppService->grant(
            $this->testOrganizationCode,
            $this->testUserId,
            $this->testGrantorUserId
        );

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
        $response = $this->post('/api/v1/admin/organization-admin/grant', [
            'user_id' => $this->testUserId,
            'remarks' => 'Test grant via API',
        ], $this->getTestHeaders());

        // 验证响应格式和状态
        $this->assertIsArray($response, '响应应该是数组格式');

        $this->assertEquals(1000, $response['code'] ?? 0, '响应码应为1000');
        $this->assertArrayHasKey('data', $response, '响应应包含data字段');

        $data = $response['data'];
        $this->assertIsArray($data);
        $this->assertEquals($this->testUserId, $data['user_id']);
        $this->assertNotEmpty($data['operation_time']);
    }

    public function testGetSuperAdminDetails(): void
    {
        // 先创建一个超级管理员
        $superAdmin = $this->superAdminAppService->grant(
            $this->testOrganizationCode,
            $this->testUserId,
            $this->testGrantorUserId
        );

        $response = $this->get("/api/v1/admin/organization-admin/{$superAdmin->getId()}", [], $this->getTestHeaders());

        // 验证响应格式和状态
        $this->assertIsArray($response, '响应应该是数组格式');

        $this->assertEquals(1000, $response['code'] ?? 0, '响应码应为1000');
        $this->assertArrayHasKey('data', $response, '响应应包含data字段');

        $data = $response['data'];
        $this->assertIsArray($data);
        $this->assertEquals($this->testUserId, $data['user_id']);
    }

    public function testEnableSuperAdmin(): void
    {
        // 先创建一个超级管理员
        $superAdmin = $this->superAdminAppService->grant(
            $this->testOrganizationCode,
            $this->testUserId,
            $this->testGrantorUserId
        );

        // 先禁用
        $this->superAdminAppService->disable($this->testOrganizationCode, $superAdmin->getId());

        // 通过API启用
        $response = $this->put("/api/v1/admin/organization-admin/{$superAdmin->getId()}/enable", [], $this->getTestHeaders());

        // 验证响应格式和状态
        $this->assertIsArray($response, '响应应该是数组格式');

        $this->assertEquals(1000, $response['code'] ?? 0, '响应码应为1000');
    }

    public function testDisableSuperAdmin(): void
    {
        // 先创建一个超级管理员
        $superAdmin = $this->superAdminAppService->grant(
            $this->testOrganizationCode,
            $this->testUserId,
            $this->testGrantorUserId
        );

        $response = $this->put("/api/v1/admin/organization-admin/{$superAdmin->getId()}/disable", [], $this->getTestHeaders());

        // 验证响应格式和状态
        $this->assertIsArray($response, '响应应该是数组格式');

        $this->assertEquals(1000, $response['code'] ?? 0, '响应码应为1000');
    }

    public function testDestroySuperAdmin(): void
    {
        // 先创建一个超级管理员
        $superAdmin = $this->superAdminAppService->grant(
            $this->testOrganizationCode,
            $this->testUserId,
            $this->testGrantorUserId
        );

        $response = $this->delete("/api/v1/admin/organization-admin/{$superAdmin->getId()}", [], $this->getTestHeaders());

        // 验证响应格式和状态
        $this->assertIsArray($response, '响应应该是数组格式');

        $this->assertEquals(1000, $response['code'] ?? 0, '响应码应为1000');

        // 验证已删除
        $deletedSuperAdmin = $this->superAdminAppService->getByUserId(
            $this->testOrganizationCode,
            $this->testUserId
        );
        $this->assertNull($deletedSuperAdmin);
    }

    private function cleanUpTestData(): void
    {
        try {
            // 清理主测试用户
            if (isset($this->testUserId)) {
                $superAdmin = $this->superAdminAppService->getByUserId(
                    $this->testOrganizationCode,
                    $this->testUserId
                );
                if ($superAdmin) {
                    $this->superAdminAppService->destroy($this->testOrganizationCode, $superAdmin->getId());
                }
            }
        } catch (Exception $e) {
            // 忽略清理错误
        }
    }

    /**
     * 执行用户登录并返回access token.
     */
    private function performLogin(): string
    {
        // 如果已经有token，直接返回
        if (! empty(self::$accessToken)) {
            return self::$accessToken;
        }

        $loginData = [
            'state_code' => self::TEST_STATE_CODE,
            'phone' => self::TEST_PHONE,
            'password' => self::TEST_PASSWORD,
            'type' => 'phone_password',
        ];

        $loginResponse = $this->json(self::LOGIN_API, $loginData, [
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ]);

        // 验证登录是否成功
        $this->assertIsArray($loginResponse, '登录响应应该是数组格式');
        $this->assertEquals(1000, $loginResponse['code'] ?? 0, '登录应该成功');
        $this->assertArrayHasKey('data', $loginResponse, '登录响应应包含data字段');
        $this->assertArrayHasKey('access_token', $loginResponse['data'], '登录响应应包含access_token');

        // 缓存token
        self::$accessToken = $loginResponse['data']['access_token'];

        // 输出调试信息
        echo "\n登录成功，获得token: " . self::$accessToken . "\n";

        return self::$accessToken;
    }

    /**
     * 获取测试用的请求头.
     */
    private function getTestHeaders(): array
    {
        $token = $this->performLogin();

        return [
            'Authorization' => $token,
            'organization-code' => $this->testOrganizationCode,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];
    }
}
