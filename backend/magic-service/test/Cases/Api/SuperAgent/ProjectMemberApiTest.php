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
     * 测试更新项目成员 - 成功场景
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
        $workspaceId = '798545276362801698';
        $projectId = '816065983061213185';

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

        $this->switchUserTest1();

        // 4. 添加空成员
        $this->updateEmptyMembers($projectId);

        // 5. 添加项目成员
        $this->updateMembers($projectId);
        // 6. 查看项目成员
        $this->projectMember($projectId);

        $this->switchUserTest2();

        // 7. 查看项目成员
        $this->projectMember($projectId);
        // 8. 查看协作项目列表
        $this->collaborationProjects();

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
            ]
        ];
        // 发送PUT请求
        $response = $this->put(self::BASE_URI . "/{$projectId}/members", $requestData, $this->getCommonHeaders());
        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals(1000, $response['code']);
    }


    public function updateEmptyMembers(string $projectId, int $code = 1000): void
    {
        $requestData = [
            'members' => []
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
        $this->assertEquals(3, count($response['data']['members']));
        $this->assertEquals('usi_27229966f39dd1b62c9d1449e3f7a90d', $response['data']['members'][0]['user_id']);
        $this->assertEquals('usi_d131724ae038b5a94f7fd6637f11ef2f', $response['data']['members'][1]['user_id']);
        $this->assertEquals('727236421093691395', $response['data']['members'][2]['department_id']);
    }

    public function collaborationProjects(): void
    {
        $response = $this->client->get('/api/v1/super-agent/collaboration-projects', [], $this->getCommonHeaders());
        $this->assertNotNull($response, '响应不应该为null');
        $this->assertEquals(1000, $response['code'], $response['message'] ?? '');
        $this->assertEquals('ok', $response['message']);
        $this->assertIsArray($response['data']);
        // 验证响应结构
        $this->assertArrayHasKey('list', $response['data'], '响应应包含list字段');
        $this->assertArrayHasKey('total', $response['data'], '响应应包含total字段');
        $this->assertIsArray($response['data']['list'], 'list应该是数组');
        $this->assertIsInt($response['data']['total'], 'total应该是整数');
        $project = $response['data']['list'][0];
        $this->assertArrayHasKey('id', $project);
        $this->assertArrayHasKey('project_name', $project);
        $this->assertArrayHasKey('workspace_name', $project);
        $this->assertArrayHasKey('tag', $project);
        $this->assertEquals('collaboration', $project['tag']);
        $this->assertEquals(3, $project['member_count']);
        $this->assertEquals(3, count($project['members']));
        $this->assertEquals('usi_27229966f39dd1b62c9d1449e3f7a90d', $project['members'][0]['user_id']);
        $this->assertEquals('usi_d131724ae038b5a94f7fd6637f11ef2f', $project['members'][1]['user_id']);
        $this->assertEquals('727236421093691395', $project['members'][2]['department_id']);
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
        $this->assertGreaterThan(1, count($response['data']['list']));
    }

    public function renameTopic(string $workspaceId, string $projectId, string $topicId): string
    {
        $requestData = [
            'project_id' => $projectId,
            'workspace_id' => $workspaceId,
            'topic_name' => '4324234',
        ];
        $response = $this->put('/api/v1/super-agent/topics/'.$topicId, $requestData, $this->getCommonHeaders());
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
                'user_upload', 'process', 'system_auto_upload', 'directory'
            ],
            'page' => 1,
            'page_size' => 999,
            'token' => '',
        ];
        $response = $this->post('/api/v1/super-agent/projects/'.$projectId.'/attachments', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertGreaterThan('1', $response['data']['total']);
        return $response['data']['tree'][0];
    }

    public function renameAttachments(string $fileId): void
    {
        $requestData = [
            'target_name' => 'dsadvfsdfs'
        ];
        $response = $this->post('/api/v1/super-agent/file/'.$fileId.'/rename', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertArrayHasKey('file_id', $response['data']);
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
