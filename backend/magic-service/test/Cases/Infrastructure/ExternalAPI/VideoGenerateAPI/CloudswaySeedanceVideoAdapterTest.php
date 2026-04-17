<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswaySeedanceVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoClient;
use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Response;
use Hyperf\Guzzle\ClientFactory;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class CloudswaySeedanceVideoAdapterTest extends TestCase
{
    private const string ENDPOINT_ID = 'rrpvTsUlqilBwMXg';

    public function testResolveGenerationConfigExposesDurationAndResolutionDefaults(): void
    {
        $adapter = new CloudswaySeedanceVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));

        $config = $adapter->resolveGenerationConfig(self::ENDPOINT_ID, 'seedance-1.5-pro');

        $this->assertNotNull($config);
        $this->assertSame(5, $config->toArray()['generation']['default_duration_seconds']);
        $this->assertSame('720p', $config->toArray()['generation']['default_resolution']);
        $this->assertSame(
            ['standard', 'image_reference', 'keyframe_guided'],
            array_keys($config->toArray()['input_modes'])
        );
    }

    public function testBuildProviderPayloadMapsPromptAndReferenceImage(): void
    {
        $adapter = new CloudswaySeedanceVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-seedance-1',
            endpoint: 'video:seedance-1.5-pro',
            model: 'seedance-1.5-pro',
            modelVersion: self::ENDPOINT_ID,
            providerModelId: 'provider-model-seedance',
            providerCode: 'Cloudsway',
            providerName: 'cloudsway',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'prompt' => 'a detective enters a room',
                'inputs' => [
                    'reference_images' => [
                        ['uri' => 'https://example.com/ref.png'],
                    ],
                ],
                'generation' => [
                    'aspect_ratio' => '16:9',
                    'duration_seconds' => 5,
                    'resolution' => '720p',
                    'generate_audio' => false,
                    'watermark' => false,
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('doubao-seedance-1-5-pro-251215', $payload['model']);
        $this->assertStringContainsString('--ratio 16:9', $payload['content'][0]['text']);
        $this->assertStringContainsString('--dur 5', $payload['content'][0]['text']);
        $this->assertSame('https://example.com/ref.png', $payload['content'][1]['image_url']['url']);
        $this->assertFalse($payload['generate_audio']);
        $this->assertFalse($payload['watermark']);
    }

    public function testBuildProviderPayloadDefaultsDurationAndResolutionPromptFlags(): void
    {
        $adapter = new CloudswaySeedanceVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-seedance-defaults',
            endpoint: 'video:seedance-1.5-pro',
            model: 'seedance-1.5-pro',
            modelVersion: self::ENDPOINT_ID,
            providerModelId: 'provider-model-seedance',
            providerCode: 'Cloudsway',
            providerName: 'cloudsway',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'prompt' => 'a detective enters a room',
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertStringContainsString('--dur 5', $payload['content'][0]['text']);
        $this->assertStringContainsString('--rs 720p', $payload['content'][0]['text']);
    }

    public function testBuildProviderPayloadMapsFirstAndLastFrameRoles(): void
    {
        $adapter = new CloudswaySeedanceVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-seedance-frames',
            endpoint: 'video:seedance-1.5-pro',
            model: 'seedance-1.5-pro',
            modelVersion: self::ENDPOINT_ID,
            providerModelId: 'provider-model-seedance',
            providerCode: 'Cloudsway',
            providerName: 'cloudsway',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'prompt' => 'a detective enters a room',
                'inputs' => [
                    'frames' => [
                        ['role' => 'start', 'uri' => 'https://example.com/start.png'],
                        ['role' => 'end', 'uri' => 'https://example.com/end.png'],
                    ],
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('https://example.com/start.png', $payload['content'][1]['image_url']['url']);
        $this->assertSame('first_frame', $payload['content'][1]['role']);
        $this->assertSame('https://example.com/end.png', $payload['content'][2]['image_url']['url']);
        $this->assertSame('last_frame', $payload['content'][2]['role']);
    }

    public function testBuildProviderPayloadFiltersUnsupportedDocumentedGenerationValues(): void
    {
        $adapter = new CloudswaySeedanceVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-seedance-filter',
            endpoint: 'video:seedance-1.5-pro',
            model: 'seedance-1.5-pro',
            modelVersion: self::ENDPOINT_ID,
            providerModelId: 'provider-model-seedance',
            providerCode: 'Cloudsway',
            providerName: 'cloudsway',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'prompt' => 'a detective enters a room',
                'generation' => [
                    'aspect_ratio' => '21:9',
                    'duration_seconds' => 7,
                    'resolution' => '4k',
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('a detective enters a room --dur 5 --rs 720p', $payload['content'][0]['text']);
        $this->assertContains('generation.aspect_ratio', $operation->getIgnoredParams());
        $this->assertContains('generation.duration_seconds', $operation->getIgnoredParams());
        $this->assertContains('generation.resolution', $operation->getIgnoredParams());
    }

    public function testQueryMapsSucceededResponse(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('get')
            ->with(
                'https://genaiapi.cloudsway.net/v1/ai/' . self::ENDPOINT_ID . '/seedance/contents/generations/tasks/task-123',
                [
                    'headers' => [
                        'Authorization' => 'Bearer secret',
                        'Content-Type' => 'application/json',
                    ],
                ],
            )
            ->willReturn(new Response(200, [], json_encode([
                'id' => 'task-123',
                'status' => 'succeeded',
                'content' => [
                    'video_url' => 'https://example.com/seedance.mp4',
                ],
            ], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $adapter = new CloudswaySeedanceVideoAdapter(new CloudswayVideoClient($clientFactory));
        $result = $adapter->query(
            new VideoQueueOperationEntity(
                id: 'op-seedance-2',
                endpoint: 'video:seedance-1.5-pro',
                model: 'seedance-1.5-pro',
                modelVersion: self::ENDPOINT_ID,
                providerModelId: 'provider-model-seedance',
                providerCode: 'Cloudsway',
                providerName: 'cloudsway',
                organizationCode: 'org-1',
                userId: 'user-1',
                status: VideoOperationStatus::PROVIDER_RUNNING,
                seq: 1,
                createdAt: date(DATE_ATOM),
                heartbeatAt: date(DATE_ATOM),
            ),
            new QueueExecutorConfig('https://genaiapi.cloudsway.net', 'secret', 3, 20),
            'task-123',
        );

        $this->assertSame('succeeded', $result['status']);
        $this->assertSame('https://example.com/seedance.mp4', $result['output']['video_url']);
    }
}
