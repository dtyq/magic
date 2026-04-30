<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Capability;

use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputModeDefinition;

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
    ];

    /**
     * 平台分辨率反查厂商 mode 的映射关系。
     *
     * @var array<string, string>
     */
    private const array RESOLUTION_TO_MODE = [
        '720p' => 'std',
        '1080p' => 'pro',
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
            // 参考图最多 7 张，同时支持素材图与风格图两种引用方式。
            'reference_images' => [
                'max_count' => 7,
                'reference_types' => ['asset', 'style'],
                'style_supported' => true,
            ],
            // 生成参数使用当前可灵 Omni 的公开能力边界。
            'generation' => [
                'aspect_ratios' => ['16:9', '9:16', '1:1'],
                'durations' => [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
                'default_duration_seconds' => self::DEFAULT_DURATION_SECONDS,
                'resolutions' => ['720p', '1080p'],
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
                VideoInputMode::Standard->value => VideoInputModeDefinition::standard('standard')->toArray(),
                VideoInputMode::ImageReference->value => VideoInputModeDefinition::imageReference(
                    description: 'image_reference',
                    maxCount: 7,
                    referenceTypes: ['asset', 'style'],
                    styleSupported: true,
                )->toArray(),
                VideoInputMode::OmniReference->value => VideoInputModeDefinition::omniReference(
                    description: 'omni_reference',
                    supportedFields: ['reference_images', 'reference_videos'],
                    maxCount: 12,
                )->toArray(),
                VideoInputMode::VideoEdit->value => VideoInputModeDefinition::videoEdit(
                    description: VideoInputMode::VideoEdit->value,
                    maxCount: 1,
                )->toArray(),
                VideoInputMode::KeyframeGuided->value => VideoInputModeDefinition::keyframeGuided(
                    description: 'keyframe_guided',
                    frameRoles: ['start', 'end'],
                )->toArray(),
            ],
            // 预留给后续更细的模型约束，目前暂为空。
            'constraints' => [],
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
}
