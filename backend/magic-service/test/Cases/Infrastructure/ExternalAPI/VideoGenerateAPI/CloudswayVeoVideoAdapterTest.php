<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVeoVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoClient;
use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Response;
use Hyperf\Guzzle\ClientFactory;
use PHPUnit\Framework\TestCase;
use RuntimeException;

/**
 * @internal
 */
class CloudswayVeoVideoAdapterTest extends TestCase
{
    private const string ENDPOINT_ID = 'LCnVzCkkMnVulyrz';

    public function testResolveGenerationConfigForFastModelHidesUnsupportedReferenceImages(): void
    {
        $adapter = new CloudswayVeoVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));

        $config = $adapter->resolveGenerationConfig(self::ENDPOINT_ID, 'veo-3.1-fast-generate-preview');

        $this->assertNotNull($config);
        $this->assertSame(['text_prompt', 'image', 'last_frame'], $config->toArray()['supported_inputs']);
        $this->assertSame(0, $config->toArray()['reference_images']['max_count']);
        $this->assertSame([], $config->toArray()['reference_images']['reference_types']);
        $this->assertFalse($config->toArray()['reference_images']['style_supported']);
        $this->assertSame(8, $config->toArray()['generation']['default_duration_seconds']);
        $this->assertSame('720p', $config->toArray()['generation']['default_resolution']);
        $this->assertSame(['allow_adult', 'dont_allow'], $config->toArray()['generation']['person_generation_options']);
        $this->assertSame(['optimized', 'lossless'], $config->toArray()['generation']['compression_quality_options']);
        $this->assertSame(['pad', 'crop'], $config->toArray()['generation']['resize_mode_options']);
        $this->assertSame([1, 4], $config->toArray()['generation']['sample_count_range']);
        $this->assertSame([0, 4294967295], $config->toArray()['generation']['seed_range']);
        $this->assertTrue($config->toArray()['generation']['supports_enhance_prompt']);
        $this->assertSame([], $config->toArray()['constraints']);
    }

    public function testResolveGenerationConfigForProModelExposesReferenceImageConstraint(): void
    {
        $adapter = new CloudswayVeoVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));

        $config = $adapter->resolveGenerationConfig(self::ENDPOINT_ID, 'veo-3.1-generate-preview');

        $this->assertNotNull($config);
        $this->assertContains('reference_images', $config->toArray()['supported_inputs']);
        $this->assertSame(3, $config->toArray()['reference_images']['max_count']);
        $this->assertSame(['asset'], $config->toArray()['reference_images']['reference_types']);
        $this->assertFalse($config->toArray()['reference_images']['style_supported']);
        $this->assertSame([
            'reference_images_requires_duration_seconds' => 8,
        ], $config->toArray()['constraints']);
    }

    public function testBuildProviderPayloadMapsPromptFramesReferenceImagesAndGeneration(): void
    {
        $adapter = new CloudswayVeoVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-veo-1',
            endpoint: 'video:veo-3.1-generate-preview',
            model: 'veo-3.1-generate-preview',
            modelVersion: self::ENDPOINT_ID,
            providerModelId: 'provider-model-veo',
            providerCode: 'Cloudsway',
            providerName: 'cloudsway',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'prompt' => 'make a veo video',
                'inputs' => [
                    'frames' => [
                        ['role' => 'start', 'uri' => 'https://example.com/start.png'],
                        ['role' => 'end', 'uri' => 'https://example.com/end.png'],
                    ],
                    'reference_images' => [
                        ['uri' => 'https://example.com/ref.png', 'type' => 'asset'],
                    ],
                ],
                'generation' => [
                    'aspect_ratio' => '16:9',
                    'duration_seconds' => 8,
                    'resolution' => '1080p',
                    'generate_audio' => true,
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('make a veo video', $payload['instances'][0]['prompt']);
        $this->assertSame('https://example.com/start.png', $payload['instances'][0]['image']['gcsUri']);
        $this->assertSame('https://example.com/end.png', $payload['instances'][0]['lastFrame']['gcsUri']);
        $this->assertSame('https://example.com/ref.png', $payload['instances'][0]['referenceImages'][0]['image']['gcsUri']);
        $this->assertSame('16:9', $payload['parameters']['aspectRatio']);
        $this->assertSame(8, $payload['parameters']['durationSeconds']);
        $this->assertSame('1080p', $payload['parameters']['resolution']);
        $this->assertTrue($payload['parameters']['generateAudio']);
    }

    public function testBuildProviderPayloadAlwaysIncludesRequiredParametersForTextToVideo(): void
    {
        $adapter = new CloudswayVeoVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-veo-required-params',
            endpoint: 'video:veo-3.1-generate-preview',
            model: 'veo-3.1-generate-preview',
            modelVersion: self::ENDPOINT_ID,
            providerModelId: 'provider-model-veo',
            providerCode: 'Cloudsway',
            providerName: 'cloudsway',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'prompt' => 'make a veo video',
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertArrayHasKey('parameters', $payload);
        $this->assertSame(8, $payload['parameters']['durationSeconds']);
        $this->assertSame('720p', $payload['parameters']['resolution']);
    }

    public function testBuildProviderPayloadIgnoresReferenceImagesForFastModel(): void
    {
        $adapter = new CloudswayVeoVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-veo-fast-ref-images',
            endpoint: 'video:veo-3.1-fast-generate-preview',
            model: 'veo-3.1-fast-generate-preview',
            modelVersion: self::ENDPOINT_ID,
            providerModelId: 'provider-model-veo-fast',
            providerCode: 'Cloudsway',
            providerName: 'cloudsway',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'prompt' => 'make a veo fast video',
                'inputs' => [
                    'reference_images' => [
                        ['uri' => 'https://example.com/ref.png', 'type' => 'asset'],
                    ],
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertArrayNotHasKey('referenceImages', $payload['instances'][0]);
        $this->assertContains('inputs.reference_images', $operation->getIgnoredParams());
    }

    public function testBuildProviderPayloadForReferenceImagesForcesEightSecondDurationAndDropsStyle(): void
    {
        $adapter = new CloudswayVeoVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-veo-pro-ref-images',
            endpoint: 'video:veo-3.1-generate-preview',
            model: 'veo-3.1-generate-preview',
            modelVersion: self::ENDPOINT_ID,
            providerModelId: 'provider-model-veo-pro',
            providerCode: 'Cloudsway',
            providerName: 'cloudsway',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'prompt' => 'make a veo pro video',
                'inputs' => [
                    'reference_images' => [
                        ['uri' => 'https://example.com/ref-asset.png', 'type' => 'asset'],
                        ['uri' => 'https://example.com/ref-style.png', 'type' => 'style'],
                    ],
                ],
                'generation' => [
                    'duration_seconds' => 6,
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame(8, $payload['parameters']['durationSeconds']);
        $this->assertCount(1, $payload['instances'][0]['referenceImages']);
        $this->assertSame('asset', $payload['instances'][0]['referenceImages'][0]['referenceType']);
        $this->assertContains('generation.duration_seconds', $operation->getIgnoredParams());
        $this->assertContains('inputs.reference_images', $operation->getIgnoredParams());
    }

    public function testBuildProviderPayloadFiltersUnsupportedDocumentedGenerationValues(): void
    {
        $adapter = new CloudswayVeoVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-veo-filter',
            endpoint: 'video:veo-3.1-generate-preview',
            model: 'veo-3.1-generate-preview',
            modelVersion: self::ENDPOINT_ID,
            providerModelId: 'provider-model-veo',
            providerCode: 'Cloudsway',
            providerName: 'cloudsway',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'prompt' => 'make a veo video',
                'generation' => [
                    'aspect_ratio' => '1:1',
                    'duration_seconds' => 5,
                    'resolution' => '480p',
                    'size' => '1024x1024',
                    'generate_audio' => true,
                    'person_generation' => 'allow_all',
                    'compression_quality' => 'medium',
                    'resize_mode' => 'stretch',
                    'sample_count' => 5,
                    'seed' => -1,
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame([
            'generateAudio' => true,
            'durationSeconds' => 8,
            'resolution' => '720p',
        ], $payload['parameters']);
        $this->assertContains('generation.aspect_ratio', $operation->getIgnoredParams());
        $this->assertContains('generation.duration_seconds', $operation->getIgnoredParams());
        $this->assertContains('generation.resolution', $operation->getIgnoredParams());
        $this->assertContains('generation.size', $operation->getIgnoredParams());
        $this->assertContains('generation.person_generation', $operation->getIgnoredParams());
        $this->assertContains('generation.compression_quality', $operation->getIgnoredParams());
        $this->assertContains('generation.resize_mode', $operation->getIgnoredParams());
        $this->assertContains('generation.sample_count', $operation->getIgnoredParams());
        $this->assertContains('generation.seed', $operation->getIgnoredParams());
    }

    public function testQueryMapsDoneResponseToSucceededOutput(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->with(
                'https://genaiapi.cloudsway.net/v1/ai/' . self::ENDPOINT_ID . '/veo/videos/task',
                [
                    'headers' => [
                        'Authorization' => 'Bearer secret',
                        'Content-Type' => 'application/json',
                    ],
                    'json' => [
                        'operationName' => 'operation-123',
                    ],
                ],
            )
            ->willReturn(new Response(200, [], json_encode([
                'done' => true,
                'response' => [
                    'videos' => [
                        ['gcsUri' => 'https://example.com/video.mp4', 'mimeType' => 'video/mp4'],
                    ],
                ],
            ], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $adapter = new CloudswayVeoVideoAdapter(new CloudswayVideoClient($clientFactory));
        $result = $adapter->query(
            new VideoQueueOperationEntity(
                id: 'op-veo-2',
                endpoint: 'video:veo-3.1-generate-preview',
                model: 'veo-3.1-generate-preview',
                modelVersion: self::ENDPOINT_ID,
                providerModelId: 'provider-model-veo',
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
            'operation-123',
        );

        $this->assertSame('succeeded', $result['status']);
        $this->assertSame('https://example.com/video.mp4', $result['output']['video_url']);
    }

    public function testQueryFailsWhenModelVersionIsMissing(): void
    {
        $adapter = new CloudswayVeoVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('cloudsway endpoint id missing');

        $adapter->query(
            new VideoQueueOperationEntity(
                id: 'op-veo-missing-model-version',
                endpoint: 'video:veo-3.1-generate-preview',
                model: 'veo-3.1-generate-preview',
                modelVersion: '',
                providerModelId: 'provider-model-veo',
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
            'operation-missing-model-version',
        );
    }

    public function testSupportsModelRejectsLegacySemanticModelVersionWithoutKnownModelId(): void
    {
        $adapter = new CloudswayVeoVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));

        $this->assertFalse($adapter->supportsModel('MaaS_Veo_3.1_generate_preview', ''));
    }
}
