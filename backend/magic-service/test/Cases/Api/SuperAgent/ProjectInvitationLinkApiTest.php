<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\SuperAgent;

use Hyperf\DbConnection\Db;
use Mockery;

/**
 * @internal
 * 项目邀请链接API测试
 */
class ProjectInvitationLinkApiTest extends AbstractApiTest
{
    private const BASE_URI = '/api/v1/super-agent/projects';

    private const INVITATION_BASE_URI = '/api/v1/super-agent/invitation';

    private string $projectId = '816065897791012866';

    // 测试过程中生成的邀请链接信息
    private ?string $invitationToken = null;

    private ?string $invitationPassword = null;

    protected function setUp(): void
    {
        parent::setUp();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    /**
     * 测试邀请链接完整流程.
     */
    public function testInvitationLinkCompleteFlow(): void
    {
        $projectId = $this->projectId;

        // 0. 清理测试数据 - 确保test2用户不是项目成员
        $this->cleanupTestData($projectId);

        // 1. 项目所有者开启邀请链接
        $this->switchUserTest1();
        $this->assertToggleInvitationLinkOn($projectId);

        // 2. 获取邀请链接信息
        $linkInfo = $this->getInvitationLink($projectId);
        $this->invitationToken = $linkInfo['data']['token'];

        // 3. 设置密码保护
        $this->assertSetPasswordProtection($projectId, true);

        // 4. 外部用户通过Token获取邀请信息
        $this->switchUserTest2();
        $invitationInfo = $this->getInvitationByToken($this->invitationToken);
        $this->assertTrue($invitationInfo['data']['requires_password']);

        // 5. 外部用户尝试加入项目（密码错误）
        $this->joinProjectWithWrongPassword($this->invitationToken);

        // 6. 项目所有者重置密码
        $this->switchUserTest1();
        $passwordInfo = $this->resetInvitationPassword($projectId);
        $this->invitationPassword = $passwordInfo['data']['password'];

        // 7. 外部用户使用正确密码加入项目
        $this->switchUserTest2();
        $this->joinProjectSuccess($this->invitationToken, $this->invitationPassword);

        // 8. 验证用户已成为项目成员（再次加入应该失败）
        $this->joinProjectAlreadyMember($this->invitationToken, $this->invitationPassword);

        // 9. 项目所有者关闭邀请链接
        $this->switchUserTest1();
        $this->assertToggleInvitationLinkOff($projectId);

        // 10. 外部用户尝试访问已关闭的邀请链接
        $this->switchUserTest2();
        $this->getInvitationByTokenDisabled($this->invitationToken);
    }

    /**
     * 测试邀请链接权限控制.
     */
    public function testInvitationLinkPermissions(): void
    {
        $projectId = $this->projectId;

        // 1. 非项目成员尝试管理邀请链接（应该失败）
        $this->switchUserTest2();
        $this->getInvitationLink($projectId, 51202); // 权限不足

        // 2. 项目所有者可以管理邀请链接
        $this->switchUserTest1();
        $this->getInvitationLink($projectId, 1000); // 成功
    }

    /**
     * 测试权限级别管理.
     */
    public function testPermissionLevelManagement(): void
    {
        $projectId = $this->projectId;

        $this->switchUserTest1();

        // 1. 开启邀请链接
        $this->toggleInvitationLink($projectId, true);

        // 2. 测试修改权限级别为管理权限
        $this->updateInvitationPermission($projectId, 'manage');

        // 3. 测试修改权限级别为编辑权限
        $this->updateInvitationPermission($projectId, 'edit');

        // 4. 测试修改权限级别为查看权限
        $this->updateInvitationPermission($projectId, 'view');
    }

    // =================== API 调用方法 ===================

    /**
     * 获取邀请链接信息.
     */
    public function getInvitationLink(string $projectId, int $expectedCode = 1000): array
    {
        $response = $this->client->get(
            self::BASE_URI . "/{$projectId}/invitation-links",
            [],
            $this->getCommonHeaders()
        );

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals($expectedCode, $response['code'], $response['message'] ?? '');

        return $response;
    }

    /**
     * 开启/关闭邀请链接.
     */
    public function toggleInvitationLink(string $projectId, bool $enabled, int $expectedCode = 1000): array
    {
        $response = $this->client->put(
            self::BASE_URI . "/{$projectId}/invitation-links/toggle",
            ['enabled' => $enabled],
            $this->getCommonHeaders()
        );

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals($expectedCode, $response['code'], $response['message'] ?? '');

        return $response;
    }

    /**
     * 重置邀请链接.
     */
    public function resetInvitationLink(string $projectId, int $expectedCode = 1000): array
    {
        $response = $this->client->post(
            self::BASE_URI . "/{$projectId}/invitation-links/reset",
            [],
            $this->getCommonHeaders()
        );

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals($expectedCode, $response['code'], $response['message'] ?? '');

        return $response;
    }

    /**
     * 设置密码保护.
     */
    public function setInvitationPassword(string $projectId, bool $enabled, int $expectedCode = 1000): array
    {
        $response = $this->client->post(
            self::BASE_URI . "/{$projectId}/invitation-links/password",
            ['enabled' => $enabled],
            $this->getCommonHeaders()
        );

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals($expectedCode, $response['code'], $response['message'] ?? '');

        return $response;
    }

    /**
     * 重置密码
     */
    public function resetInvitationPassword(string $projectId, int $expectedCode = 1000): array
    {
        $response = $this->client->post(
            self::BASE_URI . "/{$projectId}/invitation-links/reset-password",
            [],
            $this->getCommonHeaders()
        );

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals($expectedCode, $response['code'], $response['message'] ?? '');

        return $response;
    }

    /**
     * 修改权限级别.
     */
    public function updateInvitationPermission(string $projectId, string $permission, int $expectedCode = 1000): array
    {
        $response = $this->client->put(
            self::BASE_URI . "/{$projectId}/invitation-links/permission",
            ['permission' => $permission],
            $this->getCommonHeaders()
        );

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals($expectedCode, $response['code'], $response['message'] ?? '');

        if ($expectedCode === 1000) {
            $this->assertEquals($permission, $response['data']['permission']);
        }

        return $response;
    }

    /**
     * 通过Token获取邀请信息.
     */
    public function getInvitationByToken(string $token, int $expectedCode = 1000): array
    {
        $response = $this->client->get(
            self::INVITATION_BASE_URI . "/links/{$token}",
            [],
            $this->getCommonHeaders()
        );

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals($expectedCode, $response['code'], $response['message'] ?? '');

        if ($expectedCode === 1000) {
            $this->assertArrayHasKey('project_name', $response['data']);
            $this->assertArrayHasKey('project_description', $response['data']);
            $this->assertArrayHasKey('requires_password', $response['data']);
            $this->assertArrayHasKey('permission', $response['data']);
        }

        return $response;
    }

    /**
     * 获取已禁用的邀请链接（应该失败）.
     */
    public function getInvitationByTokenDisabled(string $token): void
    {
        $response = $this->getInvitationByToken($token, 51222); // 邀请链接已禁用
    }

    /**
     * 加入项目（密码错误）.
     */
    public function joinProjectWithWrongPassword(string $token): void
    {
        $response = $this->client->post(
            self::INVITATION_BASE_URI . '/join',
            [
                'token' => $token,
                'password' => 'wrong_password',
            ],
            $this->getCommonHeaders()
        );

        $this->assertEquals(51220, $response['code']); // 密码错误
    }

    /**
     * 成功加入项目.
     */
    public function joinProjectSuccess(string $token, ?string $password = null): array
    {
        $data = ['token' => $token];
        if ($password) {
            $data['password'] = $password;
        }

        $response = $this->client->post(
            self::INVITATION_BASE_URI . '/join',
            $data,
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $response['code']);
        $this->assertArrayHasKey('project_id', $response['data']);
        $this->assertArrayHasKey('user_role', $response['data']);
        $this->assertArrayHasKey('permission', $response['data']);
        $this->assertArrayHasKey('join_method', $response['data']);
        $this->assertEquals('link', $response['data']['join_method']);

        return $response;
    }

    /**
     * 尝试重复加入项目（应该失败）.
     */
    public function joinProjectAlreadyMember(string $token, ?string $password = null): void
    {
        $data = ['token' => $token];
        if ($password) {
            $data['password'] = $password;
        }

        $response = $this->client->post(
            self::INVITATION_BASE_URI . '/join',
            $data,
            $this->getCommonHeaders()
        );

        $this->assertEquals(51225, $response['code']); // 已经是项目成员
    }

    // =================== 边界条件测试 ===================

    /**
     * 测试无效Token访问.
     */
    public function testInvalidTokenAccess(): void
    {
        $this->switchUserTest2();
        $invalidToken = 'invalid_token_123456789';

        $response = $this->getInvitationByToken($invalidToken, 51217); // Token无效
    }

    /**
     * 测试权限边界.
     */
    public function testPermissionBoundaries(): void
    {
        $projectId = $this->projectId;
        $this->switchUserTest1();

        // 测试无效权限级别
        $response = $this->client->put(
            self::BASE_URI . "/{$projectId}/invitation-links/permission",
            ['permission' => 'invalid_permission'],
            $this->getCommonHeaders()
        );

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals(51226, $response['code']); // 无效权限级别
    }

    /**
     * 测试并发操作.
     */
    public function testConcurrentOperations(): void
    {
        $projectId = $this->projectId;
        $this->switchUserTest1();

        // 连续快速开启/关闭邀请链接
        $this->toggleInvitationLink($projectId, true);
        $this->toggleInvitationLink($projectId, false);
        $this->toggleInvitationLink($projectId, true);

        // 验证最终状态
        $response = $this->getInvitationLink($projectId);
        $this->assertTrue($response['data']['is_enabled']);
    }

    /**
     * 测试密码安全性.
     */
    public function testPasswordSecurity(): void
    {
        $projectId = $this->projectId;
        $this->switchUserTest1();

        // 1. 开启邀请链接
        $this->toggleInvitationLink($projectId, true);

        // 2. 多次设置密码保护，验证密码生成
        $password1 = $this->setInvitationPassword($projectId, true);
        $password2 = $this->resetInvitationPassword($projectId);
        $password3 = $this->resetInvitationPassword($projectId);

        // 验证每次生成的密码都不同
        $this->assertNotEquals($password1['data']['password'] ?? '', $password2['data']['password']);
        $this->assertNotEquals($password2['data']['password'], $password3['data']['password']);

        // 验证密码长度和格式
        $password = $password3['data']['password'];
        $this->assertEquals(8, strlen($password)); // 密码长度应该是8位
        $this->assertMatchesRegularExpression('/^[A-Za-z0-9]+$/', $password); // 只包含字母和数字
    }

    /**
     * 开启邀请链接 (私有辅助方法).
     */
    private function assertToggleInvitationLinkOn(string $projectId): void
    {
        $response = $this->toggleInvitationLink($projectId, true);

        $this->assertEquals(1000, $response['code']);
        $this->assertTrue($response['data']['is_enabled']);
        $this->assertNotEmpty($response['data']['token']);
        $this->assertEquals('view', $response['data']['permission']);
    }

    /**
     * 关闭邀请链接 (私有辅助方法).
     */
    private function assertToggleInvitationLinkOff(string $projectId): void
    {
        $response = $this->toggleInvitationLink($projectId, false);

        $this->assertEquals(1000, $response['code']);
        $this->assertFalse($response['data']['is_enabled']);
    }

    /**
     * 设置密码保护 (私有辅助方法).
     */
    private function assertSetPasswordProtection(string $projectId, bool $enabled): void
    {
        $response = $this->setInvitationPassword($projectId, $enabled);

        $this->assertEquals(1000, $response['code']);
        $this->assertEquals($enabled, $response['data']['enabled']);

        if ($enabled) {
            $this->assertArrayHasKey('password', $response['data']);
            $this->assertNotEmpty($response['data']['password']);
            $this->invitationPassword = $response['data']['password'];
        }
    }

    /**
     * 清理测试数据.
     */
    private function cleanupTestData(string $projectId): void
    {
        // 删除test2用户的项目成员关系（如果存在）
        Db::table('magic_super_agent_project_members')
            ->where('project_id', $projectId)
            ->where('target_type', 'User')
            ->where('target_id', 'usi_e9d64db5b986d062a342793013f682e8') // test2用户ID
            ->delete();
    }
}
