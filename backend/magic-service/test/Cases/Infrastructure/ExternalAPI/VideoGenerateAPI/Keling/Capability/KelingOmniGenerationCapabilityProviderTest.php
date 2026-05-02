<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Capability;

use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Capability\KelingOmniGenerationCapabilityProvider;
use Hyperf\Context\ApplicationContext;
use Hyperf\Contract\TranslatorInterface;
use PHPUnit\Framework\TestCase;
use Psr\Container\ContainerInterface;

/**
 * @internal
 */
class KelingOmniGenerationCapabilityProviderTest extends TestCase
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
                                'video.input_modes.omni_reference.images_only' => '仅上传参考图片，最多支持 7 张。',
                                'video.input_modes.omni_reference.image_and_video' => '同时上传参考图片和 1 个参考视频时，参考图片最多支持 6 张。',
                                'video.input_modes.video_edit' => '上传 1 个参考视频，结合文字指令对原视频进行编辑或改写。',
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
        $provider = new KelingOmniGenerationCapabilityProvider();

        $config = $provider->resolveGenerationConfig('kling-v3-omni', 'keling-video');

        $this->assertInstanceOf(VideoGenerationConfig::class, $config);
        $data = $config->toArray();
        $this->assertSame(['text_prompt', 'image', 'last_frame', 'reference_images', 'reference_videos', VideoInputMode::VideoEdit->value], $data['supported_inputs']);
        $this->assertSame(5, $data['generation']['default_duration_seconds']);
        $this->assertSame('720p', $data['generation']['default_resolution']);
        $this->assertSame(['720p', '1080p', '4k'], $data['generation']['resolutions']);
        $this->assertSame([
            ['label' => '16:9', 'value' => '1280x720', 'width' => 1280, 'height' => 720, 'resolution' => '720p'],
            ['label' => '9:16', 'value' => '720x1280', 'width' => 720, 'height' => 1280, 'resolution' => '720p'],
            ['label' => '1:1', 'value' => '960x960', 'width' => 960, 'height' => 960, 'resolution' => '720p'],
            ['label' => '16:9', 'value' => '1920x1080', 'width' => 1920, 'height' => 1080, 'resolution' => '1080p'],
            ['label' => '9:16', 'value' => '1080x1920', 'width' => 1080, 'height' => 1920, 'resolution' => '1080p'],
            ['label' => '1:1', 'value' => '1440x1440', 'width' => 1440, 'height' => 1440, 'resolution' => '1080p'],
            ['label' => '16:9', 'value' => '3840x2160', 'width' => 3840, 'height' => 2160, 'resolution' => '4k'],
            ['label' => '9:16', 'value' => '2160x3840', 'width' => 2160, 'height' => 3840, 'resolution' => '4k'],
            ['label' => '1:1', 'value' => '2880x2880', 'width' => 2880, 'height' => 2880, 'resolution' => '4k'],
        ], $data['generation']['sizes']);
        $this->assertSame(
            ['standard', 'omni_reference', VideoInputMode::VideoEdit->value, 'keyframe_guided'],
            array_keys($data['input_modes'])
        );
        $this->assertSame('普通文生视频模式，不依赖任何参考素材。', $data['input_modes']['standard']['description']);
        $this->assertSame('上传 1~7 张参考图片生成视频，参考视频最多 1 个。示例：综合 @图片 1 的主体与 @视频 1 的动态，生成一段氛围感短片。', $data['input_modes']['omni_reference']['description']);
        $this->assertSame(7, $data['input_modes']['omni_reference']['max_count']);
        $this->assertSame([
            [
                'code' => 'images_only',
                'description' => '仅上传参考图片，最多支持 7 张。',
                'limits' => [
                    'reference_images' => ['min' => 1, 'max' => 7],
                    'reference_videos' => ['max' => 0],
                ],
            ],
            [
                'code' => 'image_and_video',
                'description' => '同时上传参考图片和 1 个参考视频时，参考图片最多支持 6 张。',
                'limits' => [
                    'reference_images' => ['min' => 1, 'max' => 6],
                    'reference_videos' => ['min' => 1, 'max' => 1],
                ],
            ],
        ], $data['input_modes']['omni_reference']['variants']);
        $this->assertSame('上传 1 个参考视频，结合文字指令对原视频进行编辑或改写。', $data['input_modes'][VideoInputMode::VideoEdit->value]['description']);
        $this->assertSame('用首帧定格起点，尾帧定格终点，搭配文字描述，让 AI 补全从起点到终点的动态故事。', $data['input_modes']['keyframe_guided']['description']);
        $this->assertSame('generate', $data['input_modes']['omni_reference']['task']);
        $this->assertSame('edit', $data['input_modes'][VideoInputMode::VideoEdit->value]['task']);
    }

    public function testSupportsModelAcceptsConfiguredIdsOrVersions(): void
    {
        $provider = new KelingOmniGenerationCapabilityProvider();

        $this->assertTrue($provider->supportsModel('kling-v3-omni', 'kling-v3-omni'));
        $this->assertTrue($provider->supportsModel('kling-v3-omni', 'keling-3.0-video'));
        $this->assertTrue($provider->supportsModel('kling-v4-omni', 'keling-video'));
    }

    public function testResolveGenerationModeAndDurationUseCapabilityDefaults(): void
    {
        $provider = new KelingOmniGenerationCapabilityProvider();

        $this->assertSame('pro', $provider->resolveGenerationMode(['resolution' => '1080p']));
        $this->assertSame('4k', $provider->resolveGenerationMode(['resolution' => '4k']));
        $this->assertSame('std', $provider->resolveGenerationMode(['mode' => 'std']));
        $this->assertSame('4k', $provider->resolveGenerationMode(['mode' => '4k']));
        $this->assertSame('std', $provider->resolveGenerationMode([]));

        $this->assertSame('8', $provider->resolveDuration(['duration_seconds' => 8]));
        $this->assertSame('5', $provider->resolveDuration([]));
        $this->assertSame('5', $provider->resolveDuration(['duration_seconds' => 0]));
    }
}
