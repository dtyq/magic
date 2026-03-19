<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Util\Auth;

use App\Application\Kernel\SuperPermissionEnum;
use App\Infrastructure\Util\Auth\PermissionChecker;
use Hyperf\DbConnection\Db;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
#[CoversClass(PermissionChecker::class)]
class PermissionCheckerTest extends TestCase
{
    private string $runId = '';

    private array $userIds = [];

    private array $magicIds = [];

    private array $adminUserIds = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->runId = str_replace('.', '', uniqid('perm_', true));
        $this->userIds = [];
        $this->magicIds = [];
        $this->adminUserIds = [];
    }

    protected function tearDown(): void
    {
        if (! empty($this->adminUserIds)) {
            Db::table('magic_organization_admins')->whereIn('user_id', $this->adminUserIds)->delete();
        }
        if (! empty($this->userIds)) {
            Db::table('magic_contact_users')->whereIn('user_id', $this->userIds)->delete();
        }
        if (! empty($this->magicIds)) {
            Db::table('magic_contact_accounts')->whereIn('magic_id', $this->magicIds)->delete();
        }
        parent::tearDown();
    }

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

    public function testIsOrganizationAdminByUserId(): void
    {
        $organizationCode = 'org_' . $this->runId;
        $userId = 'user_' . $this->runId;
        $magicId = 'magic_' . $this->runId;
        $phone = $this->makePhone();

        $this->insertAccount($magicId, $phone);
        $this->insertUser($userId, $magicId, $organizationCode);
        $this->insertOrganizationAdmin($userId, $organizationCode, $magicId);

        $this->assertTrue(PermissionChecker::isOrganizationAdminByUserId($organizationCode, $userId));
        $this->assertFalse(PermissionChecker::isOrganizationAdminByUserId('', $userId));
        $this->assertFalse(PermissionChecker::isOrganizationAdminByUserId($organizationCode, ''));
    }

    public function testIsOrganizationAdminByUserIdReturnsFalseWhenNotAdmin(): void
    {
        $organizationCode = 'org_no_admin_' . $this->runId;
        $userId = 'user_no_admin_' . $this->runId;
        $magicId = 'magic_no_admin_' . $this->runId;
        $phone = $this->makePhone();

        $this->insertAccount($magicId, $phone);
        $this->insertUser($userId, $magicId, $organizationCode);
        $this->insertOrganizationAdmin($userId, 'org_other_' . $this->runId, $magicId);

        $this->assertFalse(PermissionChecker::isOrganizationAdminByUserId($organizationCode, $userId));
    }

    public function testIsOrganizationAdminByMobile(): void
    {
        $organizationCode = 'org_' . $this->runId;
        $magicId = 'magic_mobile_' . $this->runId;
        $userId = 'user_mobile_' . $this->runId;
        $phone = $this->makePhone();

        $this->insertAccount($magicId, $phone);
        $this->insertUser($userId, $magicId, $organizationCode);
        $this->insertOrganizationAdmin($userId, $organizationCode, $magicId);

        $this->assertTrue(PermissionChecker::isOrganizationAdmin($organizationCode, $phone));
    }

    public function testIsOrganizationAdminByMobileReturnsFalseWhenNoMagicIds(): void
    {
        $phone = 'test_phone_' . $this->runId;
        $this->assertFalse(PermissionChecker::isOrganizationAdmin('org_' . $this->runId, $phone));
    }

    public function testIsOrganizationAdminReturnsFalseWhenNoUsersInOrganization(): void
    {
        $organizationCode = 'org_empty_' . $this->runId;
        $magicId = 'magic_empty_' . $this->runId;
        $userId = 'user_other_org_' . $this->runId;
        $phone = $this->makePhone();

        $this->insertAccount($magicId, $phone);
        $this->insertUser($userId, $magicId, 'org_other_' . $this->runId);

        $this->assertFalse(PermissionChecker::isOrganizationAdmin($organizationCode, $phone));
    }

    public function testIsOrganizationAdminReturnsFalseWhenUserNotAdmin(): void
    {
        $organizationCode = 'org_not_admin_' . $this->runId;
        $magicId = 'magic_not_admin_' . $this->runId;
        $userId = 'user_not_admin_' . $this->runId;
        $phone = $this->makePhone();

        $this->insertAccount($magicId, $phone);
        $this->insertUser($userId, $magicId, $organizationCode);

        $this->assertFalse(PermissionChecker::isOrganizationAdmin($organizationCode, $phone));
    }

    public function testGetUserOrganizationAdminList(): void
    {
        $magicId = 'magic_list_' . $this->runId;
        $phone = $this->makePhone();

        $this->insertAccount($magicId, $phone);

        $userId1 = 'user_list_1_' . $this->runId;
        $userId3 = 'user_list_3_' . $this->runId;

        $this->insertUser($userId1, $magicId, 'org_list_1_' . $this->runId);
        $this->insertUser($userId3, $magicId, 'org_list_2_' . $this->runId);

        $this->insertOrganizationAdmin($userId1, 'org_list_1_' . $this->runId, $magicId);
        $this->insertOrganizationAdmin($userId3, 'org_list_2_' . $this->runId, $magicId);

        $this->assertSame(
            ['org_list_1_' . $this->runId, 'org_list_2_' . $this->runId],
            PermissionChecker::getUserOrganizationAdminList($magicId)
        );
        $this->assertSame([], PermissionChecker::getUserOrganizationAdminList(''));
    }

    public function testGetUserOrganizationAdminListReturnsEmptyWhenNoUsers(): void
    {
        $magicId = 'magic_missing_' . $this->runId;
        $this->assertSame([], PermissionChecker::getUserOrganizationAdminList($magicId));
    }

    public function testGetUserOrganizationAdminListSkipsNonAdminAndEmptyOrganization(): void
    {
        $magicId = 'magic_filter_' . $this->runId;
        $phone = $this->makePhone();

        $this->insertAccount($magicId, $phone);

        $adminUserId = 'user_admin_' . $this->runId;
        $nonAdminUserId = 'user_non_admin_' . $this->runId;
        $emptyOrgUserId = 'user_empty_org_' . $this->runId;

        $adminOrgCode = 'org_admin_' . $this->runId;
        $nonAdminOrgCode = 'org_non_admin_' . $this->runId;

        $this->insertUser($adminUserId, $magicId, $adminOrgCode);
        $this->insertUser($nonAdminUserId, $magicId, $nonAdminOrgCode);
        $this->insertUser($emptyOrgUserId, $magicId, '');

        $this->insertOrganizationAdmin($adminUserId, $adminOrgCode, $magicId);

        $this->assertSame(
            [$adminOrgCode],
            PermissionChecker::getUserOrganizationAdminList($magicId)
        );
    }

    private function insertAccount(string $magicId, string $phone): void
    {
        $now = date('Y-m-d H:i:s');
        Db::table('magic_contact_accounts')->insert([
            'magic_id' => $magicId,
            'type' => 1,
            'ai_code' => '',
            'status' => 0,
            'country_code' => '+86',
            'phone' => $phone,
            'email' => '',
            'real_name' => '',
            'gender' => 0,
            'extra' => '',
            'magic_environment_id' => 0,
            'password' => '',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $this->magicIds[] = $magicId;
    }

    private function insertUser(string $userId, string $magicId, string $organizationCode): void
    {
        $now = date('Y-m-d H:i:s');
        Db::table('magic_contact_users')->insert([
            'magic_id' => $magicId,
            'organization_code' => $organizationCode,
            'user_id' => $userId,
            'user_type' => 1,
            'description' => 'permission checker test',
            'like_num' => 0,
            'label' => '',
            'status' => 1,
            'nickname' => '',
            'i18n_name' => '',
            'avatar_url' => '',
            'extra' => '',
            'user_manual' => '',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $this->userIds[] = $userId;
    }

    private function insertOrganizationAdmin(string $userId, string $organizationCode, ?string $magicId = null): void
    {
        $now = date('Y-m-d H:i:s');
        Db::table('magic_organization_admins')->insert([
            'user_id' => $userId,
            'organization_code' => $organizationCode,
            'magic_id' => $magicId,
            'grantor_user_id' => null,
            'granted_at' => $now,
            'status' => 1,
            'is_organization_creator' => 0,
            'remarks' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        $this->adminUserIds[] = $userId;
    }

    private function makePhone(): string
    {
        $seed = crc32($this->runId);
        return '139' . str_pad((string) ($seed % 100000000), 8, '0', STR_PAD_LEFT);
    }
}
