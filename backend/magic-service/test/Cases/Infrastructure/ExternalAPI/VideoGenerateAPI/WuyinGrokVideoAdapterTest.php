<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\WuyinGrokVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\WuyinVideoClient;
use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Response;
use Hyperf\Guzzle\ClientFactory;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class WuyinGrokVideoAdapterTest extends TestCase
{
    public function testResolveGenerationConfigReturnsConfiguredGrokCapability(): void
    {
        $adapter = $this->createAdapter();

        $config = $adapter->resolveGenerationConfig('grok_imagine', 'wuyin-grok-imagine');

        $this->assertNotNull($config);
        $this->assertSame(['text_prompt', 'reference_images'], $config->toArray()['supported_inputs']);
        $this->assertSame(1, $config->toArray()['reference_images']['max_count']);
        $this->assertSame([6, 10, 15], $config->toArray()['generation']['durations']);
        $this->assertArrayNotHasKey('sizes', $config->toArray()['generation']);
    }

    public function testBuildProviderPayloadMapsReferenceImagesAndIgnoresAspectRatioWhenImagePresent(): void
    {
        $adapter = $this->createAdapter();
        $operation = new VideoQueueOperationEntity(
            id: 'op-grok-1',
            endpoint: 'video:wuyin-grok-imagine',
            model: 'wuyin-grok-imagine',
            modelVersion: 'grok_imagine',
            providerModelId: 'provider-model-grok',
            providerCode: 'Wuyin',
            providerName: 'wuyin',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'task' => 'generate',
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
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame([
            'prompt' => 'make a grok video',
            'image_urls' => ['https://example.com/ref.png'],
            'duration' => '10',
        ], $payload);
        $this->assertSame([
            'prompt',
            'inputs.reference_images',
            'generation.duration_seconds',
        ], $operation->getAcceptedParams());
        $this->assertSame([
            'generation.aspect_ratio',
            'task',
        ], $operation->getIgnoredParams());
    }

    public function testQueryExtractsPosterUrlWhenProviderReturnsCoverField(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('get')
            ->willReturn(new Response(200, [], json_encode([
                'code' => 200,
                'msg' => '成功',
                'data' => [
                    'status' => 2,
                    'result' => [
                        [
                            'video_url' => 'https://example.com/video.mp4',
                            'cover_url' => 'https://example.com/poster.jpg',
                        ],
                    ],
                ],
            ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $adapter = new WuyinGrokVideoAdapter(new WuyinVideoClient($clientFactory));

        $result = $adapter->query(
            new VideoQueueOperationEntity(
                id: 'op-grok-2',
                endpoint: 'video:wuyin-grok-imagine',
                model: 'wuyin-grok-imagine',
                modelVersion: 'grok_imagine',
                providerModelId: 'provider-model-grok',
                providerCode: 'Wuyin',
                providerName: 'wuyin',
                organizationCode: 'org-1',
                userId: 'user-1',
                status: VideoOperationStatus::PROVIDER_RUNNING,
                seq: 1,
                createdAt: date(DATE_ATOM),
                heartbeatAt: date(DATE_ATOM),
            ),
            new QueueExecutorConfig('https://api.wuyinkeji.com', 'secret', 3, 20),
            'video_task_123',
        );

        $this->assertSame('succeeded', $result['status']);
        $this->assertSame('https://example.com/video.mp4', $result['output']['video_url']);
        $this->assertSame('https://example.com/poster.jpg', $result['output']['poster_url']);
    }

    private function createAdapter(): WuyinGrokVideoAdapter
    {
        return new WuyinGrokVideoAdapter(
            new WuyinVideoClient($this->createMock(ClientFactory::class))
        );
    }
}
