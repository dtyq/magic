<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Permission;

use App\Domain\Permission\Entity\OrganizationAdminEntity;
use App\Domain\Permission\Service\OrganizationAdminDomainService;
use Exception;
use HyperfTest\HttpTestCase;

/**
 * @internal
 */
class OrganizationAdminDomainServiceTest extends HttpTestCase
{
    private OrganizationAdminDomainService $organizationAdminDomainService;

    private string $testOrganizationCode = 'test_domain_org_code';

    private string $anotherOrganizationCode = 'another_org_code';

    private array $testUserIds = [];

    private string $testGrantorUserId = 'test_grantor_domain_user_id';

    protected function setUp(): void
    {
        parent::setUp();
        $this->organizationAdminDomainService = $this->getContainer()->get(OrganizationAdminDomainService::class);

        // 为每个测试生成唯一的用户ID，避免测试之间的数据冲突
        $this->testUserIds = [
            'test_domain_user_' . uniqid(),
            'test_domain_user_' . uniqid(),
            'test_domain_user_' . uniqid(),
        ];

        // 清理可能存在的测试数据
        $this->cleanUpTestData();
    }

    protected function tearDown(): void
    {
        // 清理测试数据
        $this->cleanUpTestData();

        parent::tearDown();
    }

    public function testGetAllOrganizationAdminsWithNoAdminsReturnsEmptyArray(): void
    {
        // 确保没有组织管理员数据
        $this->cleanUpTestData();

        // 调用方法
        $result = $this->organizationAdminDomainService->getAllOrganizationAdmins($this->testOrganizationCode);

        // 验证结果
        $this->assertIsArray($result);
        $this->assertEmpty($result);
    }

    public function testGetAllOrganizationAdminsWithSingleAdminReturnsOneEntity(): void
    {
        // 创建一个组织管理员
        $organizationAdmin = $this->organizationAdminDomainService->grant(
            $this->testOrganizationCode,
            $this->testUserIds[0],
            $this->testGrantorUserId,
            'Test single admin'
        );

        // 调用方法
        $result = $this->organizationAdminDomainService->getAllOrganizationAdmins($this->testOrganizationCode);

        // 验证结果
        $this->assertIsArray($result);
        $this->assertCount(1, $result);
        $this->assertInstanceOf(OrganizationAdminEntity::class, $result[0]);
        $this->assertEquals($this->testUserIds[0], $result[0]->getUserId());
        $this->assertEquals($this->testOrganizationCode, $result[0]->getOrganizationCode());
        $this->assertEquals($this->testGrantorUserId, $result[0]->getGrantorUserId());
        $this->assertEquals('Test single admin', $result[0]->getRemarks());
        $this->assertTrue($result[0]->isEnabled());
    }

    public function testGetAllOrganizationAdminsWithMultipleAdminsReturnsAllEntities(): void
    {
        // 创建多个组织管理员
        $admins = [];
        foreach ($this->testUserIds as $index => $userId) {
            $admins[] = $this->organizationAdminDomainService->grant(
                $this->testOrganizationCode,
                $userId,
                $this->testGrantorUserId,
                "Test admin #{$index}"
            );
        }

        // 调用方法
        $result = $this->organizationAdminDomainService->getAllOrganizationAdmins($this->testOrganizationCode);

        // 验证结果
        $this->assertIsArray($result);
        $this->assertCount(3, $result);

        // 验证每个返回的实体
        $userIds = array_map(fn ($entity) => $entity->getUserId(), $result);
        foreach ($this->testUserIds as $testUserId) {
            $this->assertContains($testUserId, $userIds);
        }

        // 验证所有实体都是正确的类型和组织代码
        foreach ($result as $entity) {
            $this->assertInstanceOf(OrganizationAdminEntity::class, $entity);
            $this->assertEquals($this->testOrganizationCode, $entity->getOrganizationCode());
            $this->assertEquals($this->testGrantorUserId, $entity->getGrantorUserId());
            $this->assertTrue($entity->isEnabled());
        }
    }

    public function testGetAllOrganizationAdminsOnlyReturnsAdminsFromSpecificOrganization(): void
    {
        // 在测试组织中创建管理员
        $testOrgAdmin = $this->organizationAdminDomainService->grant(
            $this->testOrganizationCode,
            $this->testUserIds[0],
            $this->testGrantorUserId,
            'Test org admin'
        );

        // 在另一个组织中创建管理员
        $anotherOrgAdmin = $this->organizationAdminDomainService->grant(
            $this->anotherOrganizationCode,
            $this->testUserIds[1],
            $this->testGrantorUserId,
            'Another org admin'
        );

        // 调用方法获取测试组织的管理员
        $testOrgResult = $this->organizationAdminDomainService->getAllOrganizationAdmins($this->testOrganizationCode);

        // 验证只返回测试组织的管理员
        $this->assertIsArray($testOrgResult);
        $this->assertCount(1, $testOrgResult);
        $this->assertEquals($this->testUserIds[0], $testOrgResult[0]->getUserId());
        $this->assertEquals($this->testOrganizationCode, $testOrgResult[0]->getOrganizationCode());

        // 调用方法获取另一个组织的管理员
        $anotherOrgResult = $this->organizationAdminDomainService->getAllOrganizationAdmins($this->anotherOrganizationCode);

        // 验证只返回另一个组织的管理员
        $this->assertIsArray($anotherOrgResult);
        $this->assertCount(1, $anotherOrgResult);
        $this->assertEquals($this->testUserIds[1], $anotherOrgResult[0]->getUserId());
        $this->assertEquals($this->anotherOrganizationCode, $anotherOrgResult[0]->getOrganizationCode());
    }

    public function testGetAllOrganizationAdminsIncludesDisabledAdmins(): void
    {
        // 创建启用的管理员
        $enabledAdmin = $this->organizationAdminDomainService->grant(
            $this->testOrganizationCode,
            $this->testUserIds[0],
            $this->testGrantorUserId,
            'Enabled admin'
        );

        // 创建另一个管理员并禁用
        $disabledAdmin = $this->organizationAdminDomainService->grant(
            $this->testOrganizationCode,
            $this->testUserIds[1],
            $this->testGrantorUserId,
            'Disabled admin'
        );
        $this->organizationAdminDomainService->disable($this->testOrganizationCode, $disabledAdmin->getId());

        // 调用方法
        $result = $this->organizationAdminDomainService->getAllOrganizationAdmins($this->testOrganizationCode);

        // 验证结果包含启用和禁用的管理员
        $this->assertIsArray($result);
        $this->assertCount(2, $result);

        $userIds = array_map(fn ($entity) => $entity->getUserId(), $result);
        $this->assertContains($this->testUserIds[0], $userIds);
        $this->assertContains($this->testUserIds[1], $userIds);

        // 验证状态
        foreach ($result as $entity) {
            if ($entity->getUserId() === $this->testUserIds[0]) {
                $this->assertTrue($entity->isEnabled(), 'First admin should be enabled');
            } elseif ($entity->getUserId() === $this->testUserIds[1]) {
                $this->assertFalse($entity->isEnabled(), 'Second admin should be disabled');
            }
        }
    }

    public function testGetAllOrganizationAdminsWithEmptyOrganizationCodeReturnsEmptyArray(): void
    {
        // 创建一些管理员
        $this->organizationAdminDomainService->grant(
            $this->testOrganizationCode,
            $this->testUserIds[0],
            $this->testGrantorUserId
        );

        // 使用空的组织代码调用方法
        $result = $this->organizationAdminDomainService->getAllOrganizationAdmins('');

        // 验证结果为空
        $this->assertIsArray($result);
        $this->assertEmpty($result);
    }

    public function testGetAllOrganizationAdminsWithNonExistentOrganizationCodeReturnsEmptyArray(): void
    {
        // 创建一些管理员
        $this->organizationAdminDomainService->grant(
            $this->testOrganizationCode,
            $this->testUserIds[0],
            $this->testGrantorUserId
        );

        // 使用不存在的组织代码调用方法
        $result = $this->organizationAdminDomainService->getAllOrganizationAdmins('non_existent_org_code');

        // 验证结果为空
        $this->assertIsArray($result);
        $this->assertEmpty($result);
    }

    public function testGetAllOrganizationAdminsReturnsEntitiesWithAllRequiredFields(): void
    {
        // 创建一个组织管理员
        $organizationAdmin = $this->organizationAdminDomainService->grant(
            $this->testOrganizationCode,
            $this->testUserIds[0],
            $this->testGrantorUserId,
            'Test complete data'
        );

        // 调用方法
        $result = $this->organizationAdminDomainService->getAllOrganizationAdmins($this->testOrganizationCode);

        // 验证返回的实体包含所有必要字段
        $this->assertCount(1, $result);
        $entity = $result[0];

        $this->assertNotNull($entity->getId());
        $this->assertNotNull($entity->getUserId());
        $this->assertNotNull($entity->getOrganizationCode());
        $this->assertNotNull($entity->getGrantorUserId());
        $this->assertNotNull($entity->getGrantedAt());
        $this->assertNotNull($entity->getCreatedAt());
        $this->assertNotNull($entity->getUpdatedAt());
        $this->assertIsInt($entity->getStatus());
        $this->assertEquals('Test complete data', $entity->getRemarks());
    }

    private function cleanUpTestData(): void
    {
        try {
            // 清理测试组织的数据
            $this->cleanUpOrganizationAdmins($this->testOrganizationCode);

            // 清理另一个组织的数据
            $this->cleanUpOrganizationAdmins($this->anotherOrganizationCode);
        } catch (Exception $e) {
            // 忽略清理错误
        }
    }

    private function cleanUpOrganizationAdmins(string $organizationCode): void
    {
        try {
            // 获取所有管理员并删除
            $allAdmins = $this->organizationAdminDomainService->getAllOrganizationAdmins($organizationCode);
            foreach ($allAdmins as $admin) {
                $this->organizationAdminDomainService->destroy($organizationCode, $admin);
            }

            // 清理特定测试用户ID
            foreach ($this->testUserIds as $userId) {
                $organizationAdmin = $this->organizationAdminDomainService->getByUserId($organizationCode, $userId);
                if ($organizationAdmin) {
                    $this->organizationAdminDomainService->destroy($organizationCode, $organizationAdmin);
                }
            }
        } catch (Exception $e) {
            // 忽略清理错误
        }
    }
}
