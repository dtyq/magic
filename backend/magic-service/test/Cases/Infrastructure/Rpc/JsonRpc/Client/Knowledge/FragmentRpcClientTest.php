<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Rpc\JsonRpc\Client\Knowledge;

use App\Application\KnowledgeBase\DTO\BusinessParamsDTO;
use App\Application\KnowledgeBase\DTO\DataIsolationDTO;
use App\Application\KnowledgeBase\DTO\FragmentRequestDTO;
use App\Infrastructure\Rpc\JsonRpc\Client\Knowledge\FragmentRpcClient;
use App\Infrastructure\Rpc\JsonRpc\RpcClientManager;
use App\Infrastructure\Rpc\Method\SvcMethods;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class FragmentRpcClientTest extends TestCase
{
    public function testRuntimeCreateShouldMapPayload(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_FRAGMENT . '.' . SvcMethods::METHOD_RUNTIME_CREATE,
                $this->callback(function (array $params): bool {
                    return ($params['knowledge_code'] ?? '') === 'KB1'
                        && ($params['document_code'] ?? '') === 'DOC1'
                        && ($params['content'] ?? '') === 'hello'
                        && ($params['business_id'] ?? '') === 'BIZ1'
                        && ($params['id'] ?? 0) === 99
                        && ($params['metadata']['file_id'] ?? '') === 'FILE1'
                        && ($params['business_params']['organization_code'] ?? '') === 'DT001';
                })
            )
            ->willReturn(['id' => 99]);

        $client = new FragmentRpcClient($manager);
        $client->runtimeCreate(FragmentRequestDTO::forRuntimeCreate(
            [
                'knowledge_code' => 'KB1',
                'document_code' => 'DOC1',
                'content' => 'hello',
                'metadata' => ['file_id' => 'FILE1'],
                'business_id' => 'BIZ1',
                'id' => 99,
            ],
            new DataIsolationDTO('DT001', 'U1'),
            new BusinessParamsDTO('DT001', 'U1', 'KB1'),
        ));
    }

    public function testRuntimeSimilarityShouldMapRequest(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_FRAGMENT . '.' . SvcMethods::METHOD_RUNTIME_SIMILARITY,
                $this->callback(function (array $params): bool {
                    return ($params['knowledge_codes'] ?? []) === ['KB1', 'KB2']
                        && ($params['query'] ?? '') === 'keyword'
                        && ($params['question'] ?? '') === 'original question'
                        && ($params['top_k'] ?? 0) === 6
                        && (float) ($params['score_threshold'] ?? 0.0) === 0.3
                        && ($params['metadata_filter']['organization_code'] ?? '') === 'DT001';
                })
            )
            ->willReturn(['list' => []]);

        $client = new FragmentRpcClient($manager);
        $client->runtimeSimilarity(FragmentRequestDTO::forRuntimeSimilarity(
            ['KB1', 'KB2'],
            'keyword',
            'original question',
            6,
            0.3,
            ['organization_code' => 'DT001'],
            new DataIsolationDTO('DT001', 'U1'),
            true,
            new BusinessParamsDTO('DT001', 'U1', 'KB1'),
        ));
    }

    public function testRuntimeSimilarityShouldOmitUnsetScoreThreshold(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_FRAGMENT . '.' . SvcMethods::METHOD_RUNTIME_SIMILARITY,
                $this->callback(function (array $params): bool {
                    return ! array_key_exists('score_threshold', $params)
                        && ($params['knowledge_codes'] ?? []) === ['KB1']
                        && ($params['top_k'] ?? 0) === 0;
                })
            )
            ->willReturn(['list' => []]);

        $client = new FragmentRpcClient($manager);
        $client->runtimeSimilarity(FragmentRequestDTO::forRuntimeSimilarity(
            ['KB1'],
            'keyword',
            '',
            0,
            null,
            [],
            new DataIsolationDTO('DT001', 'U1'),
            false,
            new BusinessParamsDTO('DT001', 'U1', 'KB1'),
        ));
    }

    public function testRuntimeSimilarityShouldKeepExplicitZeroScoreThreshold(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_FRAGMENT . '.' . SvcMethods::METHOD_RUNTIME_SIMILARITY,
                $this->callback(function (array $params): bool {
                    return array_key_exists('score_threshold', $params)
                        && (float) $params['score_threshold'] === 0.0;
                })
            )
            ->willReturn(['list' => []]);

        $client = new FragmentRpcClient($manager);
        $client->runtimeSimilarity(FragmentRequestDTO::forRuntimeSimilarity(
            ['KB1'],
            'keyword',
            '',
            0,
            0.0,
            [],
            new DataIsolationDTO('DT001', 'U1'),
            false,
            new BusinessParamsDTO('DT001', 'U1', 'KB1'),
        ));
    }

    public function testRuntimeDestroyMethodsShouldMapRequest(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->exactly(2))
            ->method('call')
            ->with(
                $this->callback(static fn (string $method): bool => in_array($method, [
                    SvcMethods::SERVICE_KNOWLEDGE_FRAGMENT . '.' . SvcMethods::METHOD_RUNTIME_DESTROY_BY_BUSINESS_ID,
                    SvcMethods::SERVICE_KNOWLEDGE_FRAGMENT . '.' . SvcMethods::METHOD_RUNTIME_DESTROY_BY_METADATA_FILTER,
                ], true)),
                $this->callback(static fn (array $params): bool => ($params['knowledge_code'] ?? '') === 'KB1')
            )
            ->willReturn(['success' => true]);

        $client = new FragmentRpcClient($manager);
        $client->runtimeDestroyByBusinessId(FragmentRequestDTO::forRuntimeDestroyByBusinessId(
            'KB1',
            'BIZ1',
            new DataIsolationDTO('DT001', 'U1'),
        ));
        $client->runtimeDestroyByMetadataFilter(FragmentRequestDTO::forRuntimeDestroyByMetadataFilter(
            'KB1',
            ['organization_code' => 'DT001'],
            new DataIsolationDTO('DT001', 'U1'),
        ));
    }

    public function testPreviewShouldNormalizeLegacyDocumentFile(): void
    {
        $strategyConfig = [
            'parsing_type' => 1,
            'image_extraction' => false,
            'table_extraction' => true,
            'image_ocr' => true,
        ];
        $fragmentConfig = [
            'mode' => 1,
            'normal' => [
                'text_preprocess_rule' => [],
                'segment_rule' => [
                    'separator' => "\n\n",
                    'chunk_size' => 500,
                    'chunk_overlap' => 50,
                ],
            ],
        ];

        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_FRAGMENT . '.' . SvcMethods::METHOD_PREVIEW,
                $this->callback(function (array $params) use ($strategyConfig, $fragmentConfig): bool {
                    $documentFile = $params['document_file'] ?? [];
                    return ($documentFile['type'] ?? '') === 'external'
                        && ($documentFile['url'] ?? '') === 'DT001/open/demo.md'
                        && ($documentFile['third_id'] ?? '') === 'THIRD-1'
                        && ($documentFile['source_type'] ?? '') === 'lark'
                        && $params['strategy_config'] === $strategyConfig
                        && $params['fragment_config'] === $fragmentConfig;
                })
            )
            ->willReturn([]);

        $client = new FragmentRpcClient($manager);
        $client->preview(FragmentRequestDTO::forPreview(
            [
                'name' => 'demo.md',
                'type' => 1,
                'key' => 'DT001/open/demo.md',
                'third_file_id' => 'THIRD-1',
                'platform_type' => 'lark',
            ],
            $strategyConfig,
            $fragmentConfig,
            new DataIsolationDTO('DT001', 'U1')
        ));
    }

    public function testPreviewShouldReturnDocumentNodes(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_FRAGMENT . '.' . SvcMethods::METHOD_PREVIEW,
                $this->callback(fn (array $params): bool => isset($params['document_file'], $params['fragment_config'], $params['data_isolation']))
            )
            ->willReturn([
                'page' => 1,
                'total' => 0,
                'list' => [],
                'document_nodes' => [],
            ]);

        $client = new FragmentRpcClient($manager);
        $result = $client->preview(FragmentRequestDTO::forPreview(
            [
                'name' => 'demo.md',
                'key' => 'DT001/open/demo.md',
            ],
            [],
            ['mode' => 1],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame(['page' => 1, 'total' => 0, 'list' => [], 'document_nodes' => []], $result);
    }

    public function testListShouldReturnDocumentNodes(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_FRAGMENT . '.' . SvcMethods::METHOD_QUERIES,
                $this->callback(function (array $params): bool {
                    return ($params['knowledge_code'] ?? '') === 'KB1'
                        && ($params['document_code'] ?? '') === 'DOC1'
                        && (($params['page']['offset'] ?? null) === 5)
                        && (($params['page']['limit'] ?? null) === 5);
                })
            )
            ->willReturn([
                'page' => 2,
                'total' => 7,
                'list' => [],
                'document_nodes' => [],
            ]);

        $client = new FragmentRpcClient($manager);
        $result = $client->list(FragmentRequestDTO::forList([
            'knowledge_code' => 'KB1',
            'document_code' => 'DOC1',
            'page' => 2,
            'page_size' => 5,
        ], new DataIsolationDTO('DT001', 'U1')));

        $this->assertSame(['page' => 2, 'total' => 7, 'list' => [], 'document_nodes' => []], $result);
    }
}
