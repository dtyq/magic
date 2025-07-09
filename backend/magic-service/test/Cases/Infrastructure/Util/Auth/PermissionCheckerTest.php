<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Util\Auth;

use App\Application\Kernel\SuperPermissionEnum;
use App\Infrastructure\Util\Auth\PermissionChecker;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
#[CoversClass(PermissionChecker::class)]
class PermissionCheckerTest extends TestCase
{
    /**
     * 测试全局管理员权限检查.
     */
    public function testGlobalAdminHasPermission(): void
    {
        // 模拟配置
        $permissions = [
            SuperPermissionEnum::GLOBAL_ADMIN->value => ['13800000001', '13800000002'],
            SuperPermissionEnum::FLOW_ADMIN->value => ['13800000003', '13800000004'],
        ];

        // 全局管理员应该有所有权限
        $this->assertTrue(PermissionChecker::checkPermission(
            '13800000001',
            SuperPermissionEnum::FLOW_ADMIN,
            $permissions
        ));

        $this->assertTrue(PermissionChecker::checkPermission(
            '13800000002',
            SuperPermissionEnum::MODEL_CONFIG_ADMIN,
            $permissions
        ));
    }

    /**
     * 测试特定权限检查.
     */
    public function testSpecificPermission(): void
    {
        // 模拟配置
        $permissions = [
            SuperPermissionEnum::GLOBAL_ADMIN->value => ['13800000001'],
            SuperPermissionEnum::FLOW_ADMIN->value => ['13800000003', '13800000004'],
            SuperPermissionEnum::MODEL_CONFIG_ADMIN->value => ['13800000004', '13800000007'],
        ];

        // 有特定权限的用户
        $this->assertTrue(PermissionChecker::checkPermission(
            '13800000003',
            SuperPermissionEnum::FLOW_ADMIN,
            $permissions
        ));

        // 一个用户可以有多个权限
        $this->assertTrue(PermissionChecker::checkPermission(
            '13800000004',
            SuperPermissionEnum::FLOW_ADMIN,
            $permissions
        ));

        $this->assertTrue(PermissionChecker::checkPermission(
            '13800000004',
            SuperPermissionEnum::MODEL_CONFIG_ADMIN,
            $permissions
        ));

        // 没有此权限的用户
        $this->assertFalse(PermissionChecker::checkPermission(
            '13800000003',
            SuperPermissionEnum::MODEL_CONFIG_ADMIN,
            $permissions
        ));
    }

    /**
     * 测试无权限的情况.
     */
    public function testNoPermission(): void
    {
        // 模拟配置
        $permissions = [
            SuperPermissionEnum::GLOBAL_ADMIN->value => ['13800000001'],
            SuperPermissionEnum::FLOW_ADMIN->value => ['13800000003', '13800000004'],
        ];

        // 不在权限列表中的用户
        $this->assertFalse(PermissionChecker::checkPermission(
            '13800000099',
            SuperPermissionEnum::FLOW_ADMIN,
            $permissions
        ));

        // 权限不存在的情况
        $this->assertFalse(PermissionChecker::checkPermission(
            '13800000003',
            SuperPermissionEnum::HIDE_USER_OR_DEPT,
            $permissions
        ));
    }

    /**
     * 使用数据提供者测试权限检查.
     */
    #[DataProvider('permissionCheckDataProvider')]
    public function testPermissionCheckWithDataProvider(
        string $mobile,
        SuperPermissionEnum $permission,
        array $permissions,
        bool $expected
    ): void {
        $this->assertEquals(
            $expected,
            PermissionChecker::checkPermission($mobile, $permission, $permissions)
        );
    }

    /**
     * 测试数据提供者方法.
     */
    public static function permissionCheckDataProvider(): array
    {
        return [
            '全局管理员' => ['13800000001', SuperPermissionEnum::FLOW_ADMIN, [SuperPermissionEnum::GLOBAL_ADMIN->value => ['13800000001'], SuperPermissionEnum::FLOW_ADMIN->value => []], true],
            '特定权限用户' => ['13800000003', SuperPermissionEnum::FLOW_ADMIN, [SuperPermissionEnum::FLOW_ADMIN->value => ['13800000003']], true],
            '无权限用户' => ['13800000099', SuperPermissionEnum::FLOW_ADMIN, [SuperPermissionEnum::FLOW_ADMIN->value => ['13800000003']], false],
            '权限不存在' => ['13800000003', SuperPermissionEnum::HIDE_USER_OR_DEPT, [SuperPermissionEnum::FLOW_ADMIN->value => ['13800000003']], false],
            '空手机号' => ['', SuperPermissionEnum::FLOW_ADMIN, [SuperPermissionEnum::GLOBAL_ADMIN->value => ['13800000001'], SuperPermissionEnum::FLOW_ADMIN->value => ['13800000003']], false],
        ];
    }
}
