<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Permission;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Kernel\MagicPermission;
use App\Application\Permission\Service\RoleAppService;
use App\Domain\Permission\Entity\RoleEntity;
use App\Domain\Permission\Entity\ValueObject\PermissionDataIsolation;
use App\Infrastructure\Core\ValueObject\Page;
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

        $magicPermission = new MagicPermission();
        // 添加测试权限数据
        $testPermissions = [
            $magicPermission->buildPermission(MagicResourceEnum::ADMIN_AI_MODEL->value, MagicOperationEnum::EDIT->value),
            $magicPermission->buildPermission(MagicResourceEnum::ADMIN_AI_IMAGE->value, MagicOperationEnum::QUERY->value),
        ];
        $roleEntity->setPermissions($testPermissions);

        // 添加测试用户ID数据
        $testUserIds = [
            'test_user_001',
            'test_user_002',
            'test_user_003',
        ];
        $roleEntity->setUserIds($testUserIds);

        // 保存角色
        $savedRole = $this->roleAppService->createRole($this->dataIsolation, $roleEntity);

        $this->assertNotNull($savedRole);
        $this->assertIsInt($savedRole->getId());
        $this->assertEquals($uniqueName, $savedRole->getName());

        // 验证权限数据被正确保存
        $this->assertEquals($testPermissions, $savedRole->getPermissions());
        $this->assertCount(2, $savedRole->getPermissions());

        // 验证用户ID数据被正确保存
        $this->assertEquals($testUserIds, $savedRole->getUserIds());
        $this->assertCount(3, $savedRole->getUserIds());

        // 验证权限方法
        $this->assertTrue($savedRole->hasPermission($testPermissions[0]));
        $this->assertTrue($savedRole->hasPermission($testPermissions[1]));

        // 验证用户方法
        $this->assertTrue($savedRole->hasUser('test_user_001'));
        $this->assertTrue($savedRole->hasUser('test_user_002'));
        $this->assertFalse($savedRole->hasUser('nonexistent_user'));

        // 通过ID查询角色
        $foundRole = $this->roleAppService->show($this->dataIsolation, $savedRole->getId());
        $this->assertEquals($savedRole->getId(), $foundRole->getId());
        $this->assertEquals($savedRole->getName(), $foundRole->getName());

        // 验证查询到的角色包含正确的权限和用户数据
        $this->assertEquals($testPermissions, $foundRole->getPermissions());
        $this->assertEquals($testUserIds, $foundRole->getUserIds());

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
            $roles[] = $this->roleAppService->createRole($this->dataIsolation, $roleEntity);
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

        $savedRole = $this->roleAppService->createRole($this->dataIsolation, $roleEntity);

        // 更新角色
        $updatedName = 'Updated Role ' . uniqid();
        $savedRole->setName($updatedName);

        $updatedRole = $this->roleAppService->updateRole($this->dataIsolation, $savedRole);

        $this->assertEquals($updatedName, $updatedRole->getName());

        // 验证数据库中的数据也被更新
        $foundRole = $this->roleAppService->show($this->dataIsolation, $updatedRole->getId());
        $this->assertEquals($updatedName, $foundRole->getName());

        // 清理测试数据
        $this->roleAppService->destroy($this->dataIsolation, $updatedRole->getId());
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
}
