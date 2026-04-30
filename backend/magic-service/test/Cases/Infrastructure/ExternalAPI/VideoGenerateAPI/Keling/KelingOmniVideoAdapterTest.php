<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling;

use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Adapter\KelingOmniVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Capability\KelingOmniGenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\KelingTransportFactory;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\KelingVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Transport\ApiKeyKelingTransport;
use Hyperf\Context\ApplicationContext;
use Hyperf\Guzzle\ClientFactory;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;

/**
 * @internal
 */
class KelingOmniVideoAdapterTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        if (! ApplicationContext::hasContainer()) {
            ApplicationContext::setContainer($this->createMock(ContainerInterface::class));
        }
    }

    public function testResolveGenerationConfigExposesOmniDefaults(): void
    {
        $adapter = $this->createAdapter();

        $config = $adapter->resolveGenerationConfig('kling-v3-omni', 'keling-video');

        $this->assertNotNull($config);
        $data = $config->toArray();
        $this->assertSame(['text_prompt', 'image', 'last_frame', 'reference_images', 'reference_videos', VideoInputMode::VideoEdit->value], $data['supported_inputs']);
        $this->assertSame(5, $data['generation']['default_duration_seconds']);
        $this->assertSame('720p', $data['generation']['default_resolution']);
        $this->assertSame(
            ['standard', 'image_reference', 'omni_reference', VideoInputMode::VideoEdit->value, 'keyframe_guided'],
            array_keys($data['input_modes'])
        );
        $this->assertSame('generate', $data['input_modes']['omni_reference']['task']);
        $this->assertSame('edit', $data['input_modes'][VideoInputMode::VideoEdit->value]['task']);
    }

    public function testResolveGenerationConfigSupportsOmniAliasModelId(): void
    {
        $adapter = $this->createAdapter();

        $config = $adapter->resolveGenerationConfig('kling-v3-omni', 'kling-v3-omni');

        $this->assertNotNull($config);
        $this->assertTrue($adapter->supportsModel('kling-v3-omni', 'kling-v3-omni'));
    }

    public function testSupportsModelAcceptsLegacyV3ModelIdWhenOmniVersionMatches(): void
    {
        $adapter = $this->createAdapter();

        $this->assertTrue($adapter->supportsModel('kling-v3-omni', 'keling-3.0-video'));
        $this->assertNotNull($adapter->resolveGenerationConfig('kling-v3-omni', 'keling-3.0-video'));
    }

    public function testSupportsModelAcceptsKnownKelingModelIdAsFallback(): void
    {
        $adapter = $this->createAdapter();

        $this->assertTrue($adapter->supportsModel('kling-v4-omni', 'keling-video'));
        $this->assertNotNull($adapter->resolveGenerationConfig('kling-v4-omni', 'keling-video'));
    }

    public function testBuildProviderPayloadMapsOmniInputsAndExtensions(): void
    {
        $adapter = $this->createAdapter();
        $operation = new VideoQueueOperationEntity(
            id: 'op-keling-1',
            endpoint: 'video:keling-video',
            model: 'keling-video',
            modelVersion: 'kling-v3-omni',
            providerModelId: 'provider-model-keling',
            providerCode: 'Keling',
            providerName: 'keling',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'prompt' => '让 <<<image_1>>> 的主体在 <<<video_1>>> 的动态里奔跑',
                'inputs' => [
                    'frames' => [
                        ['role' => 'start', 'uri' => 'https://localhost/start.png'],
                        ['role' => 'end', 'uri' => 'https://localhost/end.png'],
                    ],
                    'reference_images' => [
                        ['uri' => 'https://localhost/ref.png', 'type' => 'style'],
                    ],
                    'reference_videos' => [
                        ['uri' => 'https://localhost/ref.mp4'],
                    ],
                ],
                'generation' => [
                    'aspect_ratio' => '16:9',
                    'duration_seconds' => 8,
                    'resolution' => '1080p',
                    'generate_audio' => true,
                    'watermark' => false,
                    'negative_prompt' => '不要闪烁',
                ],
                'extensions' => [
                    'keling' => [
                        'omni_video' => [
                            'multi_shot' => true,
                            'shot_type' => 'customize',
                            'multi_prompt' => [
                                ['index' => 1, 'prompt' => '第一镜', 'duration' => 4],
                                ['index' => 2, 'prompt' => '第二镜', 'duration' => 4],
                            ],
                            'element_list' => [
                                ['element_id' => 123],
                            ],
                            'external_task_id' => 'task-ext-1',
                        ],
                    ],
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('kling-v3-omni', $payload['model_name']);
        $this->assertTrue($payload['multi_shot']);
        $this->assertSame('customize', $payload['shot_type']);
        $this->assertCount(3, $payload['image_list']);
        $this->assertSame('first_frame', $payload['image_list'][0]['type']);
        $this->assertSame('end_frame', $payload['image_list'][1]['type']);
        $this->assertSame('https://localhost/ref.mp4', $payload['video_list'][0]['video_url']);
        $this->assertSame('feature', $payload['video_list'][0]['refer_type']);
        $this->assertSame('pro', $payload['mode']);
        $this->assertSame('16:9', $payload['aspect_ratio']);
        $this->assertSame('8', $payload['duration']);
        $this->assertSame('off', $payload['sound']);
        $this->assertFalse($payload['watermark_info']['enabled']);
        $this->assertSame('task-ext-1', $payload['external_task_id']);
        $this->assertStringContainsString('负向约束：不要闪烁', $payload['prompt']);
    }

    public function testBuildProviderPayloadMapsVideoEditToBaseVideoWithoutDuration(): void
    {
        $adapter = $this->createAdapter();
        $operation = new VideoQueueOperationEntity(
            id: 'op-keling-edit-1',
            endpoint: 'video:keling-video',
            model: 'keling-video',
            modelVersion: 'kling-v3-omni',
            providerModelId: 'provider-model-keling',
            providerCode: 'Keling',
            providerName: 'keling',
            organizationCode: 'org-1',
            userId: 'user-1',
            status: VideoOperationStatus::QUEUED,
            seq: 1,
            rawRequest: [
                'task' => 'edit',
                'prompt' => '保持人物主体，重做背景和氛围',
                'inputs' => [
                    'reference_videos' => [
                        ['uri' => 'https://localhost/base.mp4'],
                    ],
                ],
                'generation' => [
                    'duration_seconds' => 8,
                    'generate_audio' => true,
                ],
            ],
            createdAt: date(DATE_ATOM),
            heartbeatAt: date(DATE_ATOM),
        );

        $payload = $adapter->buildProviderPayload($operation);

        $this->assertSame('https://localhost/base.mp4', $payload['video_list'][0]['video_url']);
        $this->assertSame('base', $payload['video_list'][0]['refer_type']);
        $this->assertArrayNotHasKey('duration', $payload);
        $this->assertSame('off', $payload['sound']);
    }

    private function createAdapter(): KelingOmniVideoAdapter
    {
        return new KelingOmniVideoAdapter(
            new KelingOmniGenerationCapabilityProvider(),
            new KelingTransportFactory(
                new ApiKeyKelingTransport(
                    new KelingVideoClient($this->createMock(ClientFactory::class))
                )
            )
        );
    }
}
