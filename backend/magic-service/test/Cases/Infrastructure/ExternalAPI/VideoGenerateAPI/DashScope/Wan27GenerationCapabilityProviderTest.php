<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope;

use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Capability\Wan27GenerationCapabilityProvider;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;

/**
 * @internal
 */
class Wan27GenerationCapabilityProviderTest extends TestCase
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
                                'video.input_modes.image_reference.single' => '上传 1 张参考图，搭配文字，生成高度匹配视频。示例：参考 @图片 1，生成动态视频。',
                                'video.input_modes.omni_reference' => str_replace(':max_count', (string) ($replace['max_count'] ?? ''), '上传 1~:max_count 张参考图片生成视频，参考视频最多 1 个。'),
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

    public function testSupportsModelAcceptsWan27Models(): void
    {
        $provider = new Wan27GenerationCapabilityProvider();

        $this->assertTrue($provider->supportsModel('', 'wan2.7'));
        $this->assertTrue($provider->supportsModel('wan2.7', ''));
        $this->assertTrue($provider->supportsModel('', 'wan2.7-t2v'));
        $this->assertTrue($provider->supportsModel('', 'wan2.7-i2v'));
        $this->assertTrue($provider->supportsModel('', 'wan2.7-r2v'));
        $this->assertTrue($provider->supportsModel('wan2.7-t2v', ''));
        $this->assertTrue($provider->supportsModel('wan2.7-i2v', ''));
        $this->assertTrue($provider->supportsModel('wan2.7-r2v', ''));
    }

    public function testSupportsModelRejectsUnknownModels(): void
    {
        $provider = new Wan27GenerationCapabilityProvider();

        $this->assertFalse($provider->supportsModel('wan2.6-t2v', 'wan2.6-t2v'));
        $this->assertFalse($provider->supportsModel('', 'unknown'));
        $this->assertNull($provider->resolveGenerationConfig('', 'unknown'));
    }

    public function testResolveGenerationConfigExposesWan27GenerationCapability(): void
    {
        $provider = new Wan27GenerationCapabilityProvider();

        $config = $provider->resolveGenerationConfig('wan2.7', '');

        $this->assertInstanceOf(VideoGenerationConfig::class, $config);
        $data = $config->toArray();
        $this->assertSame(['text_prompt', 'image', 'last_frame', 'reference_images', 'reference_videos'], $data['supported_inputs']);
        $this->assertNotContains(VideoInputMode::VideoEdit->value, $data['supported_inputs']);
        $this->assertSame(['16:9', '9:16', '1:1'], $data['generation']['aspect_ratios']);
        $this->assertSame([2, 3, 4, 5, 6, 7, 8, 9, 10], $data['generation']['durations']);
        $this->assertSame(5, $data['generation']['default_duration_seconds']);
        $this->assertSame(['720p', '1080p'], $data['generation']['resolutions']);
        $this->assertSame('720p', $data['generation']['default_resolution']);
        $this->assertTrue($data['generation']['supports_seed']);
        $this->assertTrue($data['generation']['supports_watermark']);
        $this->assertTrue($data['generation']['supports_negative_prompt']);
        $this->assertTrue($data['generation']['supports_generate_audio']);
        $this->assertFalse($data['generation']['supports_person_generation']);
        $this->assertTrue($data['generation']['supports_enhance_prompt']);
        $this->assertFalse($data['generation']['supports_compression_quality']);
        $this->assertFalse($data['generation']['supports_resize_mode']);
        $this->assertFalse($data['generation']['supports_sample_count']);
        $this->assertSame([
            ['label' => '16:9', 'value' => '1280x720', 'width' => 1280, 'height' => 720, 'resolution' => '720p'],
            ['label' => '9:16', 'value' => '720x1280', 'width' => 720, 'height' => 1280, 'resolution' => '720p'],
            ['label' => '1:1', 'value' => '960x960', 'width' => 960, 'height' => 960, 'resolution' => '720p'],
            ['label' => '16:9', 'value' => '1920x1080', 'width' => 1920, 'height' => 1080, 'resolution' => '1080p'],
            ['label' => '9:16', 'value' => '1080x1920', 'width' => 1080, 'height' => 1920, 'resolution' => '1080p'],
            ['label' => '1:1', 'value' => '1440x1440', 'width' => 1440, 'height' => 1440, 'resolution' => '1080p'],
        ], $data['generation']['sizes']);
        $this->assertSame(
            ['standard', 'image_reference', 'omni_reference', 'keyframe_guided'],
            array_keys($data['input_modes'])
        );
        $this->assertArrayNotHasKey(VideoInputMode::VideoEdit->value, $data['input_modes']);
        $this->assertSame(['reference_images'], $data['input_modes']['image_reference']['supported_fields']);
        $this->assertSame(1, $data['input_modes']['image_reference']['reference_images']['max_count']);
        $this->assertSame(['asset'], $data['input_modes']['image_reference']['reference_images']['reference_types']);
        $this->assertFalse($data['input_modes']['image_reference']['reference_images']['style_supported']);
        $this->assertSame(['reference_images', 'reference_videos'], $data['input_modes']['omni_reference']['supported_fields']);
        $this->assertSame(4, $data['input_modes']['omni_reference']['max_count']);
        $this->assertSame(['start', 'end'], $data['input_modes']['keyframe_guided']['frame_roles']);
    }

    public function testResolveProviderModelNameByInputMode(): void
    {
        $provider = new Wan27GenerationCapabilityProvider();

        $this->assertSame('wan2.7-t2v', $provider->resolveProviderModelName(VideoInputMode::Standard->value));
        $this->assertSame('wan2.7-i2v', $provider->resolveProviderModelName(VideoInputMode::ImageReference->value));
        $this->assertSame('wan2.7-i2v', $provider->resolveProviderModelName(VideoInputMode::KeyframeGuided->value));
        $this->assertSame('wan2.7-r2v', $provider->resolveProviderModelName(VideoInputMode::OmniReference->value));
    }

    public function testResolveGenerationConfigKeepsLongDurationsForConcreteT2vModel(): void
    {
        $provider = new Wan27GenerationCapabilityProvider();

        $config = $provider->resolveGenerationConfig('', 'wan2.7-t2v');

        $this->assertInstanceOf(VideoGenerationConfig::class, $config);
        $this->assertSame([2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15], $config->toArray()['generation']['durations']);
    }
}
