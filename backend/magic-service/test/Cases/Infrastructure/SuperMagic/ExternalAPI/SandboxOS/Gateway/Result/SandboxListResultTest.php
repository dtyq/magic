<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result;

use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Constant\ResponseCode;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\Result\SandboxListResult;
use PHPUnit\Framework\TestCase;

/**
 * 网关沙箱清单（GET /api/v1/sandboxes）的解析契约。
 *
 * @internal
 */
class SandboxListResultTest extends TestCase
{
    public function testParsesGatewayListPayload(): void
    {
        $result = SandboxListResult::fromApiResponse([
            'code' => ResponseCode::SUCCESS,
            'message' => 'Sandbox list retrieved successfully',
            'data' => [
                'total' => 2,
                'sandboxes' => [
                    [
                        'sandbox_id' => 'warm-101',
                        'status' => 'Running',
                        'project_id' => '11',
                        'topic_id' => '101',
                        'warm_pool' => true,
                        'bound' => true,
                        'created_at' => '2026-09-01T08:30:00Z',
                        'agent_image' => 'registry/agent:5.0.92',
                        'agfs_image' => 'registry/agfs:1.0.14',
                    ],
                    [
                        'sandbox_id' => '102',
                        'status' => 'NotFound',
                    ],
                ],
            ],
        ]);

        self::assertTrue($result->isSuccess());
        self::assertSame(2, $result->getTotal());

        $sandboxes = $result->getSandboxes();
        self::assertCount(2, $sandboxes);

        // 清单字段现在以有类型的快照暴露：镜像字段是"是否需要重启"的唯一判据。
        $first = $sandboxes[0];
        self::assertSame('warm-101', $first->getSandboxId());
        self::assertSame('Running', $first->getStatus());
        self::assertSame('11', $first->getProjectId());
        self::assertSame('101', $first->getTopicId());
        self::assertTrue($first->isWarmPool());
        self::assertTrue($first->isBound());
        self::assertFalse($first->isUnboundWarmPool());
        self::assertSame('2026-09-01T08:30:00Z', $first->getCreatedAt());
        self::assertSame('registry/agent:5.0.92', $first->getAgentImage());
        self::assertSame('registry/agfs:1.0.14', $first->getAgfsImage());

        // 缺失字段一律降级为空值/未知，而不是猜一个默认值。
        $second = $sandboxes[1];
        self::assertSame('102', $second->getSandboxId());
        self::assertSame('NotFound', $second->getStatus());
        self::assertSame('', $second->getProjectId());
        self::assertSame('', $second->getTopicId());
        self::assertFalse($second->isWarmPool());
        self::assertFalse($second->isBound());
        self::assertSame('', $second->getCreatedAt());
        self::assertSame('', $second->getAgentImage());
        self::assertSame('', $second->getAgfsImage());

        self::assertSame(['Running' => 1, 'NotFound' => 1], $result->getStatusCounts());
    }

    public function testIgnoresEntriesWithoutSandboxId(): void
    {
        $result = SandboxListResult::fromApiResponse([
            'code' => ResponseCode::SUCCESS,
            'message' => 'ok',
            'data' => [
                'sandboxes' => [
                    ['status' => 'Running'],
                    ['sandbox_id' => 'warm-1', 'status' => 'Running'],
                ],
            ],
        ]);

        self::assertSame(1, $result->getTotal());
        self::assertSame(['Running' => 1], $result->getStatusCounts());
    }

    public function testFailedResponseKeepsErrorCode(): void
    {
        $result = SandboxListResult::fromApiResponse([
            'code' => ResponseCode::ERROR,
            'message' => 'gateway exploded',
            'data' => [],
        ]);

        self::assertFalse($result->isSuccess());
        self::assertSame('gateway exploded', $result->getMessage());
        self::assertSame(0, $result->getTotal());
        self::assertSame([], $result->getSandboxes());
    }
}
