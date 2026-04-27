<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfigCandidate;
use App\Domain\ModelGateway\Service\VideoGenerationConfigDomainService;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayKelingVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswaySeedanceVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVeoVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoAdapterRouter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\CloudswayVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VideoGenerateFactory;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArkSeedanceVideoAdapter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArkVideoClient;
use Hyperf\Guzzle\ClientFactory;
use PHPUnit\Framework\TestCase;

/**
 * @internal
 */
class VideoGenerationConfigDomainServiceTest extends TestCase
{
    public function testResolveFeaturedSkipsUnconfiguredProviderAndIntersectsConfigs(): void
    {
        $service = $this->createService();

        $configs = $service->resolveFeatured([
            new VideoGenerationConfigCandidate('veo-3.1-fast-generate-preview', 'LCnVzCkkMnVulyrz', ProviderCode::Cloudsway),
            new VideoGenerationConfigCandidate('veo-3.1-fast-generate-preview', 'veo3.1_fast', ProviderCode::OpenAI),
        ]);

        $config = $configs['veo-3.1-fast-generate-preview'] ?? null;
        $this->assertInstanceOf(VideoGenerationConfig::class, $config);
        $this->assertSame(['16:9', '9:16'], $config->toArray()['generation']['aspect_ratios']);
        $this->assertSame(['720p', '1080p', '4k'], $config->toArray()['generation']['resolutions']);
        $this->assertCount(5, $config->toArray()['generation']['sizes']);
    }

    public function testResolveRejectsUnsupportedProviderCode(): void
    {
        $service = $this->createService();

        $veoConfig = $service->resolve('veo3.1_fast', 'veo-3.1-fast-generate-preview', ProviderCode::OpenAI);

        $this->assertNull($veoConfig);
    }

    public function testResolveReturnsVolcengineArkSeedanceConfig(): void
    {
        $service = $this->createService();

        $config = $service->resolve(
            'doubao-seedance-2-0-260128',
            'doubao-seedance-2-0-260128',
            ProviderCode::VolcengineArk,
        );

        $this->assertInstanceOf(VideoGenerationConfig::class, $config);
        $this->assertContains('reference_videos', $config->toArray()['supported_inputs']);
        $this->assertContains('reference_audios', $config->toArray()['supported_inputs']);
        $this->assertNotContains('video', $config->toArray()['supported_inputs']);
        $this->assertContains('video_edit', $config->toArray()['supported_inputs']);
        $this->assertContains('video_extension', $config->toArray()['supported_inputs']);
        $this->assertContains('video_upscale', $config->toArray()['supported_inputs']);
        $this->assertSame(['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'], $config->toArray()['generation']['aspect_ratios']);
        $this->assertSame([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], $config->toArray()['generation']['durations']);
        $this->assertSame(['480p', '720p', '1080p'], $config->toArray()['generation']['resolutions']);
        $this->assertSame([-1, 4294967295], $config->toArray()['generation']['seed_range']);
        $this->assertTrue($config->toArray()['generation']['supports_watermark']);
        $this->assertTrue($config->toArray()['generation']['supports_generate_audio']);
        $this->assertSame(9, $config->toArray()['reference_images']['max_count']);
        $this->assertArrayHasKey('input_modes', $config->toArray());
        $this->assertSame(['reference_images'], $config->toArray()['input_modes']['image_reference']['supported_fields']);
        $this->assertSame(9, $config->toArray()['input_modes']['image_reference']['reference_images']['max_count']);
        $this->assertStringContainsString('上传1~9 张参考图片', $config->toArray()['input_modes']['image_reference']['description']);
        $this->assertSame(['reference_images', 'reference_videos', 'reference_audios'], $config->toArray()['input_modes']['omni_reference']['supported_fields']);
        $this->assertSame(12, $config->toArray()['input_modes']['omni_reference']['max_count']);
        $this->assertStringContainsString('上传1~12 份图 / 视 / 音参考素材', $config->toArray()['input_modes']['omni_reference']['description']);
        $this->assertSame(['start', 'end'], $config->toArray()['input_modes']['keyframe_guided']['frame_roles']);
        $this->assertStringContainsString('首尾帧', $config->toArray()['input_modes']['keyframe_guided']['description']);
    }

    public function testResolveBuildsModeDescriptionsFromConfig(): void
    {
        $service = $this->createService();

        $seedanceConfig = $service->resolve('rrpvTsUlqilBwMXg', 'seedance-1.5-pro', ProviderCode::Cloudsway);
        $veoConfig = $service->resolve('LCnVzCkkMnVulyrz', 'veo-3.1-generate-preview', ProviderCode::Cloudsway);

        $this->assertInstanceOf(VideoGenerationConfig::class, $seedanceConfig);
        $this->assertInstanceOf(VideoGenerationConfig::class, $veoConfig);
        $this->assertStringContainsString('只支持首帧', $seedanceConfig->toArray()['input_modes']['keyframe_guided']['description']);
        $this->assertStringContainsString('上传1~3 张参考图片', $veoConfig->toArray()['input_modes']['image_reference']['description']);
    }

    public function testIntersectShrinksBooleanListRangeAndConstraintFields(): void
    {
        $service = $this->createService();
        $left = new VideoGenerationConfig([
            'supported_inputs' => ['text_prompt', 'image', 'reference_images', 'video_extension'],
            'reference_images' => [
                'max_count' => 3,
                'reference_types' => ['asset', 'style'],
                'style_supported' => true,
            ],
            'generation' => [
                'aspect_ratios' => ['16:9', '9:16', '1:1'],
                'durations' => [4, 6, 8],
                'default_duration_seconds' => 8,
                'resolutions' => ['720p', '1080p'],
                'sizes' => [
                    ['label' => '16:9', 'value' => '1280x720', 'width' => 1280, 'height' => 720, 'resolution' => '720p'],
                    ['label' => '16:9', 'value' => '1920x1080', 'width' => 1920, 'height' => 1080, 'resolution' => '1080p'],
                    ['label' => '9:16', 'value' => '1080x1920', 'width' => 1080, 'height' => 1920, 'resolution' => '1080p'],
                ],
                'default_resolution' => '720p',
                'supports_seed' => true,
                'seed_range' => [0, 100],
                'supports_negative_prompt' => true,
                'supports_generate_audio' => true,
                'supports_person_generation' => true,
                'person_generation_options' => ['allow_adult', 'allow_all'],
                'supports_enhance_prompt' => true,
                'supports_compression_quality' => true,
                'compression_quality_options' => ['optimized', 'lossless'],
                'supports_resize_mode' => true,
                'resize_mode_options' => ['pad', 'crop'],
                'supports_sample_count' => true,
                'sample_count_range' => [1, 4],
            ],
            'constraints' => [
                'reference_images_requires_duration_seconds' => 6,
                'high_resolution_requires_duration_seconds' => 8,
                'video_extension_output_resolution' => '720p',
            ],
            'input_modes' => [
                'standard' => ['description' => '普通文生视频模式，不依赖任何参考素材。', 'supported_fields' => []],
                'image_reference' => ['description' => '参考图模式，仅支持通过 reference_images 传入图片参考。', 'supported_fields' => ['reference_images']],
                'omni_reference' => ['description' => '全能参考模式，支持混合传入参考图、参考视频、参考音频，素材总数为 1 到 12 个。', 'supported_fields' => ['reference_images', 'reference_videos', 'reference_audios']],
                'keyframe_guided' => ['description' => '首尾帧引导模式，使用 frames 传入首帧和尾帧图片。', 'supported_fields' => ['frames'], 'frame_roles' => ['start', 'end']],
            ],
        ]);
        $right = new VideoGenerationConfig([
            'supported_inputs' => ['text_prompt', 'image', 'reference_images'],
            'reference_images' => [
                'max_count' => 1,
                'reference_types' => ['asset'],
                'style_supported' => false,
            ],
            'generation' => [
                'aspect_ratios' => ['16:9', '1:1'],
                'durations' => [6, 8],
                'default_duration_seconds' => 8,
                'resolutions' => ['720p', '4k'],
                'sizes' => [
                    ['label' => '16:9', 'value' => '1280x720', 'width' => 1280, 'height' => 720, 'resolution' => '720p'],
                    ['label' => '9:16', 'value' => '2160x3840', 'width' => 2160, 'height' => 3840, 'resolution' => '4k'],
                ],
                'default_resolution' => '720p',
                'supports_seed' => true,
                'seed_range' => [10, 20],
                'supports_negative_prompt' => false,
                'supports_generate_audio' => false,
                'supports_person_generation' => true,
                'person_generation_options' => ['allow_adult'],
                'supports_enhance_prompt' => false,
                'supports_compression_quality' => true,
                'compression_quality_options' => ['optimized'],
                'supports_resize_mode' => false,
                'resize_mode_options' => ['pad'],
                'supports_sample_count' => true,
                'sample_count_range' => [2, 3],
            ],
            'constraints' => [
                'reference_images_requires_duration_seconds' => 8,
                'high_resolution_requires_duration_seconds' => 10,
            ],
            'input_modes' => [
                'standard' => ['description' => '普通文生视频模式，不依赖任何参考素材。', 'supported_fields' => []],
                'image_reference' => ['description' => '参考图模式，仅支持通过 reference_images 传入图片参考。', 'supported_fields' => ['reference_images']],
                'omni_reference' => ['description' => '全能参考模式，支持混合传入参考图、参考视频、参考音频，素材总数为 1 到 12 个。', 'supported_fields' => ['reference_images', 'reference_videos', 'reference_audios']],
            ],
        ]);

        $config = $service->intersect($left, $right);

        $this->assertSame(['text_prompt', 'image', 'reference_images'], $config->toArray()['supported_inputs']);
        $this->assertSame(1, $config->toArray()['reference_images']['max_count']);
        $this->assertSame(['asset'], $config->toArray()['reference_images']['reference_types']);
        $this->assertFalse($config->toArray()['reference_images']['style_supported']);
        $this->assertSame(['16:9'], $config->toArray()['generation']['aspect_ratios']);
        $this->assertSame([6, 8], $config->toArray()['generation']['durations']);
        $this->assertSame(['720p'], $config->toArray()['generation']['resolutions']);
        $this->assertSame([
            ['label' => '16:9', 'value' => '1280x720', 'width' => 1280, 'height' => 720, 'resolution' => '720p'],
        ], $config->toArray()['generation']['sizes']);
        $this->assertSame('720p', $config->toArray()['generation']['default_resolution']);
        $this->assertSame(8, $config->toArray()['generation']['default_duration_seconds']);
        $this->assertTrue($config->toArray()['generation']['supports_seed']);
        $this->assertSame([10, 20], $config->toArray()['generation']['seed_range']);
        $this->assertFalse($config->toArray()['generation']['supports_negative_prompt']);
        $this->assertFalse($config->toArray()['generation']['supports_generate_audio']);
        $this->assertTrue($config->toArray()['generation']['supports_person_generation']);
        $this->assertSame(['allow_adult'], $config->toArray()['generation']['person_generation_options']);
        $this->assertFalse($config->toArray()['generation']['supports_enhance_prompt']);
        $this->assertTrue($config->toArray()['generation']['supports_compression_quality']);
        $this->assertSame(['optimized'], $config->toArray()['generation']['compression_quality_options']);
        $this->assertFalse($config->toArray()['generation']['supports_resize_mode']);
        $this->assertArrayNotHasKey('resize_mode_options', $config->toArray()['generation']);
        $this->assertTrue($config->toArray()['generation']['supports_sample_count']);
        $this->assertSame([2, 3], $config->toArray()['generation']['sample_count_range']);
        $this->assertSame([
            'reference_images_requires_duration_seconds' => 8,
            'high_resolution_requires_duration_seconds' => 10,
        ], $config->toArray()['constraints']);
        $this->assertSame(
            ['standard', 'image_reference', 'omni_reference'],
            array_keys($config->toArray()['input_modes'])
        );
    }

    private function createService(): VideoGenerationConfigDomainService
    {
        return new VideoGenerationConfigDomainService(
            new VideoGenerateFactory(
                new CloudswayVideoAdapterRouter(
                    new CloudswayVeoVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class))),
                    new CloudswaySeedanceVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class))),
                    new CloudswayKelingVideoAdapter(new CloudswayVideoClient($this->createMock(ClientFactory::class))),
                ),
                new VolcengineArkSeedanceVideoAdapter(new VolcengineArkVideoClient($this->createMock(ClientFactory::class))),
            )
        );
    }
}
