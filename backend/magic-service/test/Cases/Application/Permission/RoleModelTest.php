<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Permission;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Kernel\MagicPermission;
use App\Domain\Permission\Entity\RoleEntity;
use App\Domain\Permission\Repository\Persistence\Model\RoleModel;
use App\Domain\Permission\Repository\Persistence\Model\RoleUserModel;
use App\Infrastructure\Util\Permission\Repository\RoleRepository;
use Carbon\Carbon;
use HyperfTest\HttpTestCase;

/**
 * 角色模型测试.
 * @internal
 */
class RoleModelTest extends HttpTestCase
{
    private string $organizationCode = 'TEST_ORG';

    protected function setUp(): void
    {
        parent::setUp();

        // 清理测试数据
        $this->clearTestData();
    }

    protected function tearDown(): void
    {
        // 清理测试数据
        $this->clearTestData();

        parent::tearDown();
    }

    public function testRoleModelBasicOperations(): void
    {
        // 测试创建角色
        $roleData = [
            'name' => 'Test Role',
            'permission_key' => ['read', 'write'],
            'organization_code' => $this->organizationCode,
            'permission_tag' => ['tag1', 'tag2'],
            'status' => RoleModel::STATUS_ENABLED,
            'created_uid' => 'test_user',
            'updated_uid' => 'test_user',
        ];

        $role = RoleModel::create($roleData);

        $this->assertNotNull($role->id);
        $this->assertEquals('Test Role', $role->name);
        $this->assertEquals(['read', 'write'], $role->getPermissions());
        $this->assertEquals(['tag1', 'tag2'], $role->getPermissionTag());
        $this->assertTrue($role->isEnabled());

        // 测试查询
        $foundRole = RoleModel::query()->where('organization_code', $this->organizationCode)
            ->where('name', 'Test Role')
            ->first();

        $this->assertNotNull($foundRole);
        $this->assertEquals($role->id, $foundRole->id);

        // 测试更新
        $foundRole->setPermissions(['read', 'write', 'delete']);
        $foundRole->save();

        $updatedRole = RoleModel::find($foundRole->id);
        $this->assertEquals(['read', 'write', 'delete'], $updatedRole->getPermissions());

        // 测试软删除
        $foundRole->delete();

        $deletedRole = RoleModel::find($foundRole->id);
        $this->assertNull($deletedRole);

        $withTrashedRole = RoleModel::withTrashed()->find($foundRole->id);
        $this->assertNotNull($withTrashedRole);
    }

    public function testRoleModelScopes(): void
    {
        // 创建测试数据
        $enabledRole = RoleModel::create([
            'name' => 'Enabled Role',
            'permission_key' => ['read'],
            'organization_code' => $this->organizationCode,
            'status' => RoleModel::STATUS_ENABLED,
            'created_uid' => 'test_user',
        ]);

        $disabledRole = RoleModel::create([
            'name' => 'Disabled Role',
            'permission_key' => ['read'],
            'organization_code' => $this->organizationCode,
            'status' => RoleModel::STATUS_DISABLED,
            'created_uid' => 'test_user',
        ]);

        // 测试 enabled scope
        $enabledRoles = RoleModel::query()->where('organization_code', $this->organizationCode)
            ->where('status', RoleModel::STATUS_ENABLED)
            ->get();

        $this->assertCount(1, $enabledRoles);
        $this->assertEquals($enabledRole->id, $enabledRoles->first()->id);

        // 测试 byStatus scope
        $disabledRoles = RoleModel::query()->where('organization_code', $this->organizationCode)
            ->where('status', RoleModel::STATUS_DISABLED)
            ->get();

        $this->assertCount(1, $disabledRoles);
        $this->assertEquals($disabledRole->id, $disabledRoles->first()->id);

        // 测试 byName scope
        $searchRoles = RoleModel::query()->where('organization_code', $this->organizationCode)
            ->where('name', 'like', '%Enabled%')
            ->get();

        $this->assertCount(1, $searchRoles);
        $this->assertEquals($enabledRole->id, $searchRoles->first()->id);
    }

    public function testRoleUserModel(): void
    {
        // 创建角色
        $role = RoleModel::create([
            'name' => 'Test Role',
            'permission_key' => ['read', 'write'],
            'organization_code' => $this->organizationCode,
            'status' => RoleModel::STATUS_ENABLED,
            'created_uid' => 'test_user',
        ]);

        // 创建角色用户关联
        $roleUser = RoleUserModel::create([
            'role_id' => $role->id,
            'user_id' => 'test_user_id',
            'organization_code' => $this->organizationCode,
            'assigned_by' => 'admin_user',
            'assigned_at' => Carbon::now(),
        ]);

        $this->assertNotNull($roleUser->id);
        $this->assertEquals($role->id, $roleUser->role_id);
        $this->assertEquals('test_user_id', $roleUser->user_id);

        // 测试关联关系
        $relatedRole = $roleUser->role;
        $this->assertNotNull($relatedRole);
        $this->assertEquals($role->id, $relatedRole->id);

        // 测试 scopes
        $userRoles = RoleUserModel::query()->where('organization_code', $this->organizationCode)
            ->where('user_id', 'test_user_id')
            ->get();

        $this->assertCount(1, $userRoles);

        $roleUsers = RoleUserModel::query()->where('organization_code', $this->organizationCode)
            ->where('role_id', $role->id)
            ->get();

        $this->assertCount(1, $roleUsers);
    }

    public function testRoleRepositoryWithModels(): void
    {
        $repository = $this->getContainer()->get(RoleRepository::class);

        // 创建一个测试角色实体
        $roleEntity = new RoleEntity();
        $roleEntity->setName('Repository Test Role');
        $magicPermission = new MagicPermission();
        $permQuery = $magicPermission->buildPermission(MagicResourceEnum::ADMIN_AI_MODEL->value, MagicOperationEnum::QUERY->value);
        $permEdit = $magicPermission->buildPermission(MagicResourceEnum::ADMIN_AI_MODEL->value, MagicOperationEnum::EDIT->value);
        $roleEntity->setPermissions([$permQuery, $permEdit]);
        $roleEntity->setPermissionTag(['api', 'web']);
        $roleEntity->setStatus(1);
        $roleEntity->setCreatedUid('test_user');
        $roleEntity->setUpdatedUid('test_user');

        // 测试保存
        $savedEntity = $repository->save($this->organizationCode, $roleEntity);
        $this->assertNotNull($savedEntity->getId());

        // 测试根据ID获取
        $foundEntity = $repository->getById($this->organizationCode, $savedEntity->getId());
        $this->assertNotNull($foundEntity);
        $this->assertEquals('Repository Test Role', $foundEntity->getName());
        $this->assertEquals([$permQuery, $permEdit], $foundEntity->getPermissions());

        // 测试根据名称获取
        $foundByName = $repository->getByName($this->organizationCode, 'Repository Test Role');
        $this->assertNotNull($foundByName);
        $this->assertEquals($savedEntity->getId(), $foundByName->getId());

        // 测试分配权限
        $newPerm = $magicPermission->buildPermission(MagicResourceEnum::ADMIN_AI_IMAGE->value, MagicOperationEnum::QUERY->value);
        $repository->assignPermissions($this->organizationCode, $savedEntity->getId(), [$newPerm], 'admin_user');

        $updatedEntity = $repository->getById($this->organizationCode, $savedEntity->getId());
        $this->assertContains($newPerm, $updatedEntity->getPermissions());

        // 测试移除权限
        $repository->removePermissions($this->organizationCode, $savedEntity->getId(), [$permEdit]);

        $updatedEntity = $repository->getById($this->organizationCode, $savedEntity->getId());
        $this->assertNotContains($permEdit, $updatedEntity->getPermissions());
        $this->assertContains($permQuery, $updatedEntity->getPermissions());
        $this->assertContains($newPerm, $updatedEntity->getPermissions());

        // 测试用户分配
        $repository->assignUsers($this->organizationCode, $savedEntity->getId(), ['user1', 'user2'], 'admin_user');

        $roleUsers = $repository->getRoleUsers($this->organizationCode, $savedEntity->getId());
        $this->assertCount(2, $roleUsers);
        $this->assertContains('user1', $roleUsers);
        $this->assertContains('user2', $roleUsers);

        // 测试获取用户角色
        $userRoles = $repository->getUserRoles($this->organizationCode, 'user1');
        $this->assertCount(1, $userRoles);
        $this->assertEquals($savedEntity->getId(), $userRoles[0]->getId());

        // 测试权限检查
        $hasPermission = $repository->hasPermission($this->organizationCode, 'user1', $permQuery);
        $this->assertTrue($hasPermission);

        $hasNoPermission = $repository->hasPermission($this->organizationCode, 'user1', $permEdit);
        $this->assertFalse($hasNoPermission);

        // 测试删除
        $repository->delete($this->organizationCode, $savedEntity);

        $deletedEntity = $repository->getById($this->organizationCode, $savedEntity->getId());
        $this->assertNull($deletedEntity);
    }

    private function clearTestData(): void
    {
        RoleUserModel::where('organization_code', $this->organizationCode)->forceDelete();
        RoleModel::where('organization_code', $this->organizationCode)->forceDelete();
    }
}
