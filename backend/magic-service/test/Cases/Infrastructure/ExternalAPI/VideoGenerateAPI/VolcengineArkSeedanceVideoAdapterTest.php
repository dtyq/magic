<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\ErrorCode\VideoGenerateErrorCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArkSeedanceVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArkVideoClient;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Guzzle\ClientFactory;
use PHPUnit\Framework\TestCase;

use function Hyperf\Translation\trans;

/**
 * @internal
 */
class VolcengineArkSeedanceVideoAdapterTest extends TestCase
{
    public function testSupportsModelAcceptsDynamicVolcengineArkModelIdentifiers(): void
    {
        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class)));

        $this->assertTrue($adapter->supportsModel('seedance-v-next-build-001', ''));
        $this->assertTrue($adapter->supportsModel('', 'seedance-v-next-build-001'));
        $this->assertFalse($adapter->supportsModel('', ''));
    }

    public function testResolveGenerationConfigMatchesSeedanceTwoOfficialRanges(): void
    {
        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class)));

        $config = $adapter->resolveGenerationConfig('doubao-seedance-2-0-260128', 'doubao-seedance-2-0-260128');

        $this->assertNotNull($config);
        $generation = $config->toArray()['generation'];
        $this->assertSame(['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'], $generation['aspect_ratios']);
        $this->assertSame(['min' => 4, 'max' => 15, 'step' => 1], $generation['durations']);
        $this->assertSame(['480p', '720p', '1080p', '4k'], $generation['resolutions']);
        $this->assertTrue($generation['supports_seed']);
        $this->assertTrue($generation['supports_generate_audio']);
        foreach ([
            'supports_negative_prompt',
        ] as $unsupportedCapability) {
            $this->assertArrayNotHasKey($unsupportedCapability, $generation);
        }
        $this->assertFalse($generation['supports_person_generation']);
        $this->assertFalse($generation['supports_enhance_prompt']);
        $this->assertFalse($generation['supports_compression_quality']);
        $this->assertFalse($generation['supports_resize_mode']);
        $this->assertFalse($generation['supports_sample_count']);
        $this->assertCount(24, $generation['sizes']);
        $this->assertSame([
            'label' => '16:9',
            'value' => '864x496',
            'width' => 864,
            'height' => 496,
            'resolution' => '480p',
        ], $generation['sizes'][0]);
        $this->assertSame([
            'label' => '9:16',
            'value' => '720x1280',
            'width' => 720,
            'height' => 1280,
            'resolution' => '720p',
        ], $generation['sizes'][10]);
        $this->assertSame([
            'label' => '21:9',
            'value' => '2205x945',
            'width' => 2205,
            'height' => 945,
            'resolution' => '1080p',
        ], $generation['sizes'][17]);
        $this->assertSame([
            'label' => '16:9',
            'value' => '3840x2160',
            'width' => 3840,
            'height' => 2160,
            'resolution' => '4k',
        ], $generation['sizes'][18]);
        $this->assertSame([
            'label' => '21:9',
            'value' => '4410x1890',
            'width' => 4410,
            'height' => 1890,
            'resolution' => '4k',
        ], $generation['sizes'][23]);
    }

    public function testResolveGenerationConfigAdds1080pForSeedanceTwoPointFiveWithout4k(): void
    {
        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class)));

        $config = $adapter->resolveGenerationConfig('doubao-seedance-2-5-260xxx', 'doubao-seedance-2-5-260xxx');

        $this->assertNotNull($config);
        $generation = $config->toArray()['generation'];
        $this->assertSame(['480p', '720p', '1080p'], $generation['resolutions']);
        $this->assertCount(18, $generation['sizes']);
        $this->assertSame('1080p', $generation['sizes'][17]['resolution']);
    }

    public function testResolveGenerationConfigOmits1080pForFastModel(): void
    {
        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class)));

        $config = $adapter->resolveGenerationConfig('doubao-seedance-2-0-fast-260128', 'doubao-seedance-2-0-fast-260128');

        $this->assertNotNull($config);
        $generation = $config->toArray()['generation'];
        $this->assertSame(['480p', '720p'], $generation['resolutions']);
        $this->assertCount(12, $generation['sizes']);
        $this->assertSame([
            'label' => '21:9',
            'value' => '1470x630',
            'width' => 1470,
            'height' => 630,
            'resolution' => '720p',
        ], $generation['sizes'][11]);
    }

    public function testResolveGenerationConfigDoesNotExpose4kForOtherVideoModels(): void
    {
        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class)));

        $config = $adapter->resolveGenerationConfig('doubao-other-video-001', 'doubao-other-video-001');

        $this->assertNotNull($config);
        $generation = $config->toArray()['generation'];
        $this->assertSame(['480p', '720p', '1080p'], $generation['resolutions']);
        $this->assertCount(18, $generation['sizes']);
        $this->assertNotContains('4k', array_column($generation['sizes'], 'resolution'));
    }

    public function testBuildProviderPayloadMapsGenerateEditAndReferenceInputsWithoutServiceTierForProModel(): void
    {
        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-ark-1',
            endpoint: 'video:doubao-seedance-2-0-260128',
            model: 'doubao-seedance-2-0-260128',
            modelVersion: 'doubao-seedance-2-0-260128',
            providerModelId: 'provider-model-ark-seedance',
            providerCode: 'VolcengineArk',
            providerName: 'volcengineark',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'model_id' => 'doubao-seedance-2-0-260128',
                'task' => 'edit',
                'prompt' => '{{image_1}} 跟随 {{video_1}}，再配合 {{audio_1}} 替换天空为晚霞',
                'inputs' => [
                    'reference_images' => [
                        ['uri' => 'https://example.com/ref.png'],
                    ],
                    'reference_videos' => [
                        ['uri' => 'https://example.com/source.mp4'],
                    ],
                    'mask' => ['uri' => 'https://example.com/mask.png'],
                    'reference_audios' => [
                        ['uri' => 'https://example.com/voice.wav'],
                    ],
                ],
                'generation' => [
                    'camera_fixed' => true,
                    'aspect_ratio' => '16:9',
                    'duration_seconds' => 5,
                    'resolution' => '1080p',
                    'seed' => 7,
                    'watermark' => true,
                    'return_last_frame' => true,
                    'generate_audio' => true,
                ],
                'callbacks' => [
                    'webhook_url' => 'https://callback.example.com/video',
                ],
                'execution' => [
                    'service_tier' => 'flex',
                    'expires_after_seconds' => 7200,
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('doubao-seedance-2-0-260128', $payload['model']);
        $this->assertSame('edit', $payload['task']);
        $this->assertSame('@图片1 跟随 @视频1，再配合 @音频1 替换天空为晚霞', $payload['content'][0]['text']);
        $this->assertSame('https://example.com/ref.png', $payload['content'][1]['image_url']['url']);
        $this->assertSame('reference_image', $payload['content'][1]['role']);
        $this->assertSame('https://example.com/source.mp4', $payload['content'][2]['video_url']['url']);
        $this->assertSame('reference_video', $payload['content'][2]['role']);
        $this->assertSame('https://example.com/voice.wav', $payload['content'][3]['audio_url']['url']);
        $this->assertSame('reference_audio', $payload['content'][3]['role']);
        $this->assertSame('https://example.com/mask.png', $payload['content'][4]['mask_url']['url']);
        $this->assertSame('https://callback.example.com/video', $payload['callback_url']);
        $this->assertArrayNotHasKey('service_tier', $payload);
        $this->assertSame(7200, $payload['execution_expires_after']);
        $this->assertSame('1080p', $payload['resolution']);
        $this->assertSame('16:9', $payload['ratio']);
        $this->assertSame(5, $payload['duration']);
        $this->assertSame(7, $payload['seed']);
        $this->assertTrue($payload['camera_fixed']);
        $this->assertTrue($payload['watermark']);
        $this->assertTrue($payload['return_last_frame']);
        $this->assertTrue($payload['generate_audio']);
    }

    public function testBuildProviderPayloadAllowsReferenceImagesWhenResolutionIs1080pForProModel(): void
    {
        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-ark-ref-image-1080p',
            endpoint: 'video:doubao-seedance-2-0-260128',
            model: 'doubao-seedance-2-0-260128',
            modelVersion: 'doubao-seedance-2-0-260128',
            providerModelId: 'provider-model-ark-seedance',
            providerCode: 'VolcengineArk',
            providerName: 'volcengineark',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'model_id' => 'doubao-seedance-2-0-260128',
                'task' => 'generate',
                'prompt' => 'animate this portrait',
                'inputs' => [
                    'reference_images' => [
                        ['uri' => 'https://example.com/reference.png'],
                    ],
                ],
                'generation' => [
                    'resolution' => '1080p',
                    'duration_seconds' => 5,
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('1080p', $payload['resolution']);
        $this->assertSame('https://example.com/reference.png', $payload['content'][1]['image_url']['url']);
        $this->assertSame('reference_image', $payload['content'][1]['role']);
    }

    public function testBuildProviderPayloadRejects1080pForFastModel(): void
    {
        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-ark-fast-1080p',
            endpoint: 'video:doubao-seedance-2-0-fast-260128',
            model: 'doubao-seedance-2-0-fast-260128',
            modelVersion: 'doubao-seedance-2-0-fast-260128',
            providerModelId: 'provider-model-ark-seedance-fast',
            providerCode: 'VolcengineArk',
            providerName: 'volcengineark',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'model_id' => 'doubao-seedance-2-0-fast-260128',
                'task' => 'generate',
                'prompt' => 'make a fast high quality video',
                'generation' => [
                    'resolution' => '1080p',
                    'duration_seconds' => 5,
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $this->expectException(ProviderVideoException::class);
        $this->expectExceptionMessage(trans('video.errors.model_resolution_not_supported', [
            'model' => 'doubao-seedance-2-0-fast-260128',
            'resolution' => '1080p',
            'supported' => '480p / 720p',
        ]));

        $adapter->buildProviderPayload($operation);
    }

    public function testBuildProviderPayloadRejects1080pForFastModelWithEnglishLocalizedMessage(): void
    {
        $translator = ApplicationContext::getContainer()->get(TranslatorInterface::class);
        $originalLocale = $translator->getLocale();
        $translator->setLocale('en_US');

        try {
            $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class)));
            $operation = new VideoQueueOperationEntity(
                id: 'op-ark-fast-1080p-en',
                endpoint: 'video:doubao-seedance-2-0-fast-260128',
                model: 'doubao-seedance-2-0-fast-260128',
                modelVersion: 'doubao-seedance-2-0-fast-260128',
                providerModelId: 'provider-model-ark-seedance-fast',
                providerCode: 'VolcengineArk',
                providerName: 'volcengineark',
                organizationCode: 'org-1',
                userId: 'user-1',
                status: VideoOperationStatus::QUEUED,
                seq: 1,
                rawRequest: [
                    'model_id' => 'doubao-seedance-2-0-fast-260128',
                    'task' => 'generate',
                    'prompt' => 'make a fast high quality video',
                    'generation' => [
                        'resolution' => '1080p',
                        'duration_seconds' => 5,
                    ],
                ],
                createdAt: date(DATE_ATOM),
                heartbeatAt: date(DATE_ATOM),
            );

            $this->expectException(ProviderVideoException::class);
            $this->expectExceptionMessage('The current model (doubao-seedance-2-0-fast-260128) does not support 1080p. Please switch to 480p / 720p and try again.');

            $adapter->buildProviderPayload($operation);
        } finally {
            $translator->setLocale($originalLocale);
        }
    }

    public function testBuildProviderPayloadDropsServiceTierForFastModelToo(): void
    {
        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-ark-fast-tier',
            endpoint: 'video:doubao-seedance-2-0-fast-260128',
            model: 'doubao-seedance-2-0-fast-260128',
            modelVersion: 'doubao-seedance-2-0-fast-260128',
            providerModelId: 'provider-model-ark-seedance-fast',
            providerCode: 'VolcengineArk',
            providerName: 'volcengineark',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'model_id' => 'doubao-seedance-2-0-fast-260128',
                'task' => 'generate',
                'prompt' => 'make a fast video',
                'execution' => [
                    'service_tier' => 'flex',
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertArrayNotHasKey('service_tier', $payload);
    }

    public function testBuildProviderPayloadIgnoresAdaptiveRatioAndTooShortDuration(): void
    {
        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-ark-invalid-ranges',
            endpoint: 'video:doubao-seedance-2-0-fast-260128',
            model: 'doubao-seedance-2-0-fast-260128',
            modelVersion: 'doubao-seedance-2-0-fast-260128',
            providerModelId: 'provider-model-ark-seedance-fast',
            providerCode: 'VolcengineArk',
            providerName: 'volcengineark',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'model_id' => 'doubao-seedance-2-0-fast-260128',
                'task' => 'generate',
                'prompt' => 'make a fast video',
                'generation' => [
                    'aspect_ratio' => 'adaptive',
                    'duration_seconds' => 2,
                    'resolution' => '720p',
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('make a fast video', $payload['content'][0]['text']);
        $this->assertSame('720p', $payload['resolution']);
        $this->assertSame(5, $payload['duration']);
        $this->assertArrayNotHasKey('ratio', $payload);
    }

    public function testBuildProviderPayloadPinsVideoEditDurationAndRatio(): void
    {
        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class)));

        $seedanceTwoPointFiveOperation = $this->buildVideoEditOperation('doubao-seedance-2-5-260628');
        $seedanceTwoPointFive = $adapter->buildProviderPayload($seedanceTwoPointFiveOperation);
        $this->assertSame(-1, $seedanceTwoPointFive['duration']);
        $this->assertSame('adaptive', $seedanceTwoPointFive['ratio']);
        $this->assertSame('edit', $seedanceTwoPointFive['omni_reference_task_type']);
        $this->assertSame('reference_video', $seedanceTwoPointFive['content'][1]['role']);
        // 调用方传入的时长与比例被固定值替换，必须记为未生效且不能同时出现在 accepted 列表里。
        $this->assertContains('generation.duration_seconds', $seedanceTwoPointFiveOperation->getIgnoredParams());
        $this->assertContains('generation.aspect_ratio', $seedanceTwoPointFiveOperation->getIgnoredParams());
        $this->assertNotContains('generation.duration_seconds', $seedanceTwoPointFiveOperation->getAcceptedParams());
        $this->assertNotContains('generation.aspect_ratio', $seedanceTwoPointFiveOperation->getAcceptedParams());

        // 2.0 系列不支持 omni_reference_task_type，由模型按素材与提示词判定任务类型。
        $seedanceTwo = $adapter->buildProviderPayload($this->buildVideoEditOperation('doubao-seedance-2-0-260128'));
        $this->assertSame(-1, $seedanceTwo['duration']);
        $this->assertSame('adaptive', $seedanceTwo['ratio']);
        $this->assertArrayNotHasKey('omni_reference_task_type', $seedanceTwo);
    }

    public function testBuildProviderPayloadMapsStartAndEndFramesWithoutDroppingThem(): void
    {
        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-ark-frames',
            endpoint: 'video:doubao-seedance-2-0-260128',
            model: 'doubao-seedance-2-0-260128',
            modelVersion: 'doubao-seedance-2-0-260128',
            providerModelId: 'provider-model-ark-seedance',
            providerCode: 'VolcengineArk',
            providerName: 'volcengineark',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'model_id' => 'doubao-seedance-2-0-260128',
                'task' => 'generate',
                'prompt' => 'animate these frames',
                'inputs' => [
                    'frames' => [
                        ['role' => 'start', 'uri' => 'https://example.com/start.png'],
                        ['role' => 'end', 'uri' => 'https://example.com/end.png'],
                    ],
                    'reference_images' => [
                        ['uri' => 'https://example.com/reference.png'],
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
        $this->assertSame('https://example.com/reference.png', $payload['content'][3]['image_url']['url']);
        $this->assertSame('reference_image', $payload['content'][3]['role']);
    }

    public function testBuildProviderPayloadMapsReferencesArrayToArkContent(): void
    {
        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class)));
        $operation = new VideoQueueOperationEntity(
            id: 'op-ark-references',
            endpoint: 'video:doubao-seedance-2-0-260128',
            model: 'doubao-seedance-2-0-260128',
            modelVersion: 'doubao-seedance-2-0-260128',
            providerModelId: 'provider-model-ark-seedance',
            providerCode: 'VolcengineArk',
            providerName: 'volcengineark',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'model_id' => 'doubao-seedance-2-0-260128',
                'task' => 'generate',
                'prompt' => '大家在唱歌跳舞',
                'input_mode' => 'omni_reference',
                'inputs' => [
                    'reference_images' => [
                        ['uri' => 'https://example.com/reference.png'],
                    ],
                    'reference_videos' => [
                        ['uri' => 'https://example.com/reference.mp4'],
                    ],
                    'reference_audios' => [
                        ['uri' => 'https://example.com/reference.wav'],
                    ],
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('大家在唱歌跳舞', $payload['content'][0]['text']);
        $this->assertSame('https://example.com/reference.png', $payload['content'][1]['image_url']['url']);
        $this->assertSame('reference_image', $payload['content'][1]['role']);
        $this->assertSame('https://example.com/reference.mp4', $payload['content'][2]['video_url']['url']);
        $this->assertSame('reference_video', $payload['content'][2]['role']);
        $this->assertSame('https://example.com/reference.wav', $payload['content'][3]['audio_url']['url']);
        $this->assertSame('reference_audio', $payload['content'][3]['role']);
    }

    public function testQueryMapsQueuedRunningSucceededFailedExpiredAndCancelledResponses(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->exactly(6))
            ->method('get')
            ->willReturnOnConsecutiveCalls(
                new Response(200, [], json_encode(['id' => 'task-queued', 'status' => 'queued'], JSON_THROW_ON_ERROR)),
                new Response(200, [], json_encode(['id' => 'task-running', 'status' => 'running'], JSON_THROW_ON_ERROR)),
                new Response(200, [], json_encode([
                    'id' => 'task-succeeded',
                    'status' => 'succeeded',
                    'content' => [
                        'video_url' => 'https://example.com/generated.mp4',
                        'last_frame_url' => 'https://example.com/last-frame.png',
                    ],
                ], JSON_THROW_ON_ERROR)),
                new Response(200, [], json_encode([
                    'id' => 'task-failed',
                    'status' => 'failed',
                    'message' => 'provider failed',
                ], JSON_THROW_ON_ERROR)),
                new Response(200, [], json_encode([
                    'id' => 'task-expired',
                    'status' => 'expired',
                    'message' => 'task expired',
                ], JSON_THROW_ON_ERROR)),
                new Response(200, [], json_encode([
                    'id' => 'task-cancelled',
                    'status' => 'cancelled',
                    'message' => 'task cancelled',
                ], JSON_THROW_ON_ERROR)),
            );

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->exactly(6))
            ->method('create')
            ->willReturn($httpClient);

        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($clientFactory));
        $operation = $this->createOperation();
        $config = new QueueExecutorConfig('https://ark.cn-beijing.volces.com/api/v3', 'secret', 3, 20);

        $queued = $adapter->query($operation, $config, 'task-queued');
        $running = $adapter->query($operation, $config, 'task-running');
        $succeeded = $adapter->query($operation, $config, 'task-succeeded');
        $failed = $adapter->query($operation, $config, 'task-failed');
        $expired = $adapter->query($operation, $config, 'task-expired');
        $cancelled = $adapter->query($operation, $config, 'task-cancelled');

        $this->assertSame('processing', $queued['status']);
        $this->assertNull($queued['error']);
        $this->assertSame('processing', $running['status']);
        $this->assertNull($running['error']);
        $this->assertSame('succeeded', $succeeded['status']);
        $this->assertSame('https://example.com/generated.mp4', $succeeded['output']['video_url']);
        $this->assertSame('https://example.com/last-frame.png', $succeeded['output']['last_frame_url']);
        $this->assertSame('failed', $failed['status']);
        $this->assertSame((string) VideoGenerateErrorCode::GENERAL_ERROR->value, $failed['error']['code']);
        $this->assertSame(VideoGenerateErrorCode::GENERAL_ERROR->getMessage(), $failed['error']['message']);
        $this->assertSame('failed', $expired['status']);
        $this->assertSame((string) VideoGenerateErrorCode::GENERAL_ERROR->value, $expired['error']['code']);
        $this->assertSame('failed', $cancelled['status']);
        $this->assertSame((string) VideoGenerateErrorCode::GENERAL_ERROR->value, $cancelled['error']['code']);
    }

    public function testQueryMapsProviderErrorPayloadToVideoErrorCodeAndRefinedMessage(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('get')
            ->willReturn(new Response(200, [], json_encode([
                'id' => 'task-failed',
                'status' => 'failed',
                'error' => [
                    'code' => 'InvalidParameter',
                    'message' => 'Error while downloading video, video height specified in the request must be less than or equal to 6000.',
                ],
            ], JSON_THROW_ON_ERROR)));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())->method('create')->willReturn($httpClient);

        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($clientFactory));
        $result = $adapter->query(
            $this->createOperation(),
            new QueueExecutorConfig('https://ark.cn-beijing.volces.com/api/v3', 'secret', 3, 20),
            'task-failed',
        );

        $this->assertSame('failed', $result['status']);
        $this->assertSame((string) VideoGenerateErrorCode::INVALID_PARAMETER->value, $result['error']['code']);
        $this->assertSame(
            trans('video_generate.invalid_parameter_video_dimension_exceeds_limit'),
            $result['error']['message'],
        );
    }

    public function testSubmitHandlesNonJsonErrorBodyWithoutDecodeException(): void
    {
        $httpClient = $this->createMock(Client::class);
        $httpClient->expects($this->once())
            ->method('post')
            ->willThrowException(new RequestException(
                'bad gateway',
                new Request('POST', 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks'),
                new Response(502, [], '<html>bad gateway</html>'),
            ));

        $clientFactory = $this->createMock(ClientFactory::class);
        $clientFactory->expects($this->once())
            ->method('create')
            ->willReturn($httpClient);

        $adapter = new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($clientFactory));

        $this->expectException(ProviderVideoException::class);
        $this->expectExceptionMessage(VideoGenerateErrorCode::GENERAL_ERROR->getMessage());

        $adapter->submit(
            $this->createOperation(),
            new QueueExecutorConfig('https://ark.cn-beijing.volces.com/api/v3', 'secret', 3, 20),
        );
    }

    private function buildVideoEditOperation(string $model): VideoQueueOperationEntity
    {
        return new VideoQueueOperationEntity(
            id: 'op-ark-video-edit',
            endpoint: 'video:' . $model,
            model: $model,
            modelVersion: $model,
            providerModelId: $model,
            providerCode: 'VolcengineArk',
            providerName: 'volcengineark',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'model_id' => $model,
                'task' => 'edit',
                'input_mode' => 'video_edit',
                'prompt' => '{{video_1}} 再加一只橘猫',
                'inputs' => [
                    'reference_videos' => [
                        ['uri' => 'https://example.com/source.mp4'],
                    ],
                ],
                'generation' => [
                    'resolution' => '720p',
                    'duration_seconds' => 5,
                    'aspect_ratio' => '16:9',
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );
    }

    private function createOperation(): VideoQueueOperationEntity
    {
        return new VideoQueueOperationEntity(
            id: 'op-ark-query',
            endpoint: 'video:doubao-seedance-2-0-260128',
            model: 'doubao-seedance-2-0-260128',
            modelVersion: 'doubao-seedance-2-0-260128',
            providerModelId: 'provider-model-ark-seedance',
            providerCode: 'VolcengineArk',
            providerName: 'volcengineark',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::PROVIDER_RUNNING,
            seq: 1,
            rawRequest: [
                'model_id' => 'doubao-seedance-2-0-260128',
                'task' => 'generate',
                'prompt' => 'make a video',
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );
    }
}
