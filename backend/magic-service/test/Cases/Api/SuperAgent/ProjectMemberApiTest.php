<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\SuperAgent;

use HyperfTest\Cases\Api\AbstractHttpTest;
use Mockery;

/**
 * @internal
 * 项目成员管理API测试
 */
class ProjectMemberApiTest extends AbstractHttpTest
{
    private const string BASE_URI = '/api/v1/super-agent/projects';

    private string $authorization = '';

    private string $fileId = '816640336984018944';

    private string $projectId = '816065897791012866';

    private string $workspaceId = '798545276362801698';

    protected function setUp(): void
    {
        parent::setUp();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function testUpdateFile()
    {
        $projectId = $this->projectId;
        $fileId = (int) $this->fileId;

        $this->switchUserTest1();
        $this->updateEmptyMembers($projectId);
        $this->updateFileContent($fileId, 'test1', 51154);

        // 没权限
        $this->switchUserTest2();
        $this->updateFileContent($fileId, 'test2', 51202);

        // 添加团队协作
        $this->switchUserTest1();
        $this->updateMembers($projectId);

        // 有权限
        $this->switchUserTest2();
        $this->updateFileContent($fileId, 'test2', 51154);
    }

    public function testFile()
    {
        // 使用现有的项目和文件ID进行测试
        $fileId = $this->fileId; // 测试文件ID
        $projectId = $this->projectId;

        $this->switchUserTest1();
        $this->updateEmptyMembers($projectId);

        // 测试没权限
        $this->fileEditingPermissionControl($fileId);

        $this->switchUserTest1();

        $this->updateMembers($projectId);

        // 10. 测试文件编辑状态管理功能
        $this->fileEditingStatusManagement($fileId);

        $this->fileEditingEdgeCases($fileId);
    }

    /**
     * 测试更新项目成员 - 成功场景.
     */
    public function testUpdateProjectMembersSuccess(): void
    {
        $this->switchUserTest1();

        /*$requestData = [
            'workspace_name' => date('Y-m-d')
        ];

        // 1. 创建工作区
        $response = $this->post('/api/v1/super-agent/workspaces', $requestData, $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        $workspaceId = $response['data']['id'];

        $requestData = [
            'project_description' => '',
            'project_mode' => '',
            'project_name' => date('Y-m-d').time(),
            'workspace_id' => $workspaceId,
        ];

        // 2. 创建工作区
        $response = $this->post('/api/v1/super-agent/projects', $requestData, $this->getCommonHeaders());
        $this->assertSame(1000, $response['code']);
        $projectId = $response['data']['project']['id'];*/

        // 话题列表
        $workspaceId = $this->workspaceId;
        $projectId = $this->projectId;

        $this->updateProject($workspaceId, $projectId);
        $this->updateProject($workspaceId, $projectId);

        // 确保不会对原有功能造成影响
        // 创建话题
        $topicId = $this->createTopic($workspaceId, $projectId);
        // 话题列表
        $this->topicList($workspaceId, $projectId);
        // 更新话题
        $this->renameTopic($workspaceId, $projectId, $topicId);
        // 分享话题
        $this->createTopicShare($workspaceId, $projectId, $topicId);
        // 项目文件
        $this->attachments($workspaceId, $projectId, $topicId);
        // 删除话题
        $this->deleteTopic($workspaceId, $projectId, $topicId);

        $this->updateEmptyMembers($projectId);

        // 3. 没有权限
        $this->switchUserTest2();
        $this->updateEmptyMembers($projectId, 51202);
        $this->updateProject($workspaceId, $projectId, 51202);
        $this->deleteProject($workspaceId, $projectId, 51202);

        $this->switchUserTest1();

        // 4. 添加空成员
        $this->updateEmptyMembers($projectId);

        // 5. 添加项目成员
        $this->updateMembers($projectId);
        // 6. 查看项目成员
        $this->projectMember($projectId);

        $this->collaborationProjects('test', 0);

        $this->switchUserTest2();

        // 7. 查看项目成员
        $this->projectMember($projectId);
        // 8. 查看协作项目列表
        $this->collaborationProjects();
        $this->collaborationProjects('test');

        // 创建话题
        $topicId = $this->createTopic($workspaceId, $projectId);
        // 话题列表
        $this->topicList($workspaceId, $projectId);
        // 更新话题
        $this->renameTopic($workspaceId, $projectId, $topicId);
        // 分享话题
        $this->createTopicShare($workspaceId, $projectId, $topicId);
        // 发送消息
        //        $this->sendMessage($workspaceId, $projectId, $topicId);
        // 项目文件
        $file = $this->attachments($workspaceId, $projectId, $topicId);
        // 重命名项目文件
        //        $this->renameAttachments((string) $file['file_id']);

        // 删除话题
        $this->deleteTopic($workspaceId, $projectId, $topicId);

        // 9. 清空空成员
        $requestData = ['members' => []];

        // 发送PUT请求
        $response = $this->put(self::BASE_URI . "/{$projectId}/members", $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
    }

    public function updateMembers(string $projectId): void
    {
        $requestData = [
            'members' => [
                [
                    'target_type' => 'User',
                    'target_id' => 'usi_27229966f39dd1b62c9d1449e3f7a90d',
                ],
                [
                    'target_type' => 'User',
                    'target_id' => 'usi_d131724ae038b5a94f7fd6637f11ef2f',
                ],
                [
                    'target_type' => 'Department',
                    'target_id' => '727236421093691395',
                ],
                [
                    'target_type' => 'Department',
                    'target_id' => '727236421089497089',
                ],
                [
                    'target_type' => 'User',
                    'target_id' => 'usi_e9d64db5b986d062a342793013f682e8',
                ],
            ],
        ];
        // 发送PUT请求
        $response = $this->put(self::BASE_URI . "/{$projectId}/members", $requestData, $this->getCommonHeaders());
        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals(1000, $response['code']);
    }

    public function updateEmptyMembers(string $projectId, int $code = 1000): void
    {
        $requestData = [
            'members' => [],
        ];
        // 发送PUT请求
        $response = $this->put(self::BASE_URI . "/{$projectId}/members", $requestData, $this->getCommonHeaders());
        $this->assertEquals($code, $response['code']);
    }

    public function projectMember(string $projectId): void
    {
        $response = $this->get(self::BASE_URI . "/{$projectId}/members", [], $this->getCommonHeaders());
        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals(1000, $response['code']);
        $this->assertGreaterThan(4, count($response['data']['members']));
        $this->assertEquals('usi_27229966f39dd1b62c9d1449e3f7a90d', $response['data']['members'][0]['user_id']);
        $this->assertEquals('usi_d131724ae038b5a94f7fd6637f11ef2f', $response['data']['members'][1]['user_id']);
        $this->assertArrayHasKey('path_nodes', $response['data']['members'][0]);
    }

    public function collaborationProjects(string $name = '', ?int $count = null): void
    {
        $params = [];
        if ($name) {
            $params['name'] = $name;
        }

        $response = $this->client->get('/api/v1/super-agent/collaboration-projects', $params, $this->getCommonHeaders());

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertEquals('ok', $response['message']);
        $this->assertIsArray($response['data']);

        // 验证响应结构
        $this->assertArrayHasKey('list', $response['data'], '响应应包含list字段');
        $this->assertArrayHasKey('total', $response['data'], '响应应包含total字段');
        if (! is_null($count)) {
            $this->assertEquals(0, count($response['data']['list']));
        } else {
            $this->assertIsArray($response['data']['list'], 'list应该是数组');
            $this->assertIsInt($response['data']['total'], 'total应该是整数');
            $project = $response['data']['list'][0];
            $this->assertArrayHasKey('id', $project);
            $this->assertArrayHasKey('project_name', $project);
            $this->assertArrayHasKey('workspace_name', $project);
            $this->assertArrayHasKey('tag', $project);
            $this->assertEquals('collaboration', $project['tag']);
            $this->assertGreaterThan(3, $project['member_count']);
            $this->assertGreaterThan(3, count($project['members']));
        }

        //        $this->assertEquals('usi_27229966f39dd1b62c9d1449e3f7a90d', $project['members'][0]['user_id']);
        //        $this->assertEquals('usi_d131724ae038b5a94f7fd6637f11ef2f', $project['members'][1]['user_id']);
        //        $this->assertEquals('727236421093691395', $project['members'][2]['department_id']);
    }

    public function createTopic(string $workspaceId, string $projectId): string
    {
        $requestData = [
            'project_id' => $projectId,
            'topic_name' => '',
        ];

        $response = $this->post('/api/v1/super-agent/topics', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertArrayHasKey('id', $response['data']);
        return $response['data']['id'];
    }

    public function topicList(string $workspaceId, string $projectId): void
    {
        $response = $this->get(self::BASE_URI . "/{$projectId}/topics?page=1&page_size=20", [], $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertGreaterThan(0, count($response['data']['list']));
    }

    public function renameTopic(string $workspaceId, string $projectId, string $topicId): string
    {
        $requestData = [
            'project_id' => $projectId,
            'workspace_id' => $workspaceId,
            'topic_name' => '4324234',
        ];
        $response = $this->put('/api/v1/super-agent/topics/' . $topicId, $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertArrayHasKey('id', $response['data']);
        return $response['data']['id'];
    }

    public function createTopicShare(string $workspaceId, string $projectId, string $topicId): void
    {
        $requestData = [
            'pwd' => '123123',
            'resource_id' => $topicId,
            'resource_type' => 5,
            'share_type' => 4,
        ];
        $response = $this->post('/api/v1/share/resources/create', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertArrayHasKey('id', $response['data']);
    }

    public function deleteTopic(string $workspaceId, string $projectId, string $topicId): void
    {
        $requestData = [
            'id' => $topicId,
            'workspace_id' => $workspaceId,
        ];
        $response = $this->post('/api/v1/super-agent/topics/delete', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertArrayHasKey('id', $response['data']);
    }

    public function sendMessage(string $workspaceId, string $projectId, string $topicId): void
    {
        $requestData = [
            'conversation_id' => time(),
            'message' => '123123123',
            'topic_id' => $topicId,
        ];
        $response = $this->post('/api/v1/im/typing/completions', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertArrayHasKey('id', $response['data']);
    }

    public function attachments(string $workspaceId, string $projectId, string $topicId): array
    {
        $requestData = [
            'file_type' => [
                'user_upload', 'process', 'system_auto_upload', 'directory',
            ],
            'page' => 1,
            'page_size' => 999,
            'token' => '',
        ];
        $response = $this->post('/api/v1/super-agent/projects/' . $projectId . '/attachments', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertGreaterThan('1', $response['data']['total']);
        return $response['data']['tree'][0];
    }

    public function renameAttachments(string $fileId): void
    {
        $requestData = [
            'target_name' => 'dsadvfsdfs',
        ];
        $response = $this->post('/api/v1/super-agent/file/' . $fileId . '/rename', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertArrayHasKey('file_id', $response['data']);
    }

    public function updateProject(string $workspaceId, string $projectId, int $code = 1000): void
    {
        $requestData = [
            'workspace_id' => $workspaceId,
            'project_name' => 'test',
            'project_description' => 'test',
        ];
        $response = $this->put('/api/v1/super-agent/projects/' . $projectId, $requestData, $this->getCommonHeaders());
        $this->assertEquals($code, $response['code']);
    }

    public function deleteProject(string $workspaceId, string $projectId, int $code = 1000): void
    {
        $response = $this->delete('/api/v1/super-agent/projects/' . $projectId, [], $this->getCommonHeaders());
        $this->assertEquals($code, $response['code']);
    }

    /**
     * 测试文件编辑状态管理 - 完整流程测试.
     */
    public function fileEditingStatusManagement(string $fileId): void
    {
        $this->switchUserTest1();

        // 1. 测试加入编辑
        $this->joinFileEditing($fileId);

        // 2. 测试获取编辑用户数量 - 应该有1个用户在编辑
        $editingCount = $this->getEditingUsers($fileId);
        $this->assertEquals(1, $editingCount);

        // 3. 切换到另一个用户，测试多用户编辑
        $this->switchUserTest2();
        $this->joinFileEditing($fileId);

        // 4. 再次获取编辑用户数量 - 应该有2个用户在编辑
        $editingCount = $this->getEditingUsers($fileId);
        $this->assertEquals(2, $editingCount);

        // 5. 测试离开编辑
        $this->leaveFileEditing($fileId);

        // 6. 获取编辑用户数量 - 应该只剩1个用户
        $editingCount = $this->getEditingUsers($fileId);
        $this->assertEquals(1, $editingCount);

        // 7. 切换回第一个用户，测试权限
        $this->switchUserTest1();
        $this->leaveFileEditing($fileId);

        // 8. 最终验证没有用户在编辑
        $editingCount = $this->getEditingUsers($fileId);
        $this->assertEquals(0, $editingCount);
    }

    /**
     * 测试加入文件编辑.
     */
    public function joinFileEditing(string $fileId, int $expectedCode = 1000): array
    {
        $response = $this->post("/api/v1/super-agent/file/{$fileId}/join-editing", [], $this->getCommonHeaders());

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals($expectedCode, $response['code'], $response['message'] ?? '');

        if ($expectedCode === 1000) {
            $this->assertEquals('ok', $response['message']);
            $this->assertIsArray($response['data']);
            $this->assertEmpty($response['data']); // join-editing返回空数组
        }

        return $response;
    }

    /**
     * 测试离开文件编辑.
     */
    public function leaveFileEditing(string $fileId, int $expectedCode = 1000): array
    {
        $response = $this->post("/api/v1/super-agent/file/{$fileId}/leave-editing", [], $this->getCommonHeaders());

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals($expectedCode, $response['code'], $response['message'] ?? '');

        if ($expectedCode === 1000) {
            $this->assertEquals('ok', $response['message']);
            $this->assertIsArray($response['data']);
            $this->assertEmpty($response['data']); // leave-editing返回空数组
        }

        return $response;
    }

    /**
     * 测试获取编辑用户数量.
     */
    public function getEditingUsers(string $fileId, int $expectedCode = 1000): int
    {
        $response = $this->get("/api/v1/super-agent/file/{$fileId}/editing-users", [], $this->getCommonHeaders());

        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals($expectedCode, $response['code'], $response['message'] ?? '');

        if ($expectedCode === 1000) {
            $this->assertEquals('ok', $response['message']);
            $this->assertIsArray($response['data']);
            $this->assertArrayHasKey('editing_user_count', $response['data']);
            $this->assertIsInt($response['data']['editing_user_count']);
            return $response['data']['editing_user_count'];
        }

        return 0;
    }

    /**
     * 测试文件编辑权限控制.
     */
    public function fileEditingPermissionControl(string $unauthorizedFileId): void
    {
        $this->switchUserTest2();

        // 测试无权限加入编辑 - 应该返回错误
        $this->joinFileEditing($unauthorizedFileId, 51202); // 假设51200是无权限错误码

        // 测试无权限离开编辑 - 应该返回错误
        $this->leaveFileEditing($unauthorizedFileId, 51202);

        // 测试无权限查询编辑用户 - 应该返回错误
        $this->getEditingUsers($unauthorizedFileId, 51202);
    }

    /**
     * 测试文件编辑边界情况.
     */
    public function fileEditingEdgeCases(string $fileId): void
    {
        $this->switchUserTest1();

        // 1. 重复加入编辑 - 应该正常处理
        $this->joinFileEditing($fileId);
        $this->joinFileEditing($fileId); // 重复加入

        // 验证用户数量仍然是1
        $editingCount = $this->getEditingUsers($fileId);
        $this->assertEquals(1, $editingCount);

        // 2. 重复离开编辑 - 应该正常处理
        $this->leaveFileEditing($fileId);
        $this->leaveFileEditing($fileId); // 重复离开

        // 验证用户数量是0
        $editingCount = $this->getEditingUsers($fileId);
        $this->assertEquals(0, $editingCount);

        // 3. 测试无效文件ID格式
        $invalidFileId = 'invalid_file_id';
        $this->joinFileEditing($invalidFileId, 51202); // 假设400是参数错误
    }

    public function updateFileContent(int $fileId, string $content, int $expectedCode): void
    {
        $response = $this->post('/api/v1/super-agent/file/save', [
            [
                'file_id' => $fileId,
                'content' => $content,
                'enable_shadow' => false,
            ],
        ], $this->getCommonHeaders());

        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');

        $this->assertEquals($expectedCode, $response['data']['error_files'][0]['error_code'], $response['data']['error_files'][0]['error']);
    }

    protected function switchUserTest1(): string
    {
        return $this->authorization = env('TEST_TOKEN');
    }

    protected function switchUserTest2(): string
    {
        return $this->authorization = env('TEST2_TOKEN');
    }

    protected function getCommonHeaders(): array
    {
        return [
            'organization-code' => env('TEST_ORGANIZATION_CODE'),
            // 换成自己的
            'Authorization' => $this->authorization,
        ];
    }
}
