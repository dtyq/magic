<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Rpc\JsonRpc\Client\Knowledge;

use App\Application\KnowledgeBase\DTO\BusinessParamsDTO;
use App\Application\KnowledgeBase\DTO\DataIsolationDTO;
use App\Application\KnowledgeBase\DTO\DocumentRequestDTO;
use App\Infrastructure\Rpc\JsonRpc\Client\Knowledge\DocumentRpcClient;
use App\Infrastructure\Rpc\JsonRpc\RpcClientManager;
use App\Infrastructure\Rpc\Method\SvcMethods;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class DocumentRpcClientTest extends TestCase
{
    public function testCreateShouldEncodeExplicitEmptyMetadataAsObject(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_DOCUMENT . '.' . SvcMethods::METHOD_CREATE,
                $this->callback(function (array $params): bool {
                    return $params['knowledge_base_code'] === 'KB1'
                        && $params['doc_metadata'] === []
                        && ! array_key_exists('metadata', $params);
                })
            )
            ->willReturn([]);

        $client = new DocumentRpcClient($manager);
        $client->create(DocumentRequestDTO::forCreate([
            'organization_code' => 'ORG1',
            'user_id' => 'U1',
            'knowledge_base_code' => 'KB1',
            'name' => 'demo',
            'doc_metadata' => [],
        ], new DataIsolationDTO('ORG1', 'U1')));
    }

    public function testCreateShouldPassTopLevelStrategyConfig(): void
    {
        $strategyConfig = [
            'parsing_type' => 1,
            'image_extraction' => false,
            'table_extraction' => true,
            'image_ocr' => true,
        ];

        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_DOCUMENT . '.' . SvcMethods::METHOD_CREATE,
                $this->callback(function (array $params) use ($strategyConfig): bool {
                    return $params['knowledge_base_code'] === 'KB1'
                        && $params['organization_code'] === 'ORG1'
                        && $params['user_id'] === 'U1'
                        && ($params['doc_metadata']['source'] ?? '') === 'knowledge-demo'
                        && $params['strategy_config'] === $strategyConfig;
                })
            )
            ->willReturn([]);

        $client = new DocumentRpcClient($manager);
        $client->create(DocumentRequestDTO::forCreate([
            'organization_code' => 'ORG1',
            'user_id' => 'U1',
            'knowledge_base_code' => 'KB1',
            'name' => 'demo',
            'doc_metadata' => ['source' => 'knowledge-demo'],
            'strategy_config' => $strategyConfig,
        ], new DataIsolationDTO('ORG1', 'U1')));
    }

    public function testCreateShouldPassDocumentFileThrough(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_DOCUMENT . '.' . SvcMethods::METHOD_CREATE,
                $this->callback(function (array $params): bool {
                    $documentFile = $params['document_file'] ?? [];
                    return $params['knowledge_base_code'] === 'KB1'
                        && ($documentFile['type'] ?? null) === 1
                        && ($documentFile['key'] ?? '') === 'ORG1/demo.md'
                        && ($documentFile['third_file_id'] ?? '') === 'FILE-1'
                        && ($documentFile['platform_type'] ?? '') === 'teamshare'
                        && ! array_key_exists('embedding_model', $params);
                })
            )
            ->willReturn([]);

        $client = new DocumentRpcClient($manager);
        $client->create(DocumentRequestDTO::forCreate([
            'organization_code' => 'ORG1',
            'user_id' => 'U1',
            'knowledge_base_code' => 'KB1',
            'name' => 'demo',
            'document_file' => [
                'type' => 1,
                'name' => 'demo.md',
                'key' => 'ORG1/demo.md',
                'third_file_id' => 'FILE-1',
                'platform_type' => 'teamshare',
            ],
            'embedding_config' => [
                'model_id' => 'text-embedding-3-small',
            ],
        ], new DataIsolationDTO('ORG1', 'U1')));
    }

    public function testShowShouldPassKnowledgeBaseCode(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_DOCUMENT . '.' . SvcMethods::METHOD_SHOW,
                $this->callback(function (array $params): bool {
                    return $params['code'] === 'DOC1'
                        && $params['knowledge_base_code'] === 'KB1'
                        && $params['data_isolation']['organization_code'] === 'ORG1';
                })
            )
            ->willReturn([]);

        $client = new DocumentRpcClient($manager);
        $client->show(DocumentRequestDTO::forShow('DOC1', 'KB1', new DataIsolationDTO('ORG1', 'U1')));
    }

    public function testUpdateShouldPassExplicitTransportContext(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_DOCUMENT . '.' . SvcMethods::METHOD_UPDATE,
                $this->callback(function (array $params): bool {
                    return $params['code'] === 'DOC1'
                        && $params['knowledge_base_code'] === 'KB1'
                        && $params['organization_code'] === 'ORG1'
                        && $params['user_id'] === 'U1';
                })
            )
            ->willReturn([]);

        $client = new DocumentRpcClient($manager);
        $client->update(DocumentRequestDTO::forUpdate(
            'DOC1',
            [
                'organization_code' => 'ORG1',
                'user_id' => 'U1',
                'knowledge_base_code' => 'KB1',
                'name' => 'demo',
            ],
            new DataIsolationDTO('ORG1', 'U1'),
            'KB1'
        ));
    }

    public function testUpdateShouldPassTopLevelStrategyConfig(): void
    {
        $strategyConfig = [
            'parsing_type' => 0,
            'image_extraction' => false,
            'table_extraction' => false,
            'image_ocr' => false,
        ];

        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_DOCUMENT . '.' . SvcMethods::METHOD_UPDATE,
                $this->callback(function (array $params) use ($strategyConfig): bool {
                    return $params['code'] === 'DOC1'
                        && $params['knowledge_base_code'] === 'KB1'
                        && $params['organization_code'] === 'ORG1'
                        && $params['user_id'] === 'U1'
                        && ($params['doc_metadata']['source'] ?? '') === 'knowledge-demo'
                        && $params['strategy_config'] === $strategyConfig;
                })
            )
            ->willReturn([]);

        $client = new DocumentRpcClient($manager);
        $client->update(DocumentRequestDTO::forUpdate(
            'DOC1',
            [
                'organization_code' => 'ORG1',
                'user_id' => 'U1',
                'knowledge_base_code' => 'KB1',
                'doc_metadata' => ['source' => 'knowledge-demo'],
                'strategy_config' => $strategyConfig,
            ],
            new DataIsolationDTO('ORG1', 'U1'),
            'KB1'
        ));
    }

    public function testGetOriginalFileLinkShouldPassExpectedPayload(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_DOCUMENT . '.' . SvcMethods::METHOD_GET_ORIGINAL_FILE_LINK,
                $this->callback(function (array $params): bool {
                    return $params['code'] === 'DOC1'
                        && $params['knowledge_base_code'] === 'KB1'
                        && $params['data_isolation']['organization_code'] === 'ORG1';
                })
            )
            ->willReturn([
                'available' => true,
                'url' => 'https://example.com/demo.md',
                'name' => 'demo.md',
                'key' => 'ORG1/demo.md',
                'type' => 'external',
            ]);

        $client = new DocumentRpcClient($manager);
        $result = $client->getOriginalFileLink(DocumentRequestDTO::forOriginalFileLink(
            'DOC1',
            'KB1',
            new DataIsolationDTO('ORG1', 'U1')
        ));

        $this->assertTrue($result['available']);
        $this->assertSame('https://example.com/demo.md', $result['url']);
    }

    public function testGetByThirdFileIdShouldPassExpectedPayload(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_DOCUMENT . '.' . SvcMethods::METHOD_GET_BY_THIRD_FILE_ID,
                $this->callback(function (array $params): bool {
                    return $params['data_isolation']['organization_code'] === 'ORG1'
                        && $params['knowledge_base_code'] === 'KB1'
                        && $params['third_platform_type'] === 'teamshare'
                        && $params['third_file_id'] === 'FILE-1';
                })
            )
            ->willReturn([]);

        $client = new DocumentRpcClient($manager);
        $client->getByThirdFileId(DocumentRequestDTO::forGetByThirdFileId(
            'teamshare',
            'FILE-1',
            new DataIsolationDTO('ORG1', 'U1'),
            'KB1',
        ));
    }

    public function testDestroyShouldPassExpectedPayload(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_DOCUMENT . '.' . SvcMethods::METHOD_DESTROY,
                $this->callback(function (array $params): bool {
                    return $params['code'] === 'DOC1'
                        && $params['knowledge_base_code'] === 'KB1'
                        && $params['data_isolation']['organization_code'] === 'ORG1';
                })
            )
            ->willReturn(['success' => true]);

        $client = new DocumentRpcClient($manager);
        $this->assertTrue($client->destroy(DocumentRequestDTO::forDestroy(
            'DOC1',
            'KB1',
            new DataIsolationDTO('ORG1', 'U1')
        )));
    }

    public function testSyncShouldNotPassAsyncFlag(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_DOCUMENT . '.' . SvcMethods::METHOD_SYNC,
                $this->callback(function (array $params): bool {
                    return $params['code'] === 'DOC1'
                        && $params['knowledge_base_code'] === 'KB1'
                        && $params['mode'] === 'resync'
                        && ! array_key_exists('async', $params)
                        && ! array_key_exists('sync', $params)
                        && ! array_key_exists('knowledge_code', $params);
                })
            )
            ->willReturn([]);

        $client = new DocumentRpcClient($manager);
        $client->sync(DocumentRequestDTO::forSync(
            'DOC1',
            'KB1',
            'resync',
            new DataIsolationDTO('ORG1', 'U1'),
            new BusinessParamsDTO('ORG1', 'U1', 'KB1')
        ));
    }

    public function testSyncShouldPassRevectorizeSourceWithoutSyncFlag(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_DOCUMENT . '.' . SvcMethods::METHOD_SYNC,
                $this->callback(function (array $params): bool {
                    return $params['code'] === 'DOC1'
                        && $params['knowledge_base_code'] === 'KB1'
                        && $params['mode'] === 'resync'
                        && $params['revectorize_source'] === DocumentRequestDTO::REVECTORIZE_SOURCE_SINGLE_DOCUMENT_MANUAL
                        && ! array_key_exists('sync', $params)
                        && ! array_key_exists('async', $params)
                        && ! array_key_exists('knowledge_code', $params);
                })
            )
            ->willReturn([]);

        $client = new DocumentRpcClient($manager);
        $client->sync(DocumentRequestDTO::forSync(
            'DOC1',
            'KB1',
            'resync',
            new DataIsolationDTO('ORG1', 'U1'),
            new BusinessParamsDTO('ORG1', 'U1', 'KB1'),
            revectorizeSource: DocumentRequestDTO::REVECTORIZE_SOURCE_SINGLE_DOCUMENT_MANUAL,
        ));
    }

    public function testReVectorizedByThirdFileIdShouldPassExpectedPayload(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_DOCUMENT . '.' . SvcMethods::METHOD_RE_VECTORIZED_BY_THIRD_FILE_ID,
                $this->callback(function (array $params): bool {
                    return $params['data_isolation']['organization_code'] === 'ORG1'
                        && $params['third_platform_type'] === 'teamshare'
                        && $params['third_file_id'] === 'FILE-1'
                        && ! array_key_exists('third_knowledge_id', $params);
                })
            )
            ->willReturn([]);

        $client = new DocumentRpcClient($manager);
        $client->reVectorizedByThirdFileId(DocumentRequestDTO::forReVectorizedByThirdFileId(
            'teamshare',
            'FILE-1',
            new DataIsolationDTO('ORG1', 'U1')
        ));
    }
}
