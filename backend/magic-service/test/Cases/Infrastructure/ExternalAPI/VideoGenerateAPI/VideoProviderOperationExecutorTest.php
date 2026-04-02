<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayKelingVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswaySeedanceVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVeoVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoGenerateFactory;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoProviderOperationExecutor;
use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Response;
use Hyperf\Guzzle\ClientFactory;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * @internal
 */
class VideoProviderOperationExecutorTest extends TestCase
{
    public function testExecutorRoutesCloudswayProviderUsingOperationModelVersionAsEndpointId(): void
    {
        $operation = $this->createOperation(
            model: 'veo-3.1-fast-generate-preview',
            modelVersion: 'LCnVzCkkMnVulyrz',
            providerCode: ProviderCode::Cloudsway->value,
            rawRequest: [
                'prompt' => 'make a cloudsway video',
                'generation' => [
                    'aspect_ratio' => '16:9',
                    'resolution' => '1080p',
                ],
            ],
        );
        $config = new QueueExecutorConfig('https://genaiapi.cloudsway.net', 'secret', 3, 20);

        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->with(
                'https://genaiapi.cloudsway.net/v1/ai/LCnVzCkkMnVulyrz/veo/videos/generate',
                [
                    'headers' => [
                        'Authorization' => 'Bearer secret',
                        'Content-Type' => 'application/json',
                    ],
                    'json' => [
                        'instances' => [
                            ['prompt' => 'make a cloudsway video'],
                        ],
                        'parameters' => [
                            'aspectRatio' => '16:9',
                            'resolution' => '1080p',
                        ],
                    ],
                ],
            )
            ->willReturn(new Response(200, [], json_encode([
                'name' => 'cloudsway-operation-123',
            ], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $executor = new VideoProviderOperationExecutor(
            new VideoGenerateFactory(
                $this->createCloudswayRouter($clientFactory),
            ),
        );

        $this->assertSame('cloudsway-operation-123', $executor->submit($operation, $config));
        $this->assertSame([
            'instances' => [
                ['prompt' => 'make a cloudsway video'],
            ],
            'parameters' => [
                'aspectRatio' => '16:9',
                'resolution' => '1080p',
            ],
        ], $operation->getProviderPayload());
    }

    public function testExecutorFailsFastWhenNoAdapterSupportsOperation(): void
    {
        $executor = new VideoProviderOperationExecutor(
            new VideoGenerateFactory(
                $this->createCloudswayRouter($this->createMock(ClientFactory::class)),
            ),
        );

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('video generation adapter not found');

        $executor->submit(
            $this->createOperation(
                model: 'sora-2',
                modelVersion: 'sora2',
                providerCode: ProviderCode::OpenAI->value,
            ),
            new QueueExecutorConfig('https://video-proxy.internal', 'secret', 3, 20),
        );
    }

    private function createOperation(
        string $model = 'veo-3.1-fast-generate-preview',
        string $modelVersion = 'LCnVzCkkMnVulyrz',
        string $providerCode = 'Cloudsway',
        array $rawRequest = ['prompt' => 'make a video'],
    ): VideoQueueOperationEntity {
        return new VideoQueueOperationEntity(
            id: 'op-1',
            endpoint: 'video:' . $model,
            model: $model,
            modelVersion: $modelVersion,
            providerModelId: 'provider-model',
            providerCode: $providerCode,
            providerName: 'cloudsway',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: $rawRequest,
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );
    }

    private function createCloudswayRouter(ClientFactory $clientFactory): CloudswayVideoAdapterRouter
    {
        return new CloudswayVideoAdapterRouter(
            new CloudswayVeoVideoAdapter(new CloudswayVideoClient($clientFactory)),
            new CloudswaySeedanceVideoAdapter(new CloudswayVideoClient($clientFactory)),
            new CloudswayKelingVideoAdapter(new CloudswayVideoClient($clientFactory)),
        );
    }
}
