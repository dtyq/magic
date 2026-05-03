<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope;

use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Adapter\DashScopeVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Adapter\Wan27VideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoGenerateProviderType;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class DashScopeVideoAdapterRouterTest extends TestCase
{
    public function testProviderTypeMapsDashScopeProviderCode(): void
    {
        $this->assertSame(
            VideoGenerateProviderType::DashScope,
            VideoGenerateProviderType::fromProviderCode(ProviderCode::DashScope)
        );
    }

    public function testSupportsModelDelegatesToWan27Adapter(): void
    {
        $wan27VideoAdapter = $this->createMock(Wan27VideoAdapter::class);
        $wan27VideoAdapter->expects($this->once())
            ->method('supportsModel')
            ->with('wan2.7-t2v', 'wan2.7')
            ->willReturn(true);

        $router = new DashScopeVideoAdapterRouter($wan27VideoAdapter);

        $this->assertTrue($router->supportsModel('wan2.7-t2v', 'wan2.7'));
    }

    public function testBuildProviderPayloadDelegatesToWan27Adapter(): void
    {
        $operation = $this->createOperation();
        $expectedPayload = [
            'model' => 'wan2.7',
            'input' => [
                'prompt' => '生成一段视频',
            ],
        ];

        $wan27VideoAdapter = $this->createMock(Wan27VideoAdapter::class);
        $wan27VideoAdapter->expects($this->once())
            ->method('buildProviderPayload')
            ->with($operation)
            ->willReturn($expectedPayload);

        $router = new DashScopeVideoAdapterRouter($wan27VideoAdapter);

        $this->assertSame($expectedPayload, $router->buildProviderPayload($operation));
    }

    private function createOperation(): VideoQueueOperationEntity
    {
        return new VideoQueueOperationEntity(
            id: 'op-dashscope-router-1',
            endpoint: 'video:wan2.7',
            model: 'wan2.7',
            modelVersion: 'wan2.7-t2v',
            providerModelId: 'provider-model',
            providerCode: 'DashScope',
            providerName: 'dashscope',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: ['prompt' => '生成一段视频'],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );
    }
}
