<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Rpc\JsonRpc\Client\Knowledge;

use App\Application\KnowledgeBase\DTO\DataIsolationDTO;
use App\Application\KnowledgeBase\DTO\KnowledgeBaseRequestDTO;
use App\Infrastructure\Rpc\JsonRpc\Client\Knowledge\KnowledgeBaseRpcClient;
use App\Infrastructure\Rpc\JsonRpc\RpcClientManager;
use App\Infrastructure\Rpc\Method\SvcMethods;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class KnowledgeBaseRpcClientTest extends TestCase
{
    public function testCreateUsesExpectedMethodAndPayload(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_CREATE,
                $this->callback(static function (array $params): bool {
                    return $params['name'] === '测试知识库'
                        && $params['source_type'] === 1
                        && $params['source_bindings'][0]['provider'] === 'project'
                        && $params['source_bindings'][0]['root_type'] === 'project'
                        && $params['source_bindings'][0]['root_ref'] === '1001'
                        && $params['source_bindings'][0]['sync_mode'] === 'realtime'
                        && $params['source_bindings'][0]['targets'][0]['target_ref'] === '11'
                        && $params['data_isolation']['organization_code'] === 'DT001'
                        && ! array_key_exists('created_uid', $params)
                        && ! array_key_exists('organization_code', $params);
                })
            )
            ->willReturn([
                'code' => 'KB1',
                'source_type' => 1,
            ]);

        $client = new KnowledgeBaseRpcClient($manager);
        $result = $client->create(KnowledgeBaseRequestDTO::forCreate(
            [
                'name' => '测试知识库',
                'description' => 'desc',
                'type' => 1,
                'source_type' => 1,
                'source_bindings' => [
                    [
                        'provider' => 'project',
                        'root_type' => 'project',
                        'root_ref' => '1001',
                        'sync_mode' => 'realtime',
                        'targets' => [
                            ['target_type' => 'file', 'target_ref' => '11'],
                        ],
                    ],
                ],
            ],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame('KB1', $result['code']);
        $this->assertSame(1, $result['source_type']);
    }

    public function testUpdatePassesRawCompatFieldsThrough(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_UPDATE,
                $this->callback(static function (array $params): bool {
                    return $params['code'] === 'KB1'
                        && $params['status'] === 1
                        && $params['document_files'][0]['third_file_id'] === 'FILE-1'
                        && ! array_key_exists('updated_uid', $params)
                        && ! array_key_exists('organization_code', $params);
                })
            )
            ->willReturn([
                'code' => 'KB1',
            ]);

        $client = new KnowledgeBaseRpcClient($manager);
        $result = $client->update(KnowledgeBaseRequestDTO::forUpdate(
            'KB1',
            [
                'status' => 1,
                'document_files' => [
                    [
                        'type' => 2,
                        'platform_type' => 'teamshare',
                        'third_file_id' => 'FILE-1',
                    ],
                ],
            ],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame('KB1', $result['code']);
    }

    public function testCreatePassesLegacyDocumentFilesThroughWhenSourceBindingsMissing(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_CREATE,
                $this->callback(static function (array $params): bool {
                    return ! array_key_exists('source_bindings', $params)
                        && count($params['document_files']) === 1
                        && $params['document_files'][0]['key'] === 'DT001/path/demo.txt';
                })
            )
            ->willReturn([
                'code' => 'KB-LEGACY',
            ]);

        $client = new KnowledgeBaseRpcClient($manager);
        $result = $client->create(KnowledgeBaseRequestDTO::forCreate(
            [
                'name' => '测试知识库',
                'document_files' => [
                    [
                        'name' => 'demo.txt',
                        'key' => 'DT001/path/demo.txt',
                        'type' => 1,
                    ],
                ],
            ],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame('KB-LEGACY', $result['code']);
    }

    public function testNodesPassesPaginationThroughWithoutPhpNormalization(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_NODES,
                $this->callback(static function (array $params): bool {
                    return ($params['source_type'] ?? '') === 'teamshare'
                        && ($params['parent_type'] ?? '') === 'knowledge_base'
                        && ($params['parent_ref'] ?? '') === 'KB-1'
                        && ($params['page'] ?? null) === 3
                        && ($params['page_size'] ?? null) === 15
                        && ($params['offset'] ?? null) === 4
                        && ($params['limit'] ?? null) === 7;
                })
            )
            ->willReturn([
                'list' => [],
            ]);

        $client = new KnowledgeBaseRpcClient($manager);
        $client->nodes(KnowledgeBaseRequestDTO::forNodes(
            [
                'source_type' => 'teamshare',
                'parent_type' => 'knowledge_base',
                'parent_ref' => 'KB-1',
                'page' => 3,
                'page_size' => 15,
                'offset' => 4,
                'limit' => 7,
            ],
            new DataIsolationDTO('DT001', 'U1')
        ));
    }

    public function testSaveProcessPassesNumericStringsThroughWithoutPhpCasting(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_SAVE_PROCESS,
                $this->callback(static function (array $params): bool {
                    return ($params['code'] ?? null) === 'KB1'
                        && ($params['expected_num'] ?? null) === '12'
                        && ($params['completed_num'] ?? null) === '7'
                        && ($params['organization_code'] ?? null) === 'DT001'
                        && ($params['updated_uid'] ?? null) === 'U1';
                })
            )
            ->willReturn([
                'code' => 'KB1',
            ]);

        $client = new KnowledgeBaseRpcClient($manager);
        $result = $client->saveProcess(KnowledgeBaseRequestDTO::forSaveProcess(
            'KB1',
            [
                'expected_num' => '12',
                'completed_num' => '7',
            ],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame('KB1', $result['code']);
    }

    public function testShowForwardsThirdPlatformIdentityInDataIsolation(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_SHOW,
                $this->callback(static function (array $params): bool {
                    return $params['code'] === 'KB1'
                        && $params['data_isolation']['organization_code'] === 'DT001'
                        && $params['data_isolation']['user_id'] === 'U1'
                        && $params['data_isolation']['third_platform_user_id'] === 'TP-U1'
                        && $params['data_isolation']['third_platform_organization_code'] === 'TP-ORG1';
                })
            )
            ->willReturn([
                'code' => 'KB1',
            ]);

        $client = new KnowledgeBaseRpcClient($manager);
        $result = $client->show(KnowledgeBaseRequestDTO::forShow(
            'KB1',
            new DataIsolationDTO('DT001', 'U1', 'TP-U1', 'TP-ORG1')
        ));

        $this->assertSame('KB1', $result['code']);
    }
}
