<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Api\SuperAgent;

use Dtyq\SuperMagic\Domain\SuperAgent\Constants\OperationAction;
use Dtyq\SuperMagic\Domain\SuperAgent\Constants\ResourceType;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectOperationLogDomainService;

/**
 * @internal
 */
class ProjectOperatorLogApiTest extends AbstractApiTest
{
    private const string BASE_URI = '/api/v1/super-agent';

    protected ProjectOperationLogDomainService $projectOperationLogDomainService;

    private string $workspace_id = '';

    private string $project_id = '';

    private string $topic_id = '';

    protected function setUp(): void
    {
        $this->projectOperationLogDomainService = di()->get(ProjectOperationLogDomainService::class);
        $this->switchUserTest1();
        parent::setUp();
    }

    protected function tearDown(): void
    {
        parent::tearDown();
    }

    public function testCreateProject(): string
    {
        if ($this->project_id) {
            return $this->project_id;
        }

        $requestData = [
            'project_description' => '',
            'project_mode' => '',
            'project_name' => 'project_name',
            'workspace_id' => $this->createWorkspace(),
        ];
        $response = $this->post(self::BASE_URI . '/projects', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->project_id = $response['data']['project']['id'];

        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::CREATE_PROJECT)[0];
        $this->assertEquals(ResourceType::PROJECT, $logEntity->getResourceType());
        $this->assertEquals($this->project_id, $logEntity->getResourceId());
        return $this->project_id;
    }

    public function testUpdateProject(): void
    {
        $this->testCreateProject();

        $requestData = [
            'project_description' => '',
            'project_name' => 'project_name',
            'workspace_id' => $this->createWorkspace(),
        ];
        $response = $this->put(self::BASE_URI . '/projects/' . $this->project_id, $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);

        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::UPDATE_PROJECT)[0];
        $this->assertEquals(ResourceType::PROJECT, $logEntity->getResourceType());
        $this->assertEquals($this->project_id, $logEntity->getResourceId());
    }

    public function testDeleteProject(): void
    {
        $this->testCreateProject();

        $requestData = [];
        $response = $this->delete(self::BASE_URI . '/projects/' . $this->project_id, $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);

        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::DELETE_PROJECT)[0];
        $this->assertEquals(ResourceType::PROJECT, $logEntity->getResourceType());
        $this->assertEquals($this->project_id, $logEntity->getResourceId());
        $this->project_id = '';
    }

    public function testCreateTopic(): string
    {
        if ($this->topic_id) {
            return $this->topic_id;
        }
        $requestData = [
            'topic_name' => 'topic',
            'workspace_id' => $this->createWorkspace(),
            'project_id' => $this->testCreateProject(),
        ];
        $response = $this->post(self::BASE_URI . '/topics', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->topic_id = $response['data']['id'];

        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::CREATE_TOPIC)[0];
        $this->assertEquals(ResourceType::TOPIC, $logEntity->getResourceType());
        $this->assertEquals($this->topic_id, $logEntity->getResourceId());
        return $this->topic_id;
    }

    public function testUpdateTopic(): void
    {
        $requestData = [
            'topic_name' => 'topic222',
            'workspace_id' => $this->createWorkspace(),
            'project_id' => $this->testCreateProject(),
        ];
        $response = $this->put(self::BASE_URI . '/topics/' . $this->testCreateTopic(), $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);

        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::UPDATE_TOPIC)[0];
        $this->assertEquals(ResourceType::TOPIC, $logEntity->getResourceType());
        $this->assertEquals($this->topic_id, $logEntity->getResourceId());
    }

    public function testDeleteTopic(): void
    {
        $topicId = $this->testCreateTopic();
        $requestData = [
            'id' => $topicId,
            'workspace_id' => $this->createWorkspace(),
        ];
        $response = $this->post(self::BASE_URI . '/topics/delete', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);

        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::DELETE_TOPIC)[0];
        $this->assertEquals(ResourceType::TOPIC, $logEntity->getResourceType());
        $this->assertEquals($topicId, $logEntity->getResourceId());
    }

    public function testRenameTopic(): void
    {
        $topicId = $this->testCreateTopic();
        $requestData = [
            'id' => $topicId,
            'user_question' => '',
        ];
        $response = $this->post(self::BASE_URI . '/topics/rename', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);

        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::RENAME_TOPIC)[0];
        $this->assertEquals(ResourceType::TOPIC, $logEntity->getResourceType());
        $this->assertEquals($topicId, $logEntity->getResourceId());
    }

    public function testSendMessage()
    {
        $this->assertEquals(1, 0);
    }

    public function testBatchMoveFile(): void
    {
        // 创建文件
        $requestData = [
            'is_directory' => false,
            'file_name' => 'test1.txt',
            'parent_id' => '',
            'project_id' => $this->testCreateProject(),
        ];
        $response = $this->post(self::BASE_URI . '/file', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertArrayHasKey('file_id', $response['data']);
        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::UPLOAD_FILE)[0];
        $this->assertEquals(ResourceType::FILE, $logEntity->getResourceType());
        $file1Id = $response['data']['file_id'];

        // 创建文件
        $requestData = [
            'is_directory' => false,
            'file_name' => 'test2.txt',
            'parent_id' => '',
            'project_id' => $this->testCreateProject(),
        ];
        $response = $this->post(self::BASE_URI . '/file', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertArrayHasKey('file_id', $response['data']);
        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::UPLOAD_FILE)[0];
        $this->assertEquals(ResourceType::FILE, $logEntity->getResourceType());
        $file2Id = $response['data']['file_id'];

        // 创建目录
        $requestData = [
            'is_directory' => true,
            'file_name' => 'test',
            'parent_id' => '',
            'project_id' => $this->testCreateProject(),
        ];
        $response = $this->post(self::BASE_URI . '/file', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertArrayHasKey('file_id', $response['data']);
        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::UPLOAD_FILE)[0];
        $this->assertEquals(ResourceType::FILE, $logEntity->getResourceType());
        $directoryId = $response['data']['file_id'];

        $requestData = [
            'file_ids' => [$file1Id, $file2Id],
            'project_id' => $this->testCreateProject(),
            'target_parent_id' => $directoryId,
        ];
        $response = $this->post(self::BASE_URI . '/file/batch-move', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::BATCH_MOVE_FILE)[0];
        $this->assertEquals(ResourceType::FILE, $logEntity->getResourceType());

        $requestData = [
            'file_ids' => [$file1Id, $file2Id],
            'project_id' => $this->testCreateProject(),
        ];
        $response = $this->post(self::BASE_URI . '/file/batch-delete', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::BATCH_DELETE_FILE)[0];
        $this->assertEquals(ResourceType::FILE, $logEntity->getResourceType());
    }

    public function testCreateFile(): void
    {
        // 创建文件
        $requestData = [
            'is_directory' => false,
            'file_name' => 'test.txt',
            'parent_id' => '',
            'project_id' => $this->testCreateProject(),
        ];
        $response = $this->post(self::BASE_URI . '/file', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertArrayHasKey('file_id', $response['data']);
        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::UPLOAD_FILE)[0];
        $this->assertEquals(ResourceType::FILE, $logEntity->getResourceType());
        $fileId = $response['data']['file_id'];

        // 重命名
        $requestData = [
            'target_name' => 'test1.txt',
        ];
        $response = $this->post(self::BASE_URI . '/file/' . $fileId . '/rename', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertArrayHasKey('file_id', $response['data']);
        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::RENAME_FILE)[0];
        $this->assertEquals(ResourceType::FILE, $logEntity->getResourceType());

        // 创建目录
        $requestData = [
            'is_directory' => true,
            'file_name' => 'test',
            'parent_id' => '',
            'project_id' => $this->testCreateProject(),
        ];
        $response = $this->post(self::BASE_URI . '/file', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertArrayHasKey('file_id', $response['data']);
        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::UPLOAD_FILE)[0];
        $this->assertEquals(ResourceType::FILE, $logEntity->getResourceType());
        $directoryId = $response['data']['file_id'];

        // 重命名
        $requestData = [
            'target_name' => 'test1',
        ];
        $response = $this->post(self::BASE_URI . '/file/' . $directoryId . '/rename', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertArrayHasKey('file_id', $response['data']);
        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::RENAME_FILE)[0];
        $this->assertEquals(ResourceType::FILE, $logEntity->getResourceType());

        // 移动文件
        $requestData = [
            'target_parent_id' => $directoryId,
        ];
        $response = $this->post(self::BASE_URI . '/file/' . $fileId . '/move', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::MOVE_FILE)[0];
        $this->assertEquals(ResourceType::FILE, $logEntity->getResourceType());

        // 修改文件内容
        /*$requestData = [
            [
                'content' => 'SHADOWED_M|?M?bMMMMMM',
                'enable_shadow' => true,
                'file_id' => $fileId
            ]
        ];
        $response = $this->post(self::BASE_URI.'/file/save', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::SAVE_FILE_CONTENT)[0];
        $this->assertEquals(ResourceType::FILE, $logEntity->getResourceType());*/

        // 删除文件
        $requestData = [];
        $response = $this->delete(self::BASE_URI . '/file/' . $fileId, $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::DELETE_FILE)[0];
        $this->assertEquals(ResourceType::FILE, $logEntity->getResourceType());

        // 删除目录
        $requestData = [];
        $response = $this->delete(self::BASE_URI . '/file/' . $directoryId, $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::DELETE_FILE)[0];
        $this->assertEquals(ResourceType::FILE, $logEntity->getResourceType());
    }

    public function testUploadFile()
    {
        $requestData = [
            'file_key' => 'DT001/588417216353927169/project_817070987873607681/workspace/1755063791.xlsx',
            'file_name' => '1755063791.xlsx',
            'file_size' => 5134,
            'file_type' => 'user_upload',
            'project_id' => $this->testCreateProject(),
            'source' => 2,
            'storage_type' => 'workspace',
        ];
        $response = $this->post(self::BASE_URI . '/file/project/save', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        $this->assertArrayHasKey('file_id', $response['data']);
        $logEntity = $this->projectOperationLogDomainService->getProjectActionOperationLogs((int) $this->project_id, OperationAction::UPLOAD_FILE)[0];
        $this->assertEquals(ResourceType::FILE, $logEntity->getResourceType());
    }

    private function createWorkspace(): string
    {
        if ($this->workspace_id) {
            return $this->workspace_id;
        }

        $requestData = [
            'workspace_name' => 'test222',
        ];
        $response = $this->post(self::BASE_URI . '/workspaces', $requestData, $this->getCommonHeaders());
        $this->assertEquals(1000, $response['code']);
        return $this->workspace_id = $response['data']['id'];
    }
}
