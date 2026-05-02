<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling;

use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Adapter\KelingOmniVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Adapter\KelingV3VideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Adapter\KelingVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Capability\KelingOmniGenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Capability\KelingV3GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\KelingTransportFactory;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\KelingVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Transport\ApiKeyKelingTransport;
use Hyperf\Guzzle\ClientFactory;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * @internal
 */
class KelingVideoAdapterRouterTest extends TestCase
{
    public function testSupportsModelMatchesAnyRegisteredAdapter(): void
    {
        $router = $this->createRouter();

        $this->assertTrue($router->supportsModel('kling-v3-omni', 'keling-video'));
        $this->assertTrue($router->supportsModel('YGNqszpCuuWLpyUt', 'keling-3.0-video'));
        $this->assertFalse($router->supportsModel('unknown-version', 'unknown-model'));
    }

    public function testBuildProviderPayloadDelegatesToMatchingAdapter(): void
    {
        $router = $this->createRouter();

        $operation = $this->createOperation('keling-video', 'kling-v3-omni');
        $operation->setRawRequest([
            'prompt' => '保持主体一致',
            'inputs' => [],
            'generation' => [],
        ]);

        $payload = $router->buildProviderPayload($operation);
        $this->assertSame('kling-v3-omni', $payload['model_name']);
    }

    public function testBuildProviderPayloadDelegatesToMatchingV3Adapter(): void
    {
        $router = $this->createRouter();

        $operation = $this->createOperation('keling-3.0-video', 'YGNqszpCuuWLpyUt');
        $operation->setRawRequest([
            'prompt' => '保持主体一致',
            'inputs' => [],
            'generation' => [],
        ]);

        $payload = $router->buildProviderPayload($operation);
        $this->assertSame('kling-v3', $payload['model_name']);
    }

    public function testBuildProviderPayloadThrowsWhenNoAdapterMatches(): void
    {
        $router = $this->createRouter();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('unsupported Keling video model: unknown-model (unknown-version)');

        $router->buildProviderPayload($this->createOperation('unknown-model', 'unknown-version'));
    }

    private function createRouter(): KelingVideoAdapterRouter
    {
        return new KelingVideoAdapterRouter(
            new KelingOmniVideoAdapter(
                new KelingOmniGenerationCapabilityProvider(),
                new KelingTransportFactory(
                    new ApiKeyKelingTransport(
                        new KelingVideoClient($this->createMock(ClientFactory::class))
                    )
                )
            ),
            new KelingV3VideoAdapter(
                new KelingV3GenerationCapabilityProvider(),
                new KelingTransportFactory(
                    new ApiKeyKelingTransport(
                        new KelingVideoClient($this->createMock(ClientFactory::class))
                    )
                )
            )
        );
    }

    private function createOperation(string $modelId, string $modelVersion): VideoQueueOperationEntity
    {
        return new VideoQueueOperationEntity(
            id: 'op-router-1',
            endpoint: 'video:' . $modelId,
            model: $modelId,
            modelVersion: $modelVersion,
            providerModelId: 'provider-model',
            providerCode: 'Keling',
            providerName: 'keling',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: ['prompt' => 'test'],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );
    }
}
