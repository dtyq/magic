<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Permission;

use App\Application\Permission\Service\RoleAppService;
use App\Domain\Permission\Entity\RoleEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Infrastructure\Core\ValueObject\Page;
use Exception;
use Hyperf\Context\ApplicationContext;
use HyperfTest\HttpTestCase;

/**
 * @internal
 */
class RoleAppServiceTest extends HttpTestCase
{
    private RoleAppService $roleAppService;

    private PermissionDataIsolation $dataIsolation;

    protected function setUp(): void
    {
        parent::setUp();

        // 使用真实的依赖注入容器获取服务
        $this->roleAppService = ApplicationContext::getContainer()->get(RoleAppService::class);
        $this->dataIsolation = PermissionDataIsolation::create('TEST_ORG', 'test_user_123');
    }

    public function testCreateAndQueryRole()
    {
        // 创建测试角色，使用时间戳确保唯一性
        $uniqueName = 'Test Admin Role ' . time() . '_' . rand(1000, 9999);
        $roleEntity = new RoleEntity();
        $roleEntity->setName($uniqueName);
        $roleEntity->setOrganizationCode($this->dataIsolation->getCurrentOrganizationCode());
        $roleEntity->setStatus(1);

        // 保存角色
        $savedRole = $this->roleAppService->save($this->dataIsolation, $roleEntity);

        $this->assertNotNull($savedRole);
        $this->assertIsInt($savedRole->getId());
        $this->assertEquals($uniqueName, $savedRole->getName());

        // 通过ID查询角色
        $foundRole = $this->roleAppService->show($this->dataIsolation, $savedRole->getId());
        $this->assertEquals($savedRole->getId(), $foundRole->getId());
        $this->assertEquals($savedRole->getName(), $foundRole->getName());

        // 通过名称查询角色
        $foundByName = $this->roleAppService->getByName($this->dataIsolation, $uniqueName);
        $this->assertNotNull($foundByName);
        $this->assertEquals($savedRole->getId(), $foundByName->getId());

        // 清理测试数据
        $this->roleAppService->destroy($this->dataIsolation, $savedRole->getId());

        return $savedRole;
    }

    public function testQueriesWithPagination()
    {
        // 先创建几个测试角色
        $roles = [];
        for ($i = 1; $i <= 3; ++$i) {
            $roleEntity = new RoleEntity();
            $roleEntity->setName("Test Role {$i} " . uniqid());
            $roleEntity->setOrganizationCode($this->dataIsolation->getCurrentOrganizationCode());
            $roleEntity->setStatus(1);
            $roles[] = $this->roleAppService->save($this->dataIsolation, $roleEntity);
        }

        // 测试分页查询
        $page = new Page(1, 2);
        $result = $this->roleAppService->queries($this->dataIsolation, $page);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('total', $result);
        $this->assertArrayHasKey('list', $result);
        $this->assertGreaterThanOrEqual(3, $result['total']);
        $this->assertLessThanOrEqual(2, count($result['list']));

        // 清理测试数据
        foreach ($roles as $role) {
            $this->roleAppService->destroy($this->dataIsolation, $role->getId());
        }
    }

    public function testUpdateRole()
    {
        // 创建角色
        $roleEntity = new RoleEntity();
        $roleEntity->setName('Original Role ' . uniqid());
        $roleEntity->setOrganizationCode($this->dataIsolation->getCurrentOrganizationCode());
        $roleEntity->setStatus(1);

        $savedRole = $this->roleAppService->save($this->dataIsolation, $roleEntity);

        // 更新角色
        $updatedName = 'Updated Role ' . uniqid();
        $savedRole->setName($updatedName);

        $updatedRole = $this->roleAppService->save($this->dataIsolation, $savedRole);

        $this->assertEquals($updatedName, $updatedRole->getName());

        // 验证数据库中的数据也被更新
        $foundRole = $this->roleAppService->show($this->dataIsolation, $updatedRole->getId());
        $this->assertEquals($updatedName, $foundRole->getName());

        // 清理测试数据
        $this->roleAppService->destroy($this->dataIsolation, $updatedRole->getId());
    }

    public function testRolePermissionManagement()
    {
        // 创建测试角色
        $roleEntity = new RoleEntity();
        $roleEntity->setName('Permission Test Role ' . uniqid());
        $roleEntity->setOrganizationCode($this->dataIsolation->getCurrentOrganizationCode());
        $roleEntity->setStatus(1);

        $savedRole = $this->roleAppService->save($this->dataIsolation, $roleEntity);

        // 分配权限
        $permissionKeys = [
            'Admin.ai.model_management.query',
            'Admin.ai.model_management.edit',
        ];

        $this->roleAppService->assignPermissions(
            $this->dataIsolation,
            $savedRole->getId(),
            $permissionKeys,
            'test_admin'
        );

        // 获取角色权限
        $rolePermissions = $this->roleAppService->getRolePermissions($this->dataIsolation, $savedRole->getId());

        $this->assertIsArray($rolePermissions);
        foreach ($permissionKeys as $permission) {
            $this->assertContains($permission, $rolePermissions);
        }

        // 移除部分权限
        $this->roleAppService->removePermissions(
            $this->dataIsolation,
            $savedRole->getId(),
            ['Admin.ai.model_management.edit']
        );

        // 验证权限被移除
        $updatedPermissions = $this->roleAppService->getRolePermissions($this->dataIsolation, $savedRole->getId());
        $this->assertContains('Admin.ai.model_management.query', $updatedPermissions);
        $this->assertNotContains('Admin.ai.model_management.edit', $updatedPermissions);

        // 清理测试数据
        $this->roleAppService->destroy($this->dataIsolation, $savedRole->getId());
    }

    public function testRoleUserManagement()
    {
        // 创建测试角色
        $roleEntity = new RoleEntity();
        $roleEntity->setName('User Test Role ' . uniqid());
        $roleEntity->setOrganizationCode($this->dataIsolation->getCurrentOrganizationCode());
        $roleEntity->setStatus(1);

        $savedRole = $this->roleAppService->save($this->dataIsolation, $roleEntity);

        // 分配用户到角色
        $userIds = ['test_user_1', 'test_user_2'];

        $this->roleAppService->assignUsers(
            $this->dataIsolation,
            $savedRole->getId(),
            $userIds,
            'test_admin'
        );

        // 获取角色用户
        $roleUsers = $this->roleAppService->getRoleUsers($this->dataIsolation, $savedRole->getId());

        $this->assertIsArray($roleUsers);
        $this->assertGreaterThanOrEqual(2, count($roleUsers));

        // 移除部分用户
        $this->roleAppService->removeUsers(
            $this->dataIsolation,
            $savedRole->getId(),
            ['test_user_2']
        );

        // 验证用户被移除
        $updatedUsers = $this->roleAppService->getRoleUsers($this->dataIsolation, $savedRole->getId());
        $this->assertLessThan(count($roleUsers), count($updatedUsers));

        // 移除剩余用户
        $this->roleAppService->removeUsers(
            $this->dataIsolation,
            $savedRole->getId(),
            $updatedUsers
        );

        // 清理测试数据
        $this->roleAppService->destroy($this->dataIsolation, $savedRole->getId());
    }

    public function testUserPermissionCheck()
    {
        // 创建测试角色
        $roleEntity = new RoleEntity();
        $roleEntity->setName('Permission Check Role ' . uniqid());
        $roleEntity->setOrganizationCode($this->dataIsolation->getCurrentOrganizationCode());
        $roleEntity->setStatus(1);

        $savedRole = $this->roleAppService->save($this->dataIsolation, $roleEntity);

        // 分配权限和用户
        $permissionKeys = ['Admin.ai.model_management.query', 'Admin.ai.image_generation.query'];
        $userId = 'permission_test_user';

        $this->roleAppService->assignPermissions($this->dataIsolation, $savedRole->getId(), $permissionKeys);
        $this->roleAppService->assignUsers($this->dataIsolation, $savedRole->getId(), [$userId]);

        // 检查用户权限
        $hasPermission = $this->roleAppService->hasPermission(
            $this->dataIsolation,
            $userId,
            'Admin.ai.model_management.query'
        );
        $this->assertTrue($hasPermission);

        $hasNoPermission = $this->roleAppService->hasPermission(
            $this->dataIsolation,
            $userId,
            'Admin.ai.model_management.edit'
        );
        $this->assertFalse($hasNoPermission);

        // 批量检查权限
        $checkPermissions = [
            'Admin.ai.model_management.query',
            'Admin.ai.model_management.edit',
            'Admin.ai.image_generation.query',
        ];

        $permissionResults = $this->roleAppService->hasPermissions(
            $this->dataIsolation,
            $userId,
            $checkPermissions
        );

        $this->assertIsArray($permissionResults);
        $this->assertTrue($permissionResults['Admin.ai.model_management.query']);
        $this->assertFalse($permissionResults['Admin.ai.model_management.edit']);
        $this->assertTrue($permissionResults['Admin.ai.image_generation.query']);

        // 获取用户所有权限
        $userPermissions = $this->roleAppService->getUserPermissions($this->dataIsolation, $userId);
        $this->assertIsArray($userPermissions);
        $this->assertContains('Admin.ai.model_management.query', $userPermissions);

        // 获取用户角色
        $userRoles = $this->roleAppService->getUserRoles($this->dataIsolation, $userId);
        $this->assertIsArray($userRoles);
        $this->assertGreaterThanOrEqual(1, count($userRoles));

        // 移除关联用户，便于删除角色
        $this->roleAppService->removeUsers(
            $this->dataIsolation,
            $savedRole->getId(),
            [$userId]
        );

        // 清理测试数据
        $this->roleAppService->destroy($this->dataIsolation, $savedRole->getId());
    }

    public function testGetPermissionTree()
    {
        $permissionTree = $this->roleAppService->getPermissionTree();

        $this->assertIsArray($permissionTree);
        $this->assertNotEmpty($permissionTree);

        // 验证树结构
        foreach ($permissionTree as $platform) {
            $this->assertArrayHasKey('permission_key', $platform);
            $this->assertArrayHasKey('label', $platform);
            $this->assertArrayHasKey('children', $platform);
        }
    }

    public function testGetByNameReturnsNull()
    {
        $result = $this->roleAppService->getByName($this->dataIsolation, 'NonExistentRole');
        $this->assertNull($result);
    }

    public function testDataIsolation()
    {
        // 测试不同组织的数据隔离
        $dataIsolation1 = PermissionDataIsolation::create('ORG_1', 'user1');
        $dataIsolation2 = PermissionDataIsolation::create('ORG_2', 'user2');

        // 在组织1中创建角色
        $roleEntity1 = new RoleEntity();
        $roleEntity1->setName('Isolated Role 1');
        $roleEntity1->setOrganizationCode($dataIsolation1->getCurrentOrganizationCode());
        $roleEntity1->setStatus(1);

        $savedRole1 = $this->roleAppService->save($dataIsolation1, $roleEntity1);

        // 在组织2中尝试查找组织1的角色
        $foundRole = $this->roleAppService->getByName($dataIsolation2, 'Isolated Role 1');
        $this->assertNull($foundRole); // 应该找不到，因为数据隔离

        // 在组织1中应该能找到
        $foundRole1 = $this->roleAppService->getByName($dataIsolation1, 'Isolated Role 1');
        $this->assertNotNull($foundRole1);
        $this->assertEquals($savedRole1->getId(), $foundRole1->getId());

        // 清理测试数据
        $this->roleAppService->destroy($dataIsolation1, $savedRole1->getId());
    }

    public function testEmptyArrayParameters()
    {
        // 创建测试角色
        $roleEntity = new RoleEntity();
        $roleEntity->setName('Empty Array Test ' . uniqid());
        $roleEntity->setOrganizationCode($this->dataIsolation->getCurrentOrganizationCode());
        $roleEntity->setStatus(1);

        $savedRole = $this->roleAppService->save($this->dataIsolation, $roleEntity);

        // 测试空权限数组
        $this->roleAppService->assignPermissions($this->dataIsolation, $savedRole->getId(), []);
        $permissions = $this->roleAppService->getRolePermissions($this->dataIsolation, $savedRole->getId());
        $this->assertIsArray($permissions);

        // 测试空用户数组 - 这可能会抛出异常，取决于业务逻辑
        try {
            $this->roleAppService->assignUsers($this->dataIsolation, $savedRole->getId(), []);
            $users = $this->roleAppService->getRoleUsers($this->dataIsolation, $savedRole->getId());
            $this->assertIsArray($users);
        } catch (Exception $e) {
            // 如果业务逻辑不允许空用户数组，这是预期的行为
            $this->assertStringContainsString('empty', $e->getMessage());
        }

        // 清理测试数据
        $this->roleAppService->destroy($this->dataIsolation, $savedRole->getId());
    }
}
