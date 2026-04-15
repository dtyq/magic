<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\Rpc\JsonRpc\Client\Knowledge;

use App\Application\KnowledgeBase\DTO\DataIsolationDTO;
use App\Application\KnowledgeBase\DTO\KnowledgeBaseRequestDTO;
use App\Infrastructure\Rpc\JsonRpc\Client\Knowledge\TeamshareKnowledgeRpcClient;
use App\Infrastructure\Rpc\JsonRpc\RpcClientManager;
use App\Infrastructure\Rpc\Method\SvcMethods;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class TeamshareKnowledgeRpcClientTest extends TestCase
{
    public function testStartVectorShouldPassExpectedPayload(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_TEAMSHARE . '.' . SvcMethods::METHOD_START_VECTOR,
                $this->callback(static function (array $params): bool {
                    return ($params['knowledge_id'] ?? '') === '877886470862843904'
                        && ($params['data_isolation']['organization_code'] ?? '') === 'DT001'
                        && ($params['data_isolation']['user_id'] ?? '') === 'U1';
                })
            )
            ->willReturn([
                'id' => 'run-1',
            ]);

        $client = new TeamshareKnowledgeRpcClient($manager);
        $result = $client->startVector(KnowledgeBaseRequestDTO::forCreate(
            ['knowledge_id' => '877886470862843904'],
            new DataIsolationDTO('DT001', 'U1'),
        ));

        $this->assertSame('run-1', $result['id']);
    }

    public function testManageableShouldPassOnlyDataIsolation(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_TEAMSHARE . '.' . SvcMethods::METHOD_MANAGEABLE,
                $this->callback(static function (array $params): bool {
                    return array_keys($params) === ['data_isolation']
                        && ($params['data_isolation']['organization_code'] ?? '') === 'DT001'
                        && ($params['data_isolation']['user_id'] ?? '') === 'U1';
                })
            )
            ->willReturn([
                'list' => [],
            ]);

        $client = new TeamshareKnowledgeRpcClient($manager);
        $result = $client->manageable(KnowledgeBaseRequestDTO::forList(
            [],
            new DataIsolationDTO('DT001', 'U1'),
        ));

        $this->assertSame([], $result['list']);
    }

    public function testManageableProgressShouldNormalizeKnowledgeCodes(): void
    {
        $manager = $this->createMock(RpcClientManager::class);
        $manager->expects($this->once())
            ->method('call')
            ->with(
                SvcMethods::SERVICE_KNOWLEDGE_TEAMSHARE . '.' . SvcMethods::METHOD_MANAGEABLE_PROGRESS,
                $this->callback(static function (array $params): bool {
                    return ($params['knowledge_codes'] ?? []) === ['123', 'KNOWLEDGE-1']
                        && ($params['data_isolation']['organization_code'] ?? '') === 'DT001';
                })
            )
            ->willReturn([
                'list' => [
                    ['knowledge_code' => '123'],
                    ['knowledge_code' => 'KNOWLEDGE-1'],
                ],
            ]);

        $client = new TeamshareKnowledgeRpcClient($manager);
        $result = $client->manageableProgress(KnowledgeBaseRequestDTO::forCreate(
            ['knowledge_codes' => [123, 'KNOWLEDGE-1']],
            new DataIsolationDTO('DT001', 'U1'),
        ));

        $this->assertCount(2, $result['list']);
    }
}
