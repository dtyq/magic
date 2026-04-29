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
class KnowledgeBaseRpcClientMultiBindingTest extends TestCase
{
    public function testCreatePassesMultipleProjectSourceBindings(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_CREATE,
                $this->callback(static function (array $params): bool {
                    if (($params['name'] ?? null) !== '多项目知识库') {
                        return false;
                    }
                    if (count($params['source_bindings'] ?? []) !== 2) {
                        return false;
                    }

                    $firstBinding = $params['source_bindings'][0];
                    $secondBinding = $params['source_bindings'][1];

                    return $firstBinding['provider'] === 'project'
                        && $firstBinding['root_type'] === 'project'
                        && $firstBinding['root_ref'] === 'PROJECT-A'
                        && $firstBinding['targets'] === [
                            ['target_type' => 'file', 'target_ref' => 'FILE-1'],
                        ]
                        && $secondBinding['provider'] === 'project'
                        && $secondBinding['root_type'] === 'project'
                        && $secondBinding['root_ref'] === 'PROJECT-B'
                        && $secondBinding['targets'] === [];
                })
            )
            ->willReturn([
                'code' => 'KB-MULTI-PROJECT',
            ]);

        $client = new KnowledgeBaseRpcClient($manager);
        $result = $client->create(KnowledgeBaseRequestDTO::forCreate(
            [
                'name' => '多项目知识库',
                'source_type' => 3,
                'source_bindings' => [
                    [
                        'provider' => 'project',
                        'root_type' => 'project',
                        'root_ref' => 'PROJECT-A',
                        'sync_mode' => 'manual',
                        'targets' => [
                            ['target_type' => 'file', 'target_ref' => 'FILE-1'],
                        ],
                    ],
                    [
                        'provider' => 'project',
                        'root_type' => 'project',
                        'root_ref' => 'PROJECT-B',
                        'sync_mode' => 'manual',
                        'targets' => [],
                    ],
                ],
            ],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame('KB-MULTI-PROJECT', $result['code']);
    }

    public function testUpdatePassesMultipleEnterpriseSourceBindings(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_KNOWLEDGE_BASE . '.' . SvcMethods::METHOD_UPDATE,
                $this->callback(static function (array $params): bool {
                    if (($params['code'] ?? null) !== 'KB-ENTERPRISE') {
                        return false;
                    }
                    if (count($params['source_bindings'] ?? []) !== 2) {
                        return false;
                    }

                    $firstBinding = $params['source_bindings'][0];
                    $secondBinding = $params['source_bindings'][1];

                    return $firstBinding['provider'] === 'teamshare'
                        && $firstBinding['root_type'] === 'knowledge_base'
                        && $firstBinding['root_ref'] === 'TS-KB-1'
                        && $firstBinding['targets'] === []
                        && $secondBinding['provider'] === 'teamshare'
                        && $secondBinding['root_type'] === 'knowledge_base'
                        && $secondBinding['root_ref'] === 'TS-KB-2'
                        && $secondBinding['targets'] === [
                            ['target_type' => 'folder', 'target_ref' => 'FOLDER-2'],
                        ];
                })
            )
            ->willReturn([
                'code' => 'KB-ENTERPRISE',
            ]);

        $client = new KnowledgeBaseRpcClient($manager);
        $result = $client->update(KnowledgeBaseRequestDTO::forUpdate(
            'KB-ENTERPRISE',
            [
                'source_type' => 1001,
                'source_bindings' => [
                    [
                        'provider' => 'teamshare',
                        'root_type' => 'knowledge_base',
                        'root_ref' => 'TS-KB-1',
                        'sync_mode' => 'manual',
                        'targets' => [],
                    ],
                    [
                        'provider' => 'teamshare',
                        'root_type' => 'knowledge_base',
                        'root_ref' => 'TS-KB-2',
                        'sync_mode' => 'manual',
                        'targets' => [
                            ['target_type' => 'folder', 'target_ref' => 'FOLDER-2'],
                        ],
                    ],
                ],
            ],
            new DataIsolationDTO('DT001', 'U1')
        ));

        $this->assertSame('KB-ENTERPRISE', $result['code']);
    }
}
