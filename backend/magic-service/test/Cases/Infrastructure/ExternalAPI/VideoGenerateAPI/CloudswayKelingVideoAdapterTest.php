<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayKelingVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswaySeedanceVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVeoVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoClient;
use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Response;
use Hyperf\Guzzle\ClientFactory;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class CloudswayKelingVideoAdapterTest extends TestCase
{
    private const string ENDPOINT_ID = 'YGNqszpCuuWLpyUt';

    public function testResolveGenerationConfigExposesResolutionDefaults(): void
    {
        $adapter = new CloudswayKelingVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));

        $config = $adapter->resolveGenerationConfig(self::ENDPOINT_ID, 'keling-3.0-video');

        $this->assertNotNull($config);
        $this->assertSame(['720p', '1080p'], $config->toArray()['generation']['resolutions']);
        $this->assertSame(5, $config->toArray()['generation']['default_duration_seconds']);
        $this->assertSame('720p', $config->toArray()['generation']['default_resolution']);
        $this->assertArrayNotHasKey('sizes', $config->toArray()['generation']);
        $this->assertSame(
            ['standard', 'image_reference', 'keyframe_guided'],
            array_keys($config->toArray()['input_modes'])
        );
    }

    public function testBuildProviderPayloadMapsResolutionToModeAndAudioOptions(): void
    {
        $adapter = new CloudswayKelingVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-keling-1',
            endpoint: 'video:keling-3.0-video',
            model: 'keling-3.0-video',
            modelVersion: self::ENDPOINT_ID,
            providerModelId: 'provider-model-keling',
            providerCode: 'Cloudsway',
            providerName: 'cloudsway',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'prompt' => 'make a keling video',
                'inputs' => [
                    'frames' => [
                        ['role' => 'start', 'uri' => 'https://example.com/start.png'],
                        ['role' => 'end', 'uri' => 'https://example.com/end.png'],
                    ],
                ],
                'generation' => [
                    'resolution' => '1080p',
                    'aspect_ratio' => '9:16',
                    'duration_seconds' => 10,
                    'negative_prompt' => 'no blur',
                    'generate_audio' => true,
                    'watermark' => false,
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('kling-v3', $payload['model_name']);
        $this->assertSame('https://example.com/start.png', $payload['image']);
        $this->assertSame('https://example.com/end.png', $payload['image_tail']);
        $this->assertSame('pro', $payload['mode']);
        $this->assertSame('9:16', $payload['aspect_ratio']);
        $this->assertSame('10', $payload['duration']);
        $this->assertSame('no blur', $payload['negative_prompt']);
        $this->assertSame('on', $payload['sound']);
        $this->assertSame(['enabled' => false], $payload['watermark_info']);
    }

    public function testBuildProviderPayloadFiltersUnsupportedDocumentedGenerationValues(): void
    {
        $adapter = new CloudswayKelingVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-keling-filter',
            endpoint: 'video:keling-3.0-video',
            model: 'keling-3.0-video',
            modelVersion: self::ENDPOINT_ID,
            providerModelId: 'provider-model-keling',
            providerCode: 'Cloudsway',
            providerName: 'cloudsway',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'prompt' => 'make a keling video',
                'generation' => [
                    'mode' => 'ultra',
                    'resolution' => '4k',
                    'aspect_ratio' => '21:9',
                    'duration_seconds' => 16,
                    'negative_prompt' => 'no blur',
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('no blur', $payload['negative_prompt']);
        $this->assertSame('std', $payload['mode']);
        $this->assertArrayNotHasKey('aspect_ratio', $payload);
        $this->assertSame('5', $payload['duration']);
        $this->assertContains('generation.mode', $operation->getIgnoredParams());
        $this->assertContains('generation.resolution', $operation->getIgnoredParams());
        $this->assertContains('generation.aspect_ratio', $operation->getIgnoredParams());
        $this->assertContains('generation.duration_seconds', $operation->getIgnoredParams());
    }

    public function testBuildProviderPayloadDefaultsModeWhenResolutionMissing(): void
    {
        $adapter = new CloudswayKelingVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-keling-default-mode',
            endpoint: 'video:keling-3.0-video',
            model: 'keling-3.0-video',
            modelVersion: self::ENDPOINT_ID,
            providerModelId: 'provider-model-keling',
            providerCode: 'Cloudsway',
            providerName: 'cloudsway',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'prompt' => 'make a keling video',
                'generation' => [],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('std', $payload['mode']);
        $this->assertSame('5', $payload['duration']);
    }

    public function testQueryMapsTaskResultToSucceededOutput(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('get')
            ->with(
                'https://genaiapi.cloudsway.net/v1/ai/' . self::ENDPOINT_ID . '/kling/videos/image2video/task-123',
                [
                    'headers' => [
                        'Authorization' => 'Bearer secret',
                        'Content-Type' => 'application/json',
                    ],
                ],
            )
            ->willReturn(new Response(200, [], json_encode([
                'code' => 0,
                'data' => [
                    'task_status' => 'succeed',
                    'task_result' => [
                        'videos' => [
                            ['url' => 'https://example.com/keling.mp4'],
                        ],
                    ],
                ],
            ], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $adapter = new CloudswayKelingVideoAdapter(new CloudswayVideoClient($clientFactory));
        $result = $adapter->query(
            new VideoQueueOperationEntity(
                id: 'op-keling-2',
                endpoint: 'video:keling-3.0-video',
                model: 'keling-3.0-video',
                modelVersion: self::ENDPOINT_ID,
                providerModelId: 'provider-model-keling',
                providerCode: 'Cloudsway',
                providerName: 'cloudsway',
                organizationCode: 'org-1',
                userId: 'user-1',
                status: VideoOperationStatus::PROVIDER_RUNNING,
                seq: 1,
                rawRequest: [
                    'inputs' => [
                        'frames' => [
                            ['role' => 'start', 'uri' => 'https://example.com/start.png'],
                        ],
                    ],
                ],
                createdAt: date(DATE_ATOM),
                heartbeatAt: date(DATE_ATOM),
            ),
            new QueueExecutorConfig('https://genaiapi.cloudsway.net', 'secret', 3, 20),
            'task-123',
        );

        $this->assertSame('succeeded', $result['status']);
        $this->assertSame('https://example.com/keling.mp4', $result['output']['video_url']);
    }

    public function testRouterSelectsFamilyAdapters(): void
    {
        $router = new CloudswayVideoAdapterRouter(
            new CloudswayVeoVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class))),
            new CloudswaySeedanceVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class))),
            new CloudswayKelingVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class))),
        );

        $this->assertNotNull($router->resolveGenerationConfig('LCnVzCkkMnVulyrz', 'veo-3.1-generate-preview'));
        $this->assertNotNull($router->resolveGenerationConfig('rrpvTsUlqilBwMXg', 'seedance-1.5-pro'));
        $this->assertNotNull($router->resolveGenerationConfig(self::ENDPOINT_ID, 'keling-3.0-video'));
    }
}
