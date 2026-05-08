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
use Hyperf\Contract\TranslatorInterface;
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
        ApplicationContext::setContainer(new readonly class implements ContainerInterface {
            public function get(string $id): mixed
            {
                if ($id === TranslatorInterface::class) {
                    return new class implements TranslatorInterface {
                        public function trans(string $key, array $replace = [], ?string $locale = null): string
                        {
                            return match ($key) {
                                'video.input_modes.standard' => '普通文生视频模式，不依赖任何参考素材。',
                                'video.input_modes.omni_reference' => str_replace(':max_count', (string) ($replace['max_count'] ?? ''), '上传 1~:max_count 张参考图片生成视频，参考视频最多 1 个。示例：综合 @图片 1 的主体与 @视频 1 的动态，生成一段氛围感短片。'),
                                'video.input_modes.omni_reference_mode.images_only' => '仅上传参考图片，最多支持 7 张。',
                                'video.input_modes.omni_reference_mode.image_and_video' => '同时上传参考图片和 1 个参考视频时，参考图片最多支持 6 张。',
                                'video.input_modes.video_edit' => '上传 1 个参考视频，结合文字指令对原视频进行编辑或改写。',
                                'video.input_modes.video_edit_mode.images_only' => '仅上传 1 个参考视频进行编辑。',
                                'video.input_modes.video_edit_mode.image_and_video' => '上传 1 个参考视频和最多 6 张参考图片进行编辑。',
                                'video.input_modes.keyframe_guided.start_end' => '用首帧定格起点，尾帧定格终点，搭配文字描述，让 AI 补全从起点到终点的动态故事。',
                                default => $key,
                            };
                        }

                        public function transChoice(string $key, $number, array $replace = [], ?string $locale = null): string
                        {
                            return $this->trans($key, $replace, $locale);
                        }

                        public function getLocale(): string
                        {
                            return 'zh_CN';
                        }

                        public function setLocale(string $locale)
                        {
                            return $this;
                        }
                    };
                }

                return null;
            }

            public function has(string $id): bool
            {
                return $id === TranslatorInterface::class;
            }
        });
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
            ['standard', 'omni_reference', VideoInputMode::VideoEdit->value, 'keyframe_guided'],
            array_keys($data['input_modes'])
        );
        $this->assertSame('generate', $data['input_modes']['omni_reference']['task']);
        $this->assertSame('edit', $data['input_modes'][VideoInputMode::VideoEdit->value]['task']);
        $this->assertSame(7, $data['input_modes'][VideoInputMode::VideoEdit->value]['max_count']);
        $this->assertArrayHasKey('variants', $data['input_modes'][VideoInputMode::VideoEdit->value]);
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

    public function testSupportsModelRejectsKnownKelingModelIdWithoutOmniVersion(): void
    {
        $adapter = $this->createAdapter();

        $this->assertFalse($adapter->supportsModel('kling-v4-omni', 'keling-video'));
        $this->assertNull($adapter->resolveGenerationConfig('kling-v4-omni', 'keling-video'));
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
                'prompt' => '让 {{image_1}} 的主体在 {{video_1}} 的动态里奔跑',
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
        $this->assertStringContainsString('<<<image_1>>>', $payload['prompt']);
        $this->assertStringContainsString('<<<video_1>>>', $payload['prompt']);
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
