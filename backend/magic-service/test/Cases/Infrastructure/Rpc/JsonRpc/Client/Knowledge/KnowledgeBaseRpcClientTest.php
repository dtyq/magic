<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Rpc\JsonRpc\Client\Knowledge;

use App\Application\KnowledgeBase\DTO\DataIsolationDTO;
use App\Application\KnowledgeBase\DTO\KnowledgeBaseRequestDTO;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\Exception\BusinessException;
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
                        && $params['source_bindings'][0]['targets'][1]['target_ref'] === '22'
                        && $params['data_isolation']['organization_code'] === 'DT001'
                        && $params['created_uid'] === 'U1';
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
                            ['target_type' => 'file', 'target_ref' => '22'],
                        ],
                    ],
                ],
            ],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame('KB1', $result['code']);
        $this->assertSame(1, $result['source_type']);
    }

    public function testUpdateOnlyPassesSourceBindingsWhenProvided(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_UPDATE,
                $this->callback(static function (array $params): bool {
                    return $params['code'] === 'KB1'
                        && $params['source_bindings'][0]['provider'] === 'project'
                        && $params['source_bindings'][0]['root_ref'] === '2001'
                        && $params['source_bindings'][0]['sync_mode'] === 'realtime'
                        && $params['source_bindings'][0]['targets'] === [];
                })
            )
            ->willReturn([
                'code' => 'KB1',
            ]);

        $client = new KnowledgeBaseRpcClient($manager);
        $result = $client->update(KnowledgeBaseRequestDTO::forUpdate(
            'KB1',
            [
                'name' => '知识库',
                'source_bindings' => [
                    [
                        'provider' => 'project',
                        'root_type' => 'project',
                        'root_ref' => '2001',
                        'sync_mode' => 'realtime',
                        'targets' => [],
                    ],
                ],
            ],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame('KB1', $result['code']);
    }

    public function testCreateFiltersInvalidSourceBindingsAndTargets(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_CREATE,
                $this->callback(static function (array $params): bool {
                    return count($params['source_bindings']) === 1
                        && $params['source_bindings'][0]['sync_mode'] === 'manual'
                        && $params['source_bindings'][0]['enabled'] === true
                        && $params['source_bindings'][0]['sync_config'] === []
                        && count($params['source_bindings'][0]['targets']) === 1
                        && $params['source_bindings'][0]['targets'][0]['target_type'] === 'folder'
                        && $params['source_bindings'][0]['targets'][0]['target_ref'] === 'target-1';
                })
            )
            ->willReturn([
                'code' => 'KB2',
            ]);

        $client = new KnowledgeBaseRpcClient($manager);
        $result = $client->create(KnowledgeBaseRequestDTO::forCreate(
            [
                'name' => '测试知识库',
                'source_bindings' => [
                    'invalid-binding',
                    [
                        'provider' => 'project',
                        'root_type' => 'project',
                        'root_ref' => '3001',
                        'targets' => [
                            'invalid-target',
                            ['target_type' => 'folder', 'target_ref' => 'target-1'],
                        ],
                    ],
                ],
            ],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame('KB2', $result['code']);
    }

    public function testCreateFallsBackToLegacyDocumentFilesWhenSourceBindingsMissing(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_CREATE,
                $this->callback(static function (array $params): bool {
                    return count($params['source_bindings']) === 1
                        && $params['source_bindings'][0]['provider'] === 'local_upload'
                        && $params['source_bindings'][0]['root_type'] === 'file'
                        && $params['source_bindings'][0]['root_ref'] === 'DT001/path/demo.txt'
                        && $params['source_bindings'][0]['sync_mode'] === 'manual'
                        && $params['source_bindings'][0]['targets'] === []
                        && $params['source_bindings'][0]['sync_config']['document_file']['name'] === 'demo.txt'
                        && $params['source_bindings'][0]['sync_config']['document_file']['url'] === 'DT001/path/demo.txt'
                        && $params['source_bindings'][0]['sync_config']['document_file']['key'] === 'DT001/path/demo.txt';
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

    public function testCreateGroupsLegacyEnterpriseDocumentFilesIntoKnowledgeBaseBindings(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $callCount = 0;
        $manager->expects($this->exactly(2))
            ->method('call')
            ->willReturnCallback(function (string $method, array $params) use (&$callCount): array {
                ++$callCount;

                if ($callCount === 1) {
                    $this->assertSame(
                        SvcMethods::SERVICE_KNOWLEDGE_THIRD_PLATFORM_DOCUMENT . '.' . SvcMethods::METHOD_EXPAND,
                        $method
                    );
                    $this->assertSame('DT001', $params['data_isolation']['organization_code'] ?? null);
                    $this->assertCount(2, $params['document_files'] ?? []);

                    return [
                        'code' => 0,
                        'data' => [
                            [
                                'type' => 'third_platform',
                                'name' => '团队文档-1',
                                'platform_type' => 'teamshare',
                                'third_file_id' => 'FILE-1',
                                'knowledge_base_id' => 'TS-KB-1',
                            ],
                            [
                                'type' => 'third_platform',
                                'name' => '团队文档-2',
                                'platform_type' => 'teamshare',
                                'third_file_id' => 'FILE-2',
                                'knowledge_base_id' => 'TS-KB-1',
                            ],
                        ],
                    ];
                }

                $this->assertSame(
                    SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_CREATE,
                    $method
                );
                $this->assertCount(1, $params['source_bindings'] ?? []);
                $binding = $params['source_bindings'][0];
                $this->assertSame('teamshare', $binding['provider'] ?? null);
                $this->assertSame('knowledge_base', $binding['root_type'] ?? null);
                $this->assertSame('TS-KB-1', $binding['root_ref'] ?? null);
                $this->assertSame('manual', $binding['sync_mode'] ?? null);
                $this->assertSame('TS-KB-1', $binding['sync_config']['root_context']['knowledge_base_id'] ?? null);
                $this->assertCount(2, $binding['targets'] ?? []);
                $this->assertSame('file', $binding['targets'][0]['target_type'] ?? null);
                $this->assertSame('FILE-1', $binding['targets'][0]['target_ref'] ?? null);
                $this->assertSame('FILE-2', $binding['targets'][1]['target_ref'] ?? null);

                return [
                    'code' => 'KB-ENTERPRISE',
                ];
            });

        $client = new KnowledgeBaseRpcClient($manager);
        $result = $client->create(KnowledgeBaseRequestDTO::forCreate(
            [
                'name' => '企业知识库',
                'source_type' => 1001,
                'document_files' => [
                    [
                        'type' => 2,
                        'name' => '团队文档-1',
                        'platform_type' => 'teamshare',
                        'third_file_id' => 'FILE-1',
                    ],
                    [
                        'type' => 2,
                        'name' => '团队文档-2',
                        'platform_type' => 'teamshare',
                        'third_file_id' => 'FILE-2',
                    ],
                ],
            ],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame('KB-ENTERPRISE', $result['code']);
    }

    public function testCreateInfersEnterpriseBindingsFromLegacyDocumentFilesWithoutSourceType(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $callCount = 0;
        $manager->expects($this->exactly(2))
            ->method('call')
            ->willReturnCallback(function (string $method, array $params) use (&$callCount): array {
                ++$callCount;

                if ($callCount === 1) {
                    $this->assertSame(
                        SvcMethods::SERVICE_KNOWLEDGE_THIRD_PLATFORM_DOCUMENT . '.' . SvcMethods::METHOD_EXPAND,
                        $method
                    );

                    return [
                        'code' => 0,
                        'data' => [
                            [
                                'type' => 'third_platform',
                                'name' => '团队文档-1',
                                'platform_type' => 'teamshare',
                                'third_file_id' => 'FILE-1',
                                'knowledge_base_id' => 'TS-KB-1',
                            ],
                        ],
                    ];
                }

                $this->assertSame(
                    SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_CREATE,
                    $method
                );
                $this->assertArrayNotHasKey('source_type', $params);
                $this->assertCount(1, $params['source_bindings'] ?? []);
                $binding = $params['source_bindings'][0];
                $this->assertSame('teamshare', $binding['provider'] ?? null);
                $this->assertSame('knowledge_base', $binding['root_type'] ?? null);
                $this->assertSame('TS-KB-1', $binding['root_ref'] ?? null);

                return [
                    'code' => 'KB-ENTERPRISE-INFERRED',
                ];
            });

        $client = new KnowledgeBaseRpcClient($manager);
        $result = $client->create(KnowledgeBaseRequestDTO::forCreate(
            [
                'name' => '企业知识库',
                'document_files' => [
                    [
                        'type' => 2,
                        'name' => '团队文档-1',
                        'platform_type' => 'teamshare',
                        'third_file_id' => 'FILE-1',
                    ],
                ],
            ],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame('KB-ENTERPRISE-INFERRED', $result['code']);
    }

    public function testCreateMapsLegacyTeamshareKnowledgeBaseRootsWhenExpandFallsBackToRawDocumentFiles(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $callCount = 0;
        $manager->expects($this->exactly(2))
            ->method('call')
            ->willReturnCallback(function (string $method, array $params) use (&$callCount): array {
                ++$callCount;

                if ($callCount === 1) {
                    $this->assertSame(
                        SvcMethods::SERVICE_KNOWLEDGE_THIRD_PLATFORM_DOCUMENT . '.' . SvcMethods::METHOD_EXPAND,
                        $method
                    );

                    return [
                        'code' => 500,
                        'message' => 'expand failed',
                    ];
                }

                $this->assertSame(
                    SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_CREATE,
                    $method
                );
                $this->assertSame(1001, $params['source_type'] ?? null);
                $this->assertCount(2, $params['source_bindings'] ?? []);

                $firstBinding = $params['source_bindings'][0];
                $this->assertSame('teamshare', $firstBinding['provider'] ?? null);
                $this->assertSame('knowledge_base', $firstBinding['root_type'] ?? null);
                $this->assertSame('877886470862843904', $firstBinding['root_ref'] ?? null);
                $this->assertSame('877886470862843904', $firstBinding['sync_config']['root_context']['knowledge_base_id'] ?? null);
                $this->assertSame([], $firstBinding['targets'] ?? null);

                $secondBinding = $params['source_bindings'][1];
                $this->assertSame('teamshare', $secondBinding['provider'] ?? null);
                $this->assertSame('knowledge_base', $secondBinding['root_type'] ?? null);
                $this->assertSame('817088298500648960', $secondBinding['root_ref'] ?? null);
                $this->assertSame('817088298500648960', $secondBinding['sync_config']['root_context']['knowledge_base_id'] ?? null);
                $this->assertSame([], $secondBinding['targets'] ?? null);

                return [
                    'code' => 'KB-ENTERPRISE-FALLBACK',
                ];
            });

        $client = new KnowledgeBaseRpcClient($manager);
        $result = $client->create(KnowledgeBaseRequestDTO::forCreate(
            [
                'name' => '企业知识库',
                'source_type' => 1001,
                'document_files' => [
                    [
                        'type' => 2,
                        'name' => '团队知识库-1',
                        'platform_type' => 'teamshare',
                        'third_file_id' => '877886470862843904',
                        'file_type' => 9,
                        'space_type' => 8,
                    ],
                    [
                        'type' => 2,
                        'name' => '团队知识库-2',
                        'platform_type' => 'teamshare',
                        'third_file_id' => '817088298500648960',
                        'file_type' => 9,
                        'space_type' => 8,
                    ],
                ],
            ],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame('KB-ENTERPRISE-FALLBACK', $result['code']);
    }

    public function testCreateInfersEnterpriseBindingsFromLegacyKnowledgeBaseRootsWithoutSourceTypeWhenExpandFallsBack(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $callCount = 0;
        $manager->expects($this->exactly(2))
            ->method('call')
            ->willReturnCallback(function (string $method, array $params) use (&$callCount): array {
                ++$callCount;

                if ($callCount === 1) {
                    $this->assertSame(
                        SvcMethods::SERVICE_KNOWLEDGE_THIRD_PLATFORM_DOCUMENT . '.' . SvcMethods::METHOD_EXPAND,
                        $method
                    );

                    return [
                        'code' => 500,
                        'message' => 'expand failed',
                    ];
                }

                $this->assertSame(
                    SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_CREATE,
                    $method
                );
                $this->assertArrayNotHasKey('source_type', $params);
                $this->assertCount(1, $params['source_bindings'] ?? []);
                $binding = $params['source_bindings'][0];
                $this->assertSame('teamshare', $binding['provider'] ?? null);
                $this->assertSame('knowledge_base', $binding['root_type'] ?? null);
                $this->assertSame('877886470862843904', $binding['root_ref'] ?? null);
                $this->assertSame([], $binding['targets'] ?? null);

                return [
                    'code' => 'KB-ENTERPRISE-INFERRED-FALLBACK',
                ];
            });

        $client = new KnowledgeBaseRpcClient($manager);
        $result = $client->create(KnowledgeBaseRequestDTO::forCreate(
            [
                'name' => '企业知识库',
                'document_files' => [
                    [
                        'type' => 2,
                        'name' => '团队知识库-1',
                        'platform_type' => 'teamshare',
                        'third_file_id' => '877886470862843904',
                        'file_type' => 9,
                        'space_type' => 8,
                    ],
                ],
            ],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame('KB-ENTERPRISE-INFERRED-FALLBACK', $result['code']);
    }

    public function testCreateRejectsStrictEnterpriseLegacyDocumentFilesWithoutKnowledgeBaseRootSemantic(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_THIRD_PLATFORM_DOCUMENT . '.' . SvcMethods::METHOD_EXPAND,
                $this->isType('array')
            )
            ->willReturn([
                'code' => 500,
                'message' => 'expand failed',
            ]);

        $client = new KnowledgeBaseRpcClient($manager);

        try {
            $client->create(KnowledgeBaseRequestDTO::forCreate(
                [
                    'name' => '企业知识库',
                    'source_type' => 1001,
                    'document_files' => [
                        [
                            'type' => 2,
                            'name' => '团队文档-1',
                            'platform_type' => 'teamshare',
                            'third_file_id' => 'FILE-1',
                            'file_type' => 2,
                            'space_type' => 2,
                        ],
                    ],
                ],
                new DataIsolationDTO('DT001', 'U1')
            ));
            $this->fail('Expected BusinessException to be thrown');
        } catch (BusinessException $exception) {
            $this->assertSame(FlowErrorCode::ValidateFailed->value, $exception->getCode());
            $this->assertSame(
                'legacy document_files must identify a teamshare knowledge_base root when source_type is enterprise',
                $exception->getMessage()
            );
        }
    }

    public function testUpdatePrefersExplicitSourceBindingsOverLegacyDocumentFiles(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_UPDATE,
                $this->callback(static function (array $params): bool {
                    return count($params['source_bindings']) === 1
                        && $params['source_bindings'][0]['provider'] === 'project'
                        && $params['source_bindings'][0]['root_ref'] === 'project-1';
                })
            )
            ->willReturn([
                'code' => 'KB1',
            ]);

        $client = new KnowledgeBaseRpcClient($manager);
        $result = $client->update(KnowledgeBaseRequestDTO::forUpdate(
            'KB1',
            [
                'source_bindings' => [
                    [
                        'provider' => 'project',
                        'root_type' => 'project',
                        'root_ref' => 'project-1',
                    ],
                ],
                'document_files' => [
                    [
                        'name' => 'ignored.txt',
                        'key' => 'DT001/path/ignored.txt',
                    ],
                ],
            ],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame('KB1', $result['code']);
    }

    public function testRebuildUsesExpectedMethodAndDefaultPayload(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_REBUILD,
                $this->callback(static function (array $params): bool {
                    return $params['scope'] === 'all'
                        && $params['mode'] === 'auto'
                        && $params['organization_code'] === ''
                        && $params['knowledge_organization_code'] === ''
                        && $params['knowledge_base_code'] === ''
                        && $params['document_code'] === ''
                        && $params['target_model'] === ''
                        && $params['concurrency'] === 0
                        && $params['batch_size'] === 0
                        && $params['retry'] === 0
                        && $params['data_isolation']['organization_code'] === 'DT001';
                })
            )
            ->willReturn([
                'status' => 'accepted',
                'run_id' => 'r-100',
            ]);

        $client = new KnowledgeBaseRpcClient($manager);
        $result = $client->rebuild(KnowledgeBaseRequestDTO::forRebuild(
            [],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame('accepted', $result['status']);
        $this->assertSame('r-100', $result['run_id']);
    }

    public function testRebuildMapsOrganizationScopePayload(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_REBUILD,
                $this->callback(static function (array $params): bool {
                    return $params['scope'] === 'organization'
                        && $params['organization_code'] === 'DT001'
                        && $params['knowledge_organization_code'] === 'ORG900'
                        && $params['knowledge_base_code'] === ''
                        && $params['document_code'] === ''
                        && $params['mode'] === 'bluegreen'
                        && $params['target_model'] === 'text-embedding-3-large'
                        && $params['target_dimension'] === 3072
                        && $params['concurrency'] === 4
                        && $params['batch_size'] === 128
                        && $params['retry'] === 2;
                })
            )
            ->willReturn([
                'status' => 'accepted',
                'run_id' => 'r-running',
            ]);

        $client = new KnowledgeBaseRpcClient($manager);
        $result = $client->rebuild(KnowledgeBaseRequestDTO::forRebuild(
            [
                'scope' => 'organization',
                'organization_code' => 'DT001',
                'knowledge_organization_code' => 'ORG900',
                'mode' => 'bluegreen',
                'target_model' => 'text-embedding-3-large',
                'target_dimension' => 3072,
                'concurrency' => 4,
                'batch_size' => 128,
                'retry' => 2,
            ],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame('accepted', $result['status']);
        $this->assertSame('r-running', $result['run_id']);
    }

    public function testRebuildMapsDocumentScopePayload(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_REBUILD,
                $this->callback(static function (array $params): bool {
                    return $params['scope'] === 'document'
                        && $params['organization_code'] === 'DT001'
                        && $params['knowledge_organization_code'] === 'ORG900'
                        && $params['knowledge_base_code'] === 'KB001'
                        && $params['document_code'] === 'DOC001'
                        && $params['mode'] === 'bluegreen';
                })
            )
            ->willReturn([
                'status' => 'accepted',
                'run_id' => 'r-doc',
            ]);

        $client = new KnowledgeBaseRpcClient($manager);
        $result = $client->rebuild(KnowledgeBaseRequestDTO::forRebuild(
            [
                'scope' => 'document',
                'organization_code' => 'DT001',
                'knowledge_organization_code' => 'ORG900',
                'knowledge_base_code' => 'KB001',
                'document_code' => 'DOC001',
                'mode' => 'bluegreen',
            ],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame('accepted', $result['status']);
        $this->assertSame('r-doc', $result['run_id']);
    }

    public function testRepairSourceBindingsUsesExpectedMethodAndPayload(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_REPAIR_SOURCE_BINDINGS,
                $this->callback(static function (array $params): bool {
                    return $params['third_platform_type'] === 'teamshare'
                        && $params['batch_size'] === 256
                        && $params['data_isolation']['organization_code'] === 'DT001'
                        && $params['data_isolation']['user_id'] === 'U1';
                })
            )
            ->willReturn([
                'status' => 'accepted',
                'task_id' => 'repair-source-bindings-1',
                'organization_code' => 'DT001',
                'third_platform_type' => 'teamshare',
            ]);

        $client = new KnowledgeBaseRpcClient($manager);
        $result = $client->repairSourceBindings(KnowledgeBaseRequestDTO::forRepairSourceBindings(
            [
                'third_platform_type' => 'teamshare',
                'batch_size' => 256,
            ],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame('accepted', $result['status']);
        $this->assertSame('repair-source-bindings-1', $result['task_id']);
        $this->assertSame('DT001', $result['organization_code']);
    }

    public function testSaveProcessUsesExpectedMethodAndPayload(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_SAVE_PROCESS,
                $this->callback(static function (array $params): bool {
                    return $params['code'] === 'KB1'
                        && $params['expected_num'] === 10
                        && $params['completed_num'] === 3
                        && $params['data_isolation']['organization_code'] === 'DT001'
                        && $params['updated_uid'] === 'U1';
                })
            )
            ->willReturn([
                'code' => 'KB1',
                'expected_num' => 10,
                'completed_num' => 3,
            ]);

        $client = new KnowledgeBaseRpcClient($manager);
        $result = $client->saveProcess(KnowledgeBaseRequestDTO::forSaveProcess(
            'KB1',
            [
                'expected_num' => 10,
                'completed_num' => 3,
            ],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame('KB1', $result['code']);
        $this->assertSame(3, $result['completed_num']);
    }
}
