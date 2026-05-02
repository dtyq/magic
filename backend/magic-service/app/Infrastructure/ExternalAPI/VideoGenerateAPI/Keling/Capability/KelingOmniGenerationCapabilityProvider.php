<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Capability;

use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputModeDefinition;
use Hyperf\Contract\TranslatorInterface;

readonly class KelingOmniGenerationCapabilityProvider implements KelingGenerationCapabilityProviderInterface
{
    /**
     * 兼容当前项目里的逻辑模型标识与历史别名。
     *
     * @var array<int, string>
     */
    private const array MODEL_IDS = ['keling-video', 'kling-v3-omni'];

    /**
     * 当前 Keling Omni 支持的模型版本集合。
     *
     * @var array<int, string>
     */
    private const array MODEL_VERSIONS = ['kling-v3-omni', 'maas_kl_o3'];

    /**
     * 未显式传入时，默认按 5 秒生成。
     */
    private const int DEFAULT_DURATION_SECONDS = 5;

    /**
     * 默认画质档位，对应 720p。
     */
    private const string DEFAULT_MODE = 'std';

    /**
     * 厂商 mode 与平台分辨率的映射关系。
     *
     * @var array<string, string>
     */
    private const array MODE_TO_RESOLUTION = [
        'std' => '720p',
        'pro' => '1080p',
        '4k' => '4k',
    ];

    /**
     * 平台分辨率反查厂商 mode 的映射关系。
     *
     * @var array<string, string>
     */
    private const array RESOLUTION_TO_MODE = [
        '720p' => 'std',
        '1080p' => 'pro',
        '4k' => '4k',
    ];

    /**
     * 当前对前端下发的尺寸选项，按分辨率和比例展开。
     *
     * @var list<array{label: string, value: string, width: int, height: int, resolution: string}>
     */
    private const array SUPPORTED_SIZES = [
        ['label' => '16:9', 'value' => '1280x720', 'width' => 1280, 'height' => 720, 'resolution' => '720p'],
        ['label' => '9:16', 'value' => '720x1280', 'width' => 720, 'height' => 1280, 'resolution' => '720p'],
        ['label' => '1:1', 'value' => '960x960', 'width' => 960, 'height' => 960, 'resolution' => '720p'],
        ['label' => '16:9', 'value' => '1920x1080', 'width' => 1920, 'height' => 1080, 'resolution' => '1080p'],
        ['label' => '9:16', 'value' => '1080x1920', 'width' => 1080, 'height' => 1920, 'resolution' => '1080p'],
        ['label' => '1:1', 'value' => '1440x1440', 'width' => 1440, 'height' => 1440, 'resolution' => '1080p'],
        ['label' => '16:9', 'value' => '3840x2160', 'width' => 3840, 'height' => 2160, 'resolution' => '4k'],
        ['label' => '9:16', 'value' => '2160x3840', 'width' => 2160, 'height' => 3840, 'resolution' => '4k'],
        ['label' => '1:1', 'value' => '2880x2880', 'width' => 2880, 'height' => 2880, 'resolution' => '4k'],
    ];

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        $normalizedModelId = strtolower(trim($modelId));
        if ($normalizedModelId !== '') {
            return in_array($normalizedModelId, self::MODEL_IDS, true)
                || in_array(strtolower(trim($modelVersion)), self::MODEL_VERSIONS, true);
        }

        return in_array(strtolower(trim($modelVersion)), self::MODEL_VERSIONS, true);
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        if (! $this->supportsModel($modelVersion, $modelId)) {
            return null;
        }

        return new VideoGenerationConfig([
            // Keling Omni 当前支持文本、图片、首尾帧、参考图、参考视频与视频编辑输入。
            'supported_inputs' => ['text_prompt', 'image', 'last_frame', 'reference_images', 'reference_videos', VideoInputMode::VideoEdit->value],
            // 生成参数使用当前可灵 Omni 的公开能力边界。
            'generation' => [
                'aspect_ratios' => ['16:9', '9:16', '1:1'],
                'durations' => [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
                'default_duration_seconds' => self::DEFAULT_DURATION_SECONDS,
                'resolutions' => ['720p', '1080p', '4k'],
                'sizes' => self::SUPPORTED_SIZES,
                'default_resolution' => self::MODE_TO_RESOLUTION[self::DEFAULT_MODE],
                'supports_seed' => false,
                'supports_watermark' => true,
                'supports_negative_prompt' => true,
                'supports_generate_audio' => true,
                'supports_person_generation' => false,
                'supports_enhance_prompt' => false,
                'supports_compression_quality' => false,
                'supports_resize_mode' => false,
                'supports_sample_count' => false,
            ],
            // input_modes 给前端展示用，同时携带提交时需要的 task 信息。
            'input_modes' => [
                VideoInputMode::Standard->value => VideoInputModeDefinition::standard(
                    $this->translateInputMode('standard'),
                )->toArray(),
                VideoInputMode::OmniReference->value => VideoInputModeDefinition::omniReference(
                    description: $this->translateInputMode('omni_reference', [
                        'max_count' => 7,
                    ]),
                    supportedFields: ['reference_images', 'reference_videos'],
                    maxCount: 7,
                    variants: [
                        [
                            'code' => 'images_only',
                            'description' => $this->translateInputMode('omni_reference.images_only'),
                            'limits' => [
                                'reference_images' => ['min' => 1, 'max' => 7],
                                'reference_videos' => ['max' => 0],
                            ],
                        ],
                        [
                            'code' => 'image_and_video',
                            'description' => $this->translateInputMode('omni_reference.image_and_video'),
                            'limits' => [
                                'reference_images' => ['min' => 1, 'max' => 6],
                                'reference_videos' => ['min' => 1, 'max' => 1],
                            ],
                        ],
                    ],
                )->toArray(),
                VideoInputMode::VideoEdit->value => VideoInputModeDefinition::videoEdit(
                    description: $this->translateInputMode(VideoInputMode::VideoEdit->value),
                    maxCount: 1,
                )->toArray(),
                VideoInputMode::KeyframeGuided->value => VideoInputModeDefinition::keyframeGuided(
                    description: $this->translateInputMode('keyframe_guided.start_end'),
                    frameRoles: ['start', 'end'],
                )->toArray(),
            ],
        ]);
    }

    public function resolveGenerationMode(array $generation): string
    {
        $resolution = strtolower(trim((string) ($generation['resolution'] ?? '')));
        if ($resolution !== '' && array_key_exists($resolution, self::RESOLUTION_TO_MODE)) {
            return self::RESOLUTION_TO_MODE[$resolution];
        }

        $mode = strtolower(trim((string) ($generation['mode'] ?? '')));
        if ($mode !== '' && array_key_exists($mode, self::MODE_TO_RESOLUTION)) {
            return $mode;
        }

        return self::DEFAULT_MODE;
    }

    public function resolveDuration(array $generation): string
    {
        $duration = (int) ($generation['duration_seconds'] ?? self::DEFAULT_DURATION_SECONDS);
        if ($duration <= 0) {
            $duration = self::DEFAULT_DURATION_SECONDS;
        }

        return (string) $duration;
    }

    private function translateInputMode(string $key, array $replace = []): string
    {
        return di(TranslatorInterface::class)->trans('video.input_modes.' . $key, $replace);
    }
}
