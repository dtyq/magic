<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Permission;

use App\Application\Permission\Service\OrganizationAdminAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Permission\Entity\OrganizationAdminEntity;
use App\Infrastructure\Core\ValueObject\Page;
use Exception;
use HyperfTest\HttpTestCase;

/**
 * @internal
 */
class OrganizationAdminAppServiceTest extends HttpTestCase
{
    private OrganizationAdminAppService $organizationAdminAppService;

    private string $testOrganizationCode = 'test_org_code';

    private string $testUserId;

    private string $testGrantorUserId = 'test_grantor_user_id';

    protected function setUp(): void
    {
        parent::setUp();
        $this->organizationAdminAppService = $this->getContainer()->get(OrganizationAdminAppService::class);

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

    public function testGrantOrganizationAdminPermission(): void
    {
        // 授予组织管理员权限
        $organizationAdmin = $this->organizationAdminAppService->grant(
            $this->createDataIsolation($this->testOrganizationCode),
            $this->testUserId,
            $this->testGrantorUserId,
            'Test grant'
        );

        $this->assertInstanceOf(OrganizationAdminEntity::class, $organizationAdmin);
        $this->assertEquals($this->testUserId, $organizationAdmin->getUserId());
        $this->assertEquals($this->testGrantorUserId, $organizationAdmin->getGrantorUserId());
        $this->assertEquals('Test grant', $organizationAdmin->getRemarks());
        $this->assertTrue($organizationAdmin->isEnabled());
    }

    public function testGetOrganizationAdminByUserId(): void
    {
        // 先授予权限
        $this->organizationAdminAppService->grant(
            $this->createDataIsolation($this->testOrganizationCode),
            $this->testUserId,
            $this->testGrantorUserId
        );

        // 根据用户ID获取组织管理员
        $organizationAdmin = $this->organizationAdminAppService->getByUserId(
            $this->createDataIsolation($this->testOrganizationCode),
            $this->testUserId
        );

        $this->assertNotNull($organizationAdmin);
        $this->assertEquals($this->testUserId, $organizationAdmin->getUserId());
    }

    public function testQueriesOrganizationAdminList(): void
    {
        // 先创建几个组织管理员
        $testUserIds = [];
        for ($i = 1; $i <= 3; ++$i) {
            $uniqueUserId = 'test_user_' . uniqid() . "_{$i}";
            $testUserIds[] = $uniqueUserId;
            $this->organizationAdminAppService->grant(
                $this->createDataIsolation($this->testOrganizationCode),
                $uniqueUserId,
                $this->testGrantorUserId
            );
        }

        // 查询组织管理员列表
        $page = new Page(1, 10);
        $result = $this->organizationAdminAppService->queries($this->createDataIsolation($this->testOrganizationCode), $page);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('total', $result);
        $this->assertArrayHasKey('list', $result);
        $this->assertGreaterThanOrEqual(3, $result['total']);
        $this->assertIsArray($result['list']);
    }

    public function testShowOrganizationAdminDetails(): void
    {
        // 先授予权限
        $organizationAdmin = $this->organizationAdminAppService->grant(
            $this->createDataIsolation($this->testOrganizationCode),
            $this->testUserId,
            $this->testGrantorUserId
        );

        // 获取详情
        $details = $this->organizationAdminAppService->show($this->createDataIsolation($this->testOrganizationCode), $organizationAdmin->getId());

        $this->assertIsArray($details);
        $this->assertArrayHasKey('organization_admin', $details);
        $this->assertArrayHasKey('user_info', $details);
        $this->assertArrayHasKey('grantor_info', $details);
        $this->assertArrayHasKey('department_info', $details);

        $organizationAdminData = $details['organization_admin'];
        $this->assertInstanceOf(OrganizationAdminEntity::class, $organizationAdminData);
        $this->assertEquals($this->testUserId, $organizationAdminData->getUserId());
    }

    public function testDestroyOrganizationAdmin(): void
    {
        // 先授予权限
        $organizationAdmin = $this->organizationAdminAppService->grant(
            $this->createDataIsolation($this->testOrganizationCode),
            $this->testUserId,
            $this->testGrantorUserId
        );

        $organizationAdminId = $organizationAdmin->getId();

        // 删除组织管理员
        $this->organizationAdminAppService->destroy($this->createDataIsolation($this->testOrganizationCode), $organizationAdminId);

        // 验证已删除
        $deletedOrganizationAdmin = $this->organizationAdminAppService->getByUserId(
            $this->createDataIsolation($this->testOrganizationCode),
            $this->testUserId
        );
        $this->assertNull($deletedOrganizationAdmin);
    }

    private function createDataIsolation(string $organizationCode): DataIsolation
    {
        return DataIsolation::simpleMake($organizationCode);
    }

    private function cleanUpTestData(): void
    {
        try {
            // 清理主测试用户
            if (isset($this->testUserId)) {
                $organizationAdmin = $this->organizationAdminAppService->getByUserId(
                    $this->createDataIsolation($this->testOrganizationCode),
                    $this->testUserId
                );
                if ($organizationAdmin) {
                    $this->organizationAdminAppService->destroy($this->createDataIsolation($this->testOrganizationCode), $organizationAdmin->getId());
                }
            }

            // 清理其他测试用户（使用模式匹配）
            for ($i = 1; $i <= 5; ++$i) {
                $testUserId = "test_user_{$i}";
                $organizationAdmin = $this->organizationAdminAppService->getByUserId(
                    $this->createDataIsolation($this->testOrganizationCode),
                    $testUserId
                );
                if ($organizationAdmin) {
                    $this->organizationAdminAppService->destroy($this->createDataIsolation($this->testOrganizationCode), $organizationAdmin->getId());
                }
            }
        } catch (Exception $e) {
            // 忽略清理错误
        }
    }
}
