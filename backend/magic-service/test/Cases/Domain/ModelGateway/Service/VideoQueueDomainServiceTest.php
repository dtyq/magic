<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\Dto\CreateVideoDTO;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Domain\ModelGateway\Repository\VideoQueueOperationRepositoryInterface;
use App\Domain\ModelGateway\Service\VideoQueueDomainService;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayKelingVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoClient;
use Hyperf\Guzzle\ClientFactory;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class VideoQueueDomainServiceTest extends TestCase
{
    public function testCreateOperationCanonicalizes4kAndKeepsCanonicalSections(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'veo-3.1-generate-preview',
            'task' => 'generate',
            'prompt' => 'make the shot',
            'generation' => [
                'resolution' => '4K',
                'aspect_ratio' => '16:9',
            ],
            'callbacks' => [
                'webhook_url' => 'https://example.com/webhook',
            ],
            'execution' => [
                'service_tier' => 'flex',
                'expires_after_seconds' => 3600,
            ],
        ]);
        $requestDTO->valid();

        $operation = $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'LCnVzCkkMnVulyrz',
            'provider-model-veo-pro',
            ProviderCode::Cloudsway,
            $requestDTO,
            $this->createConfigForModel($requestDTO->getModel(), ProviderCode::Cloudsway),
        );

        $this->assertSame('4k', $operation->getRawRequest()['generation']['resolution']);
        $this->assertSame('flex', $operation->getRawRequest()['execution']['service_tier']);
        $this->assertSame('https://example.com/webhook', $operation->getRawRequest()['callbacks']['webhook_url']);
    }

    public function testCreateOperationNormalizesKelingModeToResolutionForProviderPayload(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'keling-3.0-video',
            'task' => 'generate',
            'prompt' => 'make the shot',
            'generation' => [
                'mode' => 'pro',
                'duration_seconds' => 5,
            ],
        ]);
        $requestDTO->valid();

        $operation = $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'YGNqszpCuuWLpyUt',
            'provider-model-keling',
            ProviderCode::Cloudsway,
            $requestDTO,
            $this->createConfigForModel($requestDTO->getModel(), ProviderCode::Cloudsway),
        );

        $adapter = new CloudswayKelingVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));
        $providerPayload = $adapter->buildProviderPayload($operation);

        $this->assertArrayNotHasKey('mode', $operation->getRawRequest()['generation']);
        $this->assertSame('1080p', $operation->getRawRequest()['generation']['resolution']);
        $this->assertSame('pro', $providerPayload['mode']);
        $this->assertContains('generation.resolution', $operation->getAcceptedParams());
    }

    public function testCreateOperationNormalizesKelingResolutionToDefaultModeWhenModeMissing(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'keling-3.0-video',
            'task' => 'generate',
            'prompt' => 'make the shot',
            'generation' => [
                'resolution' => '720p',
                'duration_seconds' => 5,
            ],
        ]);
        $requestDTO->valid();

        $operation = $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'YGNqszpCuuWLpyUt',
            'provider-model-keling',
            ProviderCode::Cloudsway,
            $requestDTO,
            $this->createConfigForModel($requestDTO->getModel(), ProviderCode::Cloudsway),
        );

        $adapter = new CloudswayKelingVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));
        $providerPayload = $adapter->buildProviderPayload($operation);

        $this->assertSame('720p', $operation->getRawRequest()['generation']['resolution']);
        $this->assertSame('std', $providerPayload['mode']);
    }

    public function testCreateOperationDefaultsKelingResolutionWhenModeAndResolutionMissing(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'keling-3.0-video',
            'task' => 'generate',
            'prompt' => 'make the shot',
            'generation' => [
                'duration_seconds' => 5,
            ],
        ]);
        $requestDTO->valid();

        $operation = $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'YGNqszpCuuWLpyUt',
            'provider-model-keling',
            ProviderCode::Cloudsway,
            $requestDTO,
            $this->createConfigForModel($requestDTO->getModel(), ProviderCode::Cloudsway),
        );

        $adapter = new CloudswayKelingVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));
        $providerPayload = $adapter->buildProviderPayload($operation);

        $this->assertSame('720p', $operation->getRawRequest()['generation']['resolution']);
        $this->assertSame('std', $providerPayload['mode']);
    }

    public function testCreateOperationDefaultsCloudswayVeoDurationAndResolutionWhenMissing(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'veo-3.1-fast-generate-preview',
            'task' => 'generate',
            'prompt' => 'make the shot',
        ]);
        $requestDTO->valid();

        $operation = $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'LCnVzCkkMnVulyrz',
            'provider-model-veo',
            ProviderCode::Cloudsway,
            $requestDTO,
            $this->createConfigForModel($requestDTO->getModel(), ProviderCode::Cloudsway),
        );

        $this->assertSame(8, $operation->getRawRequest()['generation']['duration_seconds']);
        $this->assertSame('720p', $operation->getRawRequest()['generation']['resolution']);
    }

    public function testCreateOperationForCloudswayVeoProForcesReferenceImageDurationConstraint(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'veo-3.1-generate-preview',
            'task' => 'generate',
            'prompt' => 'make the shot',
            'inputs' => [
                'reference_images' => [
                    ['uri' => 'https://example.com/ref.png', 'type' => 'asset'],
                ],
            ],
            'generation' => [
                'duration_seconds' => 6,
            ],
        ]);
        $requestDTO->valid();

        $operation = $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'LCnVzCkkMnVulyrz',
            'provider-model-veo-pro',
            ProviderCode::Cloudsway,
            $requestDTO,
            $this->createConfigForModel($requestDTO->getModel(), ProviderCode::Cloudsway),
        );

        $this->assertSame(8, $operation->getRawRequest()['generation']['duration_seconds']);
        $this->assertSame('asset', $operation->getRawRequest()['inputs']['reference_images'][0]['type']);
    }

    public function testCreateOperationDefaultsCloudswaySeedanceDurationAndResolutionWhenMissing(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'seedance-1.5-pro',
            'task' => 'generate',
            'prompt' => 'make the shot',
        ]);
        $requestDTO->valid();

        $operation = $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'rrpvTsUlqilBwMXg',
            'provider-model-seedance',
            ProviderCode::Cloudsway,
            $requestDTO,
            $this->createConfigForModel($requestDTO->getModel(), ProviderCode::Cloudsway),
        );

        $this->assertSame(5, $operation->getRawRequest()['generation']['duration_seconds']);
        $this->assertSame('720p', $operation->getRawRequest()['generation']['resolution']);
    }

    public function testCreateOperationKeepsExplicitCloudswayVeoDurationAndResolution(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'veo-3.1-fast-generate-preview',
            'task' => 'generate',
            'prompt' => 'make the shot',
            'generation' => [
                'duration_seconds' => 6,
                'resolution' => '1080p',
            ],
        ]);
        $requestDTO->valid();

        $operation = $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'LCnVzCkkMnVulyrz',
            'provider-model-veo',
            ProviderCode::Cloudsway,
            $requestDTO,
            $this->createConfigForModel($requestDTO->getModel(), ProviderCode::Cloudsway),
        );

        $this->assertSame(6, $operation->getRawRequest()['generation']['duration_seconds']);
        $this->assertSame('1080p', $operation->getRawRequest()['generation']['resolution']);
    }

    public function testCreateOperationNormalizesCloudswayVeoInvalidGenerationValuesWithoutFailing(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'veo-3.1-fast-generate-preview',
            'task' => 'generate',
            'prompt' => 'make the shot',
            'generation' => [
                'duration_seconds' => 5,
                'resolution' => '480P',
                'generate_audio' => 'yes',
                'enhance_prompt' => 'off',
                'sample_count' => 9,
                'seed' => 99999999999,
                'person_generation' => 'allow_all',
                'compression_quality' => 'medium',
            ],
            'execution' => [
                'service_tier' => 'turbo',
                'expires_after_seconds' => 300,
            ],
        ]);
        $requestDTO->valid();

        $operation = $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'LCnVzCkkMnVulyrz',
            'provider-model-veo',
            ProviderCode::Cloudsway,
            $requestDTO,
            $this->createConfigForModel($requestDTO->getModel(), ProviderCode::Cloudsway),
        );

        $this->assertSame(4, $operation->getRawRequest()['generation']['duration_seconds']);
        $this->assertSame('720p', $operation->getRawRequest()['generation']['resolution']);
        $this->assertTrue($operation->getRawRequest()['generation']['generate_audio']);
        $this->assertFalse($operation->getRawRequest()['generation']['enhance_prompt']);
        $this->assertSame(4, $operation->getRawRequest()['generation']['sample_count']);
        $this->assertSame(4294967295, $operation->getRawRequest()['generation']['seed']);
        $this->assertArrayNotHasKey('person_generation', $operation->getRawRequest()['generation']);
        $this->assertArrayNotHasKey('compression_quality', $operation->getRawRequest()['generation']);
        $this->assertArrayNotHasKey('service_tier', $operation->getRawRequest()['execution']);
        $this->assertSame(300, $operation->getRawRequest()['execution']['expires_after_seconds']);
    }

    public function testCreateOperationDefaultsKelingDurationAndResolutionWhenGenerationMissing(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'keling-3.0-video',
            'task' => 'generate',
            'prompt' => 'make the shot',
        ]);
        $requestDTO->valid();

        $operation = $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'YGNqszpCuuWLpyUt',
            'provider-model-keling',
            ProviderCode::Cloudsway,
            $requestDTO,
            $this->createConfigForModel($requestDTO->getModel(), ProviderCode::Cloudsway),
        );

        $this->assertSame(5, $operation->getRawRequest()['generation']['duration_seconds']);
        $this->assertSame('720p', $operation->getRawRequest()['generation']['resolution']);
    }

    public function testCreateOperationNormalizesSeedanceInvalidDurationResolutionAndAspectRatio(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'seedance-1.5-pro',
            'task' => 'generate',
            'prompt' => 'make the shot',
            'generation' => [
                'duration_seconds' => 7,
                'resolution' => '4k',
                'aspect_ratio' => '21:9',
            ],
        ]);
        $requestDTO->valid();

        $operation = $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'rrpvTsUlqilBwMXg',
            'provider-model-seedance',
            ProviderCode::Cloudsway,
            $requestDTO,
            $this->createConfigForModel($requestDTO->getModel(), ProviderCode::Cloudsway),
        );

        $this->assertSame(5, $operation->getRawRequest()['generation']['duration_seconds']);
        $this->assertSame('1080p', $operation->getRawRequest()['generation']['resolution']);
        $this->assertArrayNotHasKey('aspect_ratio', $operation->getRawRequest()['generation']);
    }

    public function testCreateOperationInfersKelingResolutionFrom1080DimensionsWhenResolutionMissing(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'keling-3.0-video',
            'task' => 'generate',
            'prompt' => 'make the shot',
            'generation' => [
                'width' => 1920,
                'height' => 1080,
                'duration_seconds' => 5,
            ],
        ]);
        $requestDTO->valid();

        $operation = $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'YGNqszpCuuWLpyUt',
            'provider-model-keling',
            ProviderCode::Cloudsway,
            $requestDTO,
            $this->createConfigForModel($requestDTO->getModel(), ProviderCode::Cloudsway),
        );

        $adapter = new CloudswayKelingVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));
        $providerPayload = $adapter->buildProviderPayload($operation);

        $this->assertSame(1920, $operation->getRawRequest()['generation']['width']);
        $this->assertSame(1080, $operation->getRawRequest()['generation']['height']);
        $this->assertSame('1080p', $operation->getRawRequest()['generation']['resolution']);
        $this->assertSame('pro', $providerPayload['mode']);
    }

    public function testCreateOperationInfersKelingResolutionFrom720DimensionsWhenResolutionMissing(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'keling-3.0-video',
            'task' => 'generate',
            'prompt' => 'make the shot',
            'generation' => [
                'width' => 1280,
                'height' => 720,
                'duration_seconds' => 5,
            ],
        ]);
        $requestDTO->valid();

        $operation = $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'YGNqszpCuuWLpyUt',
            'provider-model-keling',
            ProviderCode::Cloudsway,
            $requestDTO,
            $this->createConfigForModel($requestDTO->getModel(), ProviderCode::Cloudsway),
        );

        $adapter = new CloudswayKelingVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));
        $providerPayload = $adapter->buildProviderPayload($operation);

        $this->assertSame('720p', $operation->getRawRequest()['generation']['resolution']);
        $this->assertSame('std', $providerPayload['mode']);
    }

    public function testCreateOperationUsesKelingModeWhenResolutionConflicts(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'keling-3.0-video',
            'task' => 'generate',
            'prompt' => 'make the shot',
            'generation' => [
                'mode' => 'std',
                'resolution' => '1080p',
                'duration_seconds' => 5,
            ],
        ]);
        $requestDTO->valid();

        $operation = $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'YGNqszpCuuWLpyUt',
            'provider-model-keling',
            ProviderCode::Cloudsway,
            $requestDTO,
            $this->createConfigForModel($requestDTO->getModel(), ProviderCode::Cloudsway),
        );

        $adapter = new CloudswayKelingVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));
        $providerPayload = $adapter->buildProviderPayload($operation);

        $this->assertSame('720p', $operation->getRawRequest()['generation']['resolution']);
        $this->assertSame('std', $providerPayload['mode']);
    }

    public function testCreateOperationNormalizesUnsupportedKelingResolutionWithoutMode(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'keling-3.0-video',
            'task' => 'generate',
            'prompt' => 'make the shot',
            'generation' => [
                'resolution' => '2k',
                'duration_seconds' => 5,
            ],
        ]);
        $requestDTO->valid();

        $operation = $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'YGNqszpCuuWLpyUt',
            'provider-model-keling',
            ProviderCode::Cloudsway,
            $requestDTO,
            $this->createConfigForModel($requestDTO->getModel(), ProviderCode::Cloudsway),
        );

        $adapter = new CloudswayKelingVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class)));
        $providerPayload = $adapter->buildProviderPayload($operation);

        $this->assertSame('720p', $operation->getRawRequest()['generation']['resolution']);
        $this->assertSame('std', $providerPayload['mode']);
    }

    public function testCreateOperationRejectsUnsupportedTaskForCurrentProvider(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'veo-3.1-fast-generate-preview',
            'task' => 'extend',
            'prompt' => 'extend the clip',
            'inputs' => [
                'video' => ['uri' => 'https://example.com/input.mp4'],
            ],
        ]);
        $requestDTO->valid();

        $this->expectException(BusinessException::class);
        $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'LCnVzCkkMnVulyrz',
            'provider-model-veo-fast',
            ProviderCode::Cloudsway,
            $requestDTO,
            $this->createConfigForModel($requestDTO->getModel(), ProviderCode::Cloudsway),
        );
    }

    public function testCreateOperationKeepsAudioVideoMaskAndEditTaskInCanonicalRequest(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'doubao-seedance-2-0-260128',
            'task' => 'edit',
            'prompt' => 'replace the sky',
            'inputs' => [
                'video' => ['uri' => 'https://example.com/source.mp4'],
                'mask' => ['uri' => 'https://example.com/mask.png'],
                'audio' => [
                    ['role' => 'reference', 'uri' => 'https://example.com/voice.wav'],
                ],
            ],
            'generation' => [
                'resolution' => '1080p',
                'duration_seconds' => 5,
                'return_last_frame' => true,
            ],
            'extensions' => [
                'seedance' => ['camera_movement' => 'truck left'],
            ],
        ]);
        $requestDTO->valid();

        $operation = $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'doubao-seedance-2-0-260128',
            'provider-model-seedance-v2',
            ProviderCode::VolcengineArk,
            $requestDTO,
            new VideoGenerationConfig([
                'supported_inputs' => ['text_prompt', 'image', 'audio', 'video', 'mask', 'video_edit', 'video_extension', 'video_upscale'],
                'reference_images' => ['max_count' => 4, 'reference_types' => ['asset'], 'style_supported' => false],
                'generation' => ['durations' => [5, 10], 'resolutions' => ['720p', '1080p'], 'supports_generate_audio' => true],
                'constraints' => [],
            ]),
        );

        $this->assertSame('edit', $operation->getRawRequest()['task']);
        $this->assertSame('https://example.com/source.mp4', $operation->getRawRequest()['inputs']['video']['uri']);
        $this->assertSame('https://example.com/mask.png', $operation->getRawRequest()['inputs']['mask']['uri']);
        $this->assertSame('https://example.com/voice.wav', $operation->getRawRequest()['inputs']['audio'][0]['uri']);
        $this->assertSame(['seedance' => ['camera_movement' => 'truck left']], $operation->getRawRequest()['extensions']);
    }

    public function testCreateOperationRejectsEditWithoutVideoInput(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'doubao-seedance-2-0-260128',
            'task' => 'edit',
            'prompt' => 'replace the sky',
            'inputs' => [
                'mask' => ['uri' => 'https://example.com/mask.png'],
            ],
        ]);
        $requestDTO->valid();

        $this->expectException(BusinessException::class);
        $this->expectExceptionMessage('inputs.video is required');
        $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'doubao-seedance-2-0-260128',
            'provider-model-seedance-v2',
            ProviderCode::VolcengineArk,
            $requestDTO,
            new VideoGenerationConfig([
                'supported_inputs' => ['text_prompt', 'image', 'mask', 'video_edit'],
                'reference_images' => ['max_count' => 0, 'reference_types' => [], 'style_supported' => false],
                'generation' => ['durations' => [5, 10], 'resolutions' => ['720p', '1080p']],
                'constraints' => [],
            ]),
        );
    }

    public function testCreateOperationIgnoresUnknownGenerationAndInputKeysWithoutFailing(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'veo-3.1-fast-generate-preview',
            'task' => 'generate',
            'prompt' => 'make a video',
            'inputs' => [
                'frames' => [
                    ['role' => 'start', 'uri' => 'https://example.com/start.png', 'extra' => 'ignored'],
                ],
                'unsupported_input' => ['uri' => 'https://example.com/ignored.png'],
            ],
            'generation' => [
                'resolution' => '1080p',
                'unknown_field' => 'ignored',
            ],
            'unknown_root' => 'ignored',
        ]);
        $requestDTO->valid();

        $operation = $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'LCnVzCkkMnVulyrz',
            'provider-model-veo',
            ProviderCode::Cloudsway,
            $requestDTO,
            $this->createConfigForModel($requestDTO->getModel(), ProviderCode::Cloudsway),
        );

        $this->assertSame('1080p', $operation->getRawRequest()['generation']['resolution']);
        $this->assertArrayNotHasKey('unknown_field', $operation->getRawRequest()['generation']);
        $this->assertArrayNotHasKey('unsupported_input', $operation->getRawRequest()['inputs']);
    }

    public function testFinishExecutionFailureKeepsProviderSpecificMessage(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $operation = $this->createFailedOperation();

        $service->finishExecutionFailure(
            $operation,
            'cloudsway video post failed: cURL error 35: TLS connect error',
        );

        $response = $service->buildOperationResponse($operation, []);

        $this->assertSame('cloudsway video post failed: cURL error 35: TLS connect error', $response->getError()?->getMessage());
        $this->assertArrayNotHasKey('provider', $response->toArray());
    }

    public function testCreateOperationPersistsProjectTopicTaskAndSourceContext(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $requestDTO = new CreateVideoDTO([
            'model_id' => 'veo-3.1-fast-generate-preview',
            'task' => 'generate',
            'prompt' => 'make a video',
            'business_params' => [
                'project_id' => 1001,
                'source_id' => 'design_video_generation',
            ],
        ]);
        $requestDTO->setHeaderConfigs([
            'magic-topic-id' => 'topic-1',
            'magic-task-id' => 'task-1',
        ]);
        $requestDTO->valid();

        $operation = $service->createOperation(
            ModelGatewayDataIsolation::create('org-test', 'user-test'),
            'LCnVzCkkMnVulyrz',
            'provider-model-veo-fast',
            ProviderCode::Cloudsway,
            $requestDTO,
            $this->createConfigForModel($requestDTO->getModel(), ProviderCode::Cloudsway),
        );

        $this->assertSame(1001, $operation->getProjectId());
        $this->assertSame('topic-1', $operation->getTopicId());
        $this->assertSame('task-1', $operation->getTaskId());
        $this->assertSame('design_video_generation', $operation->getSourceId());
    }

    public function testSyncWithExecutionResultMarksFirstSucceededOnlyOnce(): void
    {
        $service = new VideoQueueDomainService($this->createMock(VideoQueueOperationRepositoryInterface::class));
        $operation = $this->createFailedOperation();

        $firstResult = $service->syncWithExecutionResult($operation, 'provider-task-1', [
            'status' => 'succeeded',
            'output' => [
                'video_url' => 'https://example.com/video.mp4',
            ],
        ]);

        $this->assertTrue($firstResult->isStatusChanged());
        $this->assertTrue($firstResult->isFirstSucceeded());
        $this->assertSame(VideoOperationStatus::SUCCEEDED, $operation->getStatus());

        $secondResult = $service->syncWithExecutionResult($operation, 'provider-task-1', [
            'status' => 'succeeded',
            'output' => [
                'video_url' => 'https://example.com/video.mp4',
            ],
        ]);

        $this->assertFalse($secondResult->isStatusChanged());
        $this->assertFalse($secondResult->isFirstSucceeded());
    }

    private function createFailedOperation(): VideoQueueOperationEntity
    {
        return new VideoQueueOperationEntity(
            id: 'op-failed',
            endpoint: 'video:veo-3.1-generate-preview',
            model: 'veo-3.1-generate-preview',
            modelVersion: 'LCnVzCkkMnVulyrz',
            providerModelId: 'provider-model-pro',
            providerCode: ProviderCode::Cloudsway->value,
            providerName: 'cloudsway',
            organizationCode: 'org-test',
            userId: 'user-test',
            status: VideoOperationStatus::PROVIDER_RUNNING,
            seq: 1,
            rawRequest: [
                'model_id' => 'veo-3.1-generate-preview',
                'prompt' => 'make a video',
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );
    }

    private function createConfigForModel(string $modelId, ProviderCode $providerCode): VideoGenerationConfig
    {
        return match ($modelId) {
            'veo-3.1-fast-generate-preview' => $this->createCloudswayVeoFastConfig(),
            'veo-3.1-generate-preview' => $this->createCloudswayVeoProConfig(),
            'seedance-1.5-pro' => $this->createCloudswaySeedanceConfig(),
            'keling-3.0-video' => $this->createCloudswayKelingConfig(),
            default => $this->createEmptyConfig(),
        };
    }

    private function createEmptyConfig(): VideoGenerationConfig
    {
        return new VideoGenerationConfig([
            'supported_inputs' => [],
            'reference_images' => [],
            'generation' => [],
            'constraints' => [],
        ]);
    }

    private function createCloudswayVeoFastConfig(): VideoGenerationConfig
    {
        return new VideoGenerationConfig([
            'supported_inputs' => ['text_prompt', 'image', 'last_frame'],
            'reference_images' => [
                'max_count' => 0,
                'reference_types' => [],
                'style_supported' => false,
            ],
            'generation' => [
                'aspect_ratios' => ['16:9', '9:16'],
                'durations' => [4, 6, 8],
                'default_duration_seconds' => 8,
                'resolutions' => ['720p', '1080p', '4k'],
                'default_resolution' => '720p',
                'supports_seed' => true,
                'seed_range' => [0, 4294967295],
                'supports_negative_prompt' => true,
                'supports_generate_audio' => true,
                'supports_person_generation' => true,
                'person_generation_options' => ['allow_adult', 'dont_allow'],
                'supports_enhance_prompt' => true,
                'supports_compression_quality' => true,
                'compression_quality_options' => ['optimized', 'lossless'],
                'supports_resize_mode' => true,
                'resize_mode_options' => ['pad', 'crop'],
                'supports_sample_count' => true,
                'sample_count_range' => [1, 4],
            ],
            'constraints' => [],
        ]);
    }

    private function createCloudswayVeoProConfig(): VideoGenerationConfig
    {
        return new VideoGenerationConfig([
            'supported_inputs' => ['text_prompt', 'image', 'last_frame', 'reference_images'],
            'reference_images' => [
                'max_count' => 3,
                'reference_types' => ['asset'],
                'style_supported' => false,
            ],
            'generation' => [
                'aspect_ratios' => ['16:9', '9:16'],
                'durations' => [4, 6, 8],
                'default_duration_seconds' => 8,
                'resolutions' => ['720p', '1080p', '4k'],
                'default_resolution' => '720p',
                'supports_seed' => true,
                'seed_range' => [0, 4294967295],
                'supports_negative_prompt' => true,
                'supports_generate_audio' => true,
                'supports_person_generation' => true,
                'person_generation_options' => ['allow_adult', 'dont_allow'],
                'supports_enhance_prompt' => true,
                'supports_compression_quality' => true,
                'compression_quality_options' => ['optimized', 'lossless'],
                'supports_resize_mode' => true,
                'resize_mode_options' => ['pad', 'crop'],
                'supports_sample_count' => true,
                'sample_count_range' => [1, 4],
            ],
            'constraints' => [
                'reference_images_requires_duration_seconds' => 8,
            ],
        ]);
    }

    private function createCloudswaySeedanceConfig(): VideoGenerationConfig
    {
        return new VideoGenerationConfig([
            'supported_inputs' => ['text_prompt', 'image'],
            'reference_images' => [
                'max_count' => 1,
                'reference_types' => ['asset'],
                'style_supported' => false,
            ],
            'generation' => [
                'durations' => [5, 10],
                'default_duration_seconds' => 5,
                'resolutions' => ['480p', '720p', '1080p'],
                'default_resolution' => '720p',
            ],
            'constraints' => [],
        ]);
    }

    private function createCloudswayKelingConfig(): VideoGenerationConfig
    {
        return new VideoGenerationConfig([
            'supported_inputs' => ['text_prompt', 'image', 'last_frame'],
            'reference_images' => [
                'max_count' => 1,
                'reference_types' => ['asset'],
                'style_supported' => false,
            ],
            'generation' => [
                'durations' => [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
                'default_duration_seconds' => 5,
                'resolutions' => ['720p', '1080p'],
                'default_resolution' => '720p',
            ],
            'constraints' => [],
        ]);
    }
}
