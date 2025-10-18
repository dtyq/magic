<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\SuperAgent;

use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectMemberDomainService;
use Exception;
use Mockery;

/**
 * @internal
 * 项目团队邀请API测试
 */
class ProjectMemberV2ApiTest extends AbstractApiTest
{
    private const BASE_URI = '/api/v1/super-agent/projects';

    private string $projectId = '816065897791012866';

    // 测试用户ID和部门ID
    private string $testUserId1 = 'usi_27229966f39dd1b62c9d1449e3f7a90d';

    private string $testUserId2 = 'usi_e9d64db5b986d062a342793013f682e8';

    private string $testDepartmentId1 = '727236421093691395';

    private string $testDepartmentId2 = '727236421089497089';

    protected function setUp(): void
    {
        parent::setUp();
        // 确保测试环境干净，重置协作状态为关闭
        $this->switchUserTest1();
        $this->disableCollaboration($this->projectId);
        // 清理项目成员数据，避免唯一键冲突
        $this->cleanupProjectMembers($this->projectId);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    /**
     * 测试团队邀请功能完整流程.
     */
    public function testTeamInvitationCompleteFlow(): void
    {
        $projectId = $this->projectId;

        // 0. 清理测试数据，确保环境干净
        $this->switchUserTest1();
        $this->cleanupProjectMembers($projectId);

        // 1. 项目创建者开启协作功能
        $this->enableCollaboration($projectId);

        // 2. 测试获取协作设置
        $this->getCollaborationSettings($projectId);

        // 3. 添加团队成员
        $this->addTeamMembers($projectId);

        // 4. 验证成员已添加
        $this->verifyMembersAdded($projectId);

        // 5. 批量更新成员权限
        $this->batchUpdateMemberPermissions($projectId);

        // 6. 验证权限更新
        $this->verifyPermissionsUpdated($projectId);

        // 7. 批量删除部分成员
        $this->batchDeleteMembers($projectId);

        // 8. 验证成员已删除
        $this->verifyMembersDeleted($projectId);

        // 9. 关闭协作功能
        $this->disableCollaboration($projectId);
    }

    /**
     * 测试权限控制 - 只有管理者和所有者可以添加成员.
     */
    public function testCreateMembersPermissionControl(): void
    {
        $projectId = $this->projectId;

        // 1. 项目创建者开启协作
        $this->switchUserTest1();
        $this->enableCollaboration($projectId);

        // 2. 非项目成员尝试添加成员 - 应该失败
        $this->switchUserTest2();
        $this->addTeamMembers($projectId, 51202); // 无权限错误

        // 3. 项目创建者添加成员 - 应该成功
        $this->switchUserTest1();
        $this->addTeamMembers($projectId);

        // 4. 现在test2用户成为成员，但权限不足 - 添加成员应该失败
        $this->switchUserTest2();
        $this->addTeamMembers($projectId, 51202); // 仍然无权限，因为不是管理者

        // 5. 给test2用户管理权限
        $this->switchUserTest1();
        $this->updateMemberToManager($projectId, $this->testUserId2);

        // 6. 现在test2用户可以添加成员
        $this->switchUserTest2();
        $this->addMoreTeamMembers($projectId);
    }

    /**
     * 测试协作设置管理.
     */
    public function testCollaborationSettings(): void
    {
        $projectId = $this->projectId;

        $this->switchUserTest1();

        // 1. 测试获取协作设置 - 默认关闭状态
        $response = $this->getCollaborationSettings($projectId);
        $this->assertFalse($response['data']['is_collaboration_enabled']);
        $this->assertEquals('viewer', $response['data']['default_join_permission']);

        // 2. 开启协作功能
        $this->enableCollaboration($projectId);

        // 3. 验证协作已开启
        $response = $this->getCollaborationSettings($projectId);
        $this->assertTrue($response['data']['is_collaboration_enabled']);

        // 4. 关闭协作功能
        $this->disableCollaboration($projectId);

        // 5. 验证协作已关闭
        $response = $this->getCollaborationSettings($projectId);
        $this->assertFalse($response['data']['is_collaboration_enabled']);
    }

    /**
     * 测试批量操作权限控制.
     */
    public function testBatchOperationsPermissionControl(): void
    {
        $projectId = $this->projectId;

        // 1. 准备测试环境
        $this->switchUserTest1();
        $this->enableCollaboration($projectId);
        $this->addTeamMembers($projectId);

        // 2. 非管理者尝试批量更新权限 - 应该失败
        $this->switchUserTest2();
        $this->batchUpdateMemberPermissions($projectId, 51202);

        // 3. 非管理者尝试批量删除成员 - 应该失败
        $this->batchDeleteMembers($projectId, 51202);

        // 4. 管理者可以进行批量操作
        $this->switchUserTest1();
        $this->batchUpdateMemberPermissions($projectId);
        $this->batchDeleteMembers($projectId);
    }

    /**
     * 测试组织边界控制.
     */
    public function testOrganizationBoundaryControl(): void
    {
        $projectId = $this->projectId;

        $this->switchUserTest1();
        $this->enableCollaboration($projectId);

        // 尝试添加其他组织的用户 - 应该失败
        $requestData = [
            'members' => [
                [
                    'target_type' => 'User',
                    'target_id' => 'usi_invalid_cross_org_user',
                    'role' => 'editor',
                ],
            ],
        ];

        $response = $this->post(
            self::BASE_URI . "/{$projectId}/members",
            $requestData,
            $this->getCommonHeaders()
        );

        // 应该返回成员不存在错误
        $this->assertNotEquals(1000, $response['code']);
    }

    /**
     * 测试边界情况.
     */
    public function testEdgeCases(): void
    {
        $projectId = $this->projectId;

        $this->switchUserTest1();
        $this->enableCollaboration($projectId);

        // 1. 测试添加空成员列表
        $this->addEmptyMembersList($projectId, 5003);

        // 2. 测试重复添加相同成员
        $this->addTeamMembers($projectId);
        //        $this->addTeamMembers($projectId); // 重复添加

        // 3. 测试无效的权限级别
        $this->addMembersWithInvalidPermission($projectId, 5003);

        // 4. 测试不能删除自己
        $this->switchUserTest2();
        $this->cannotDeleteSelf($projectId);

        $this->switchUserTest1();

        // 5. 测试协作关闭时不能添加成员
        $this->disableCollaboration($projectId);
        $this->addTeamMembers($projectId, 51202); // 协作已关闭错误
    }

    /**
     * 测试多语言错误消息.
     */
    public function testMultiLanguageErrorMessages(): void
    {
        $projectId = $this->projectId;

        // 1. 测试中文错误消息
        $this->switchUserTest2(); // 无权限用户
        $response = $this->addTeamMembers($projectId, 51202);
        $this->assertStringContainsString('权限', $response['message']);

        // 2. 测试协作未开启错误
        $this->switchUserTest1();
        $response = $this->addTeamMembers($projectId, 51202);
        $this->assertStringContainsString('协作', $response['message']);
    }

    // ========== 辅助测试方法 ==========

    /**
     * 开启项目协作.
     */
    public function enableCollaboration(string $projectId, int $expectedCode = 1000): array
    {
        $requestData = ['is_collaboration_enabled' => true];

        $response = $this->put(
            self::BASE_URI . "/{$projectId}",
            $requestData,
            $this->getCommonHeaders()
        );

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals($expectedCode, $response['code'], $response['message'] ?? '');

        if ($expectedCode === 1000) {
            $this->assertEquals('ok', $response['message']);
            $this->assertIsArray($response['data']);
            $this->assertEquals('is_collaboration_enabled', $response['data']['is_collaboration_enabled']);
        }

        return $response;
    }

    /**
     * 关闭项目协作.
     */
    public function disableCollaboration(string $projectId, int $expectedCode = 1000): array
    {
        $requestData = ['is_collaboration_enabled' => false];

        $response = $this->put(
            self::BASE_URI . "/{$projectId}",
            $requestData,
            $this->getCommonHeaders()
        );

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals($expectedCode, $response['code'], $response['message'] ?? '');

        return $response;
    }

    /**
     * 获取协作设置.
     */
    public function getCollaborationSettings(string $projectId, int $expectedCode = 1000): array
    {
        $response = $this->get(
            self::BASE_URI . "/{$projectId}",
            [],
            $this->getCommonHeaders()
        );

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals($expectedCode, $response['code'], $response['message'] ?? '');

        if ($expectedCode === 1000) {
            $this->assertEquals('ok', $response['message']);
            $this->assertIsBool($response['data']['is_collaboration_enabled']);
            $this->assertIsString($response['data']['default_join_permission']);
        }

        return $response;
    }

    /**
     * 添加团队成员.
     */
    public function addTeamMembers(string $projectId, int $expectedCode = 1000): array
    {
        $requestData = [
            'members' => [
                [
                    'target_type' => 'User',
                    'target_id' => $this->testUserId2,
                    'role' => 'editor',
                ],
                [
                    'target_type' => 'Department',
                    'target_id' => $this->testDepartmentId1,
                    'role' => 'viewer',
                ],
            ],
        ];

        $response = $this->post(
            self::BASE_URI . "/{$projectId}/members",
            $requestData,
            $this->getCommonHeaders()
        );

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals($expectedCode, $response['code'], $response['message'] ?? '');

        if ($expectedCode === 1000) {
            $this->assertEquals('ok', $response['message']);
            $this->assertArrayHasKey('members', $response['data']);
        }

        return $response;
    }

    /**
     * 添加更多团队成员（测试管理者权限）.
     */
    public function addMoreTeamMembers(string $projectId, int $expectedCode = 1000): array
    {
        $requestData = [
            'members' => [
                [
                    'target_type' => 'Department',
                    'target_id' => $this->testDepartmentId2,
                    'role' => 'editor',
                ],
            ],
        ];

        $response = $this->post(
            self::BASE_URI . "/{$projectId}/members",
            $requestData,
            $this->getCommonHeaders()
        );

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals($expectedCode, $response['code'], $response['message'] ?? '');

        return $response;
    }

    /**
     * 添加空成员列表.
     */
    public function addEmptyMembersList(string $projectId, int $expectedCode = 1000): array
    {
        $requestData = ['members' => []];

        $response = $this->post(
            self::BASE_URI . "/{$projectId}/members",
            $requestData,
            $this->getCommonHeaders()
        );

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals($expectedCode, $response['code'], $response['message'] ?? '');

        return $response;
    }

    /**
     * 添加无效权限的成员.
     */
    public function addMembersWithInvalidPermission(string $projectId, int $expectedCode = 51221): array
    {
        $requestData = [
            'members' => [
                [
                    'target_type' => 'User',
                    'target_id' => $this->testUserId2,
                    'role' => 'invalid_permission',
                ],
            ],
        ];

        $response = $this->post(
            self::BASE_URI . "/{$projectId}/members",
            $requestData,
            $this->getCommonHeaders()
        );

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals($expectedCode, $response['code'], $response['message'] ?? '');

        return $response;
    }

    /**
     * 批量更新成员权限.
     */
    public function batchUpdateMemberPermissions(string $projectId, int $expectedCode = 1000): array
    {
        $requestData = [
            'members' => [
                [
                    'target_type' => 'User',
                    'target_id' => $this->testUserId2,
                    'role' => 'manage',
                ],
            ],
        ];

        $response = $this->put(
            self::BASE_URI . "/{$projectId}/members/roles",
            $requestData,
            $this->getCommonHeaders()
        );

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals($expectedCode, $response['code'], $response['message'] ?? '');

        if ($expectedCode === 1000) {
            $this->assertEquals('ok', $response['message']);
            $this->assertIsArray($response['data']);
            $this->assertEmpty($response['data']);
        }

        return $response;
    }

    /**
     * 批量删除成员.
     */
    public function batchDeleteMembers(string $projectId, int $expectedCode = 1000): array
    {
        $requestData = [
            'members' => [
                [
                    'target_type' => 'User',
                    'target_id' => $this->testUserId2,
                ],
            ],
        ];

        $response = $this->delete(
            self::BASE_URI . "/{$projectId}/members",
            $requestData,
            $this->getCommonHeaders()
        );

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals($expectedCode, $response['code'], $response['message'] ?? '');

        if ($expectedCode === 1000) {
            $this->assertEquals('ok', $response['message']);
            $this->assertIsArray($response['data']);
            $this->assertEmpty($response['data']);
        }

        return $response;
    }

    /**
     * 更新成员为管理者.
     */
    public function updateMemberToManager(string $projectId, string $userId): array
    {
        $requestData = [
            'members' => [
                [
                    'target_type' => 'User',
                    'target_id' => $userId,
                    'role' => 'manage',
                ],
            ],
        ];

        $response = $this->put(
            self::BASE_URI . "/{$projectId}/members/roles",
            $requestData,
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        return $response;
    }

    /**
     * 测试不能删除自己.
     */
    public function cannotDeleteSelf(string $projectId): void
    {
        // 先添加当前用户为成员
        //        $this->addTeamMembers($projectId);

        // 尝试删除自己
        $currentUserId = $this->testUserId2; // test2用户
        $requestData = [
            'members' => [
                [
                    'target_type' => 'User',
                    'target_id' => $currentUserId,
                ],
            ],
        ];

        $response = $this->delete(
            self::BASE_URI . "/{$projectId}/members",
            $requestData,
            $this->getCommonHeaders()
        );

        // 应该返回不能删除自己的错误
        $this->assertNotEquals(1000, $response['code']);
    }

    public function testGetProjectInfo()
    {
        $this->switchUserTest1();

        $response = $this->get(
            self::BASE_URI . "/{$this->projectId}",
            [],
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $response['code']);
        $this->assertArrayHasKey('is_collaboration_enabled', $response['data']);
        $this->assertArrayHasKey('default_join_permission', $response['data']);
    }

    /**
     * 验证成员已添加.
     */
    public function verifyMembersAdded(string $projectId): void
    {
        $response = $this->get(
            self::BASE_URI . "/{$projectId}/members",
            [],
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $response['code']);
        $this->assertGreaterThan(0, count($response['data']['members']));

        // 验证添加的成员存在
        $memberIds = array_column($response['data']['members'], 'user_id');
        $departmentIds = array_column($response['data']['members'], 'department_id');

        $this->assertContains($this->testUserId2, array_filter($memberIds));
        $this->assertContains($this->testDepartmentId1, array_filter($departmentIds));
    }

    /**
     * 验证权限已更新.
     */
    public function verifyPermissionsUpdated(string $projectId): void
    {
        $response = $this->get(
            self::BASE_URI . "/{$projectId}/members",
            [],
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $response['code']);

        // 查找指定用户的权限
        $members = $response['data']['members'];
        foreach ($members as $member) {
            if (isset($member['user_id']) && $member['user_id'] === $this->testUserId2) {
                $this->assertEquals('manage', $member['role']);
                break;
            }
        }
    }

    /**
     * 验证成员已删除.
     */
    public function verifyMembersDeleted(string $projectId): void
    {
        $response = $this->get(
            self::BASE_URI . "/{$projectId}/members",
            [],
            $this->getCommonHeaders()
        );

        $this->assertEquals(1000, $response['code']);

        // 验证删除的成员不存在
        $memberIds = array_column($response['data']['members'], 'user_id');
        $this->assertNotContains($this->testUserId2, array_filter($memberIds));
    }

    /**
     * 清理项目成员数据（直接数据库删除）.
     */
    private function cleanupProjectMembers(string $projectId): void
    {
        try {
            $projectMemberDomainService = di(ProjectMemberDomainService::class);
            $projectMemberDomainService->deleteByProjectId((int) $projectId);
            echo "清理项目成员数据完成: {$projectId}\n";
        } catch (Exception $e) {
            echo '清理项目成员数据失败: ' . $e->getMessage() . "\n";
        }
    }
}
