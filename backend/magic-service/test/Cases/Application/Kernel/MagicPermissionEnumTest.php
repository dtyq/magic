<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Kernel;

use App\Application\Kernel\Contract\MagicPermissionInterface;
use App\Application\Kernel\MagicPermission;
use HyperfTest\HttpTestCase;
use InvalidArgumentException;

/**
 * @internal
 */
class MagicPermissionEnumTest extends HttpTestCase
{
    private MagicPermissionInterface $permissionEnum;

    protected function setUp(): void
    {
        parent::setUp();
        $this->permissionEnum = di(MagicPermissionInterface::class);
    }

    public function testGetOperations()
    {
        $operations = $this->permissionEnum->getOperations();

        $this->assertIsArray($operations);
        $this->assertCount(2, $operations);
        $this->assertContains('query', $operations);
        $this->assertContains('manage', $operations);
        $this->assertNotContains('export', $operations); // export不在operations列表中
    }

    public function testParsePermissionWithValidKey()
    {
        $permissionKey = 'admin.ai.model_management.query';

        $parsed = $this->permissionEnum->parsePermission($permissionKey);

        $this->assertIsArray($parsed);
        $this->assertEquals('Admin.ai.model_management', $parsed['resource']);
        $this->assertEquals('query', $parsed['operation']);
    }

    public function testParsePermissionWithInvalidKey()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Invalid permission key format');

        $this->permissionEnum->parsePermission('invalid.key');
    }

    public function testGetResourceLabelWithInvalidResource()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Not a resource type: invalid_resource');

        $this->permissionEnum->getResourceLabel('invalid_resource');
    }

    public function testGetOperationLabelWithInvalidOperation()
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('Not an operation type: invalid_operation');

        $this->permissionEnum->getOperationLabel('invalid_operation');
    }

    public function testGenerateAllPermissions()
    {
        $permissions = $this->permissionEnum->generateAllPermissions();

        $this->assertIsArray($permissions);
        // 应该有 2 个资源 × 2 个操作 = 4 个权限（排除export操作）
        $this->assertCount(4, $permissions);

        // 检查权限结构
        foreach ($permissions as $permission) {
            $this->assertArrayHasKey('permission_key', $permission);
            $this->assertArrayHasKey('resource', $permission);
            $this->assertArrayHasKey('operation', $permission);
            $this->assertArrayHasKey('resource_label', $permission);
            $this->assertArrayHasKey('operation_label', $permission);

            // 检查具体值
            $this->assertContains($permission['resource'], $this->permissionEnum->getResources());
            $this->assertContains($permission['operation'], $this->permissionEnum->getOperations());
        }

        // 检查特定权限是否存在
        $permissionKeys = array_column($permissions, 'permission_key');
        $this->assertContains('admin.ai.model_management.query', $permissionKeys);
        $this->assertContains('admin.ai.model_management.manage', $permissionKeys);
        $this->assertContains('admin.ai.image_generation.query', $permissionKeys);
        $this->assertContains('admin.ai.image_generation.manage', $permissionKeys);
    }

    public function testIsValidPermissionWithValidKeys()
    {
        // 测试全局权限
        $this->assertTrue($this->permissionEnum->isValidPermission(MagicPermission::ALL_PERMISSIONS));

        // 测试有效的权限组合
        $this->assertTrue($this->permissionEnum->isValidPermission('admin.ai.model_management.query'));
        $this->assertTrue($this->permissionEnum->isValidPermission('admin.ai.model_management.manage'));
        $this->assertTrue($this->permissionEnum->isValidPermission('admin.ai.image_generation.query'));
        $this->assertTrue($this->permissionEnum->isValidPermission('admin.ai.image_generation.manage'));
    }

    public function testIsValidPermissionWithInvalidKeys()
    {
        // 测试无效的权限键
        $this->assertFalse($this->permissionEnum->isValidPermission('invalid_permission'));
        $this->assertFalse($this->permissionEnum->isValidPermission('Admin.ai.invalid_resource.query'));
        $this->assertFalse($this->permissionEnum->isValidPermission('Admin.ai.model_management.invalid_operation'));
        $this->assertFalse($this->permissionEnum->isValidPermission('short.key'));
    }

    public function testGetPermissionTree()
    {
        $tree = $this->permissionEnum->getPermissionTree();

        // 默认情况下（非平台组织）不包含 platform 平台节点
        $this->assertIsArray($tree);
        $this->assertGreaterThanOrEqual(1, count($tree));

        // 找到 Admin 平台节点进行进一步校验
        $platformsByKey = [];
        foreach ($tree as $node) {
            $platformsByKey[$node['permission_key']] = $node;
        }
        $this->assertArrayHasKey('admin', $platformsByKey);
        $this->assertArrayNotHasKey('platform', $platformsByKey);
        $platform = $platformsByKey['admin'];

        $this->assertEquals('管理后台', $platform['label']);
        $this->assertArrayHasKey('children', $platform);
        $this->assertNotEmpty($platform['children']);

        foreach ($platform['children'] as $module) {
            $this->assertArrayHasKey('label', $module);
            $this->assertArrayHasKey('children', $module);
            foreach ($module['children'] as $resource) {
                $this->assertArrayHasKey('children', $resource);
                foreach ($resource['children'] as $operation) {
                    $this->assertTrue($operation['is_leaf']);
                }
            }
        }
    }

    /**
     * 测试私有方法isValidCombination的行为
     * 通过generateAllPermissions间接测试.
     */
    public function testIsValidCombinationThroughGenerateAllPermissions()
    {
        $permissions = $this->permissionEnum->generateAllPermissions();

        // 确保没有export操作的权限
        foreach ($permissions as $permission) {
            $this->assertNotEquals('export', $permission['operation']);
        }
    }

    /**
     * 测试边界情况.
     */
    public function testEdgeCases()
    {
        // 测试空字符串
        $this->assertFalse($this->permissionEnum->isResource(''));
        $this->assertFalse($this->permissionEnum->isOperation(''));
        $this->assertFalse($this->permissionEnum->isValidPermission(''));

        // 测试null值处理（PHP会转换为字符串）
        $this->assertFalse($this->permissionEnum->isValidPermission('null'));
    }

    /**
     * 测试类实现了正确的接口.
     */
    public function testImplementsInterface()
    {
        $this->assertInstanceOf(
            MagicPermissionInterface::class,
            $this->permissionEnum
        );
    }
}
