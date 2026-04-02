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
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\WuyinGrokVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\WuyinVeoVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\WuyinVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\WuyinVideoClient;
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
    public function testExecutorRoutesWuyinProviderToAdapter(): void
    {
        $operation = $this->createOperation();
        $config = new QueueExecutorConfig('https://video-proxy.internal', 'secret', 3, 20);

        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->with(
                'https://video-proxy.internal/api/async/video_veo3.1_fast',
                [
                    'headers' => [
                        'Authorization' => 'secret',
                        'Content-Type' => 'application/json',
                    ],
                    'query' => [
                        'key' => 'secret',
                    ],
                    'json' => [
                        'prompt' => 'make a video',
                    ],
                ],
            )
            ->willReturn(new Response(200, [], json_encode([
                'code' => 200,
                'data' => [
                    'id' => 'video_task_123',
                ],
            ], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $executor = new VideoProviderOperationExecutor(
            new VideoGenerateFactory(
                $this->createWuyinRouter($clientFactory),
                $this->createCloudswayRouter($clientFactory),
            ),
        );

        $this->assertSame('video_task_123', $executor->submit($operation, $config));
        $this->assertSame(['prompt' => 'make a video'], $operation->getProviderPayload());
        $this->assertSame(['prompt'], $operation->getAcceptedParams());
        $this->assertSame([], $operation->getIgnoredParams());
    }

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
                $this->createWuyinRouter($clientFactory),
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

    public function testQueryExtractsVideoUrlFromResultArray(): void
    {
        $operation = $this->createOperation();
        $config = new QueueExecutorConfig('https://api.wuyinkeji.com', 'secret', 3, 20);

        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('get')
            ->with(
                'https://api.wuyinkeji.com/api/async/detail',
                [
                    'headers' => [
                        'Authorization' => 'secret',
                        'Content-Type' => 'application/json',
                    ],
                    'query' => [
                        'key' => 'secret',
                        'id' => 'video_task_123',
                    ],
                ],
            )
            ->willReturn(new Response(200, [], json_encode([
                'code' => 200,
                'msg' => '成功',
                'data' => [
                    'status' => 2,
                    'result' => [
                        'https://example.com/video.mp4',
                    ],
                ],
            ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $adapter = new WuyinVeoVideoAdapter(new WuyinVideoClient($clientFactory));

        $result = $adapter->query($operation, $config, 'video_task_123');

        $this->assertSame('succeeded', $result['status']);
        $this->assertSame('https://example.com/video.mp4', $result['output']['video_url']);
        $this->assertSame('video_task_123', $result['output']['provider_task_id']);
    }

    public function testExecutorRoutesWuyinGrokModelToGrokAdapter(): void
    {
        $operation = $this->createOperation(
            model: 'wuyin-grok-imagine',
            modelVersion: 'grok_imagine',
            rawRequest: [
                'prompt' => 'make a grok video',
                'inputs' => [
                    'reference_images' => [
                        ['uri' => 'https://example.com/ref.png'],
                    ],
                ],
                'generation' => [
                    'duration_seconds' => 10,
                    'aspect_ratio' => '16:9',
                ],
            ],
        );
        $config = new QueueExecutorConfig('https://video-proxy.internal', 'secret', 3, 20);

        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->with(
                'https://video-proxy.internal/api/async/video_grok_imagine',
                [
                    'headers' => [
                        'Authorization' => 'secret',
                        'Content-Type' => 'application/json',
                    ],
                    'query' => [
                        'key' => 'secret',
                    ],
                    'json' => [
                        'prompt' => 'make a grok video',
                        'image_urls' => ['https://example.com/ref.png'],
                        'duration' => '10',
                    ],
                ],
            )
            ->willReturn(new Response(200, [], json_encode([
                'code' => 200,
                'data' => [
                    'id' => 'video_task_grok_123',
                ],
            ], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $executor = new VideoProviderOperationExecutor(
            new VideoGenerateFactory(
                $this->createWuyinRouter($clientFactory),
                $this->createCloudswayRouter($clientFactory),
            ),
        );

        $this->assertSame('video_task_grok_123', $executor->submit($operation, $config));
        $this->assertSame([
            'prompt' => 'make a grok video',
            'image_urls' => ['https://example.com/ref.png'],
            'duration' => '10',
        ], $operation->getProviderPayload());
    }

    public function testExecutorFailsFastWhenNoAdapterSupportsOperation(): void
    {
        $executor = new VideoProviderOperationExecutor(
            new VideoGenerateFactory(
                $this->createWuyinRouter($this->createMock(ClientFactory::class)),
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
        string $modelVersion = 'veo3.1_fast',
        string $providerCode = 'Wuyin',
        array $rawRequest = ['prompt' => 'make a video'],
    ): VideoQueueOperationEntity {
        return new VideoQueueOperationEntity(
            id: 'op-1',
            endpoint: 'video:' . $model,
            model: $model,
            modelVersion: $modelVersion,
            providerModelId: 'provider-model',
            providerCode: $providerCode,
            providerName: 'wuyin',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: $rawRequest,
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );
    }

    private function createWuyinRouter(ClientFactory $clientFactory): WuyinVideoAdapterRouter
    {
        $client = new WuyinVideoClient($clientFactory);

        return new WuyinVideoAdapterRouter(
            new WuyinVeoVideoAdapter($client),
            new WuyinGrokVideoAdapter($client),
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
