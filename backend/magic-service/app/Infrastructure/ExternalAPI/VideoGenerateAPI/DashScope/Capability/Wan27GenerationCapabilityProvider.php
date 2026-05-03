<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Capability;

use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputModeDefinition;
use Hyperf\Contract\TranslatorInterface;

readonly class Wan27GenerationCapabilityProvider
{
    private const string LOGICAL_MODEL_NAME = 'wan2.7';

    private const string TEXT_TO_VIDEO_MODEL_NAME = 'wan2.7-t2v';

    private const string IMAGE_TO_VIDEO_MODEL_NAME = 'wan2.7-i2v';

    private const string REFERENCE_TO_VIDEO_MODEL_NAME = 'wan2.7-r2v';

    /**
     * @var list<string>
     */
    private const array SUPPORTED_MODEL_NAMES = [
        self::LOGICAL_MODEL_NAME,
        self::TEXT_TO_VIDEO_MODEL_NAME,
        self::IMAGE_TO_VIDEO_MODEL_NAME,
        self::REFERENCE_TO_VIDEO_MODEL_NAME,
    ];

    private const int DEFAULT_DURATION_SECONDS = 5;

    private const string DEFAULT_RESOLUTION = '720p';

    /**
     * @var list<string>
     */
    private const array SUPPORTED_ASPECT_RATIOS = ['16:9', '9:16', '1:1'];

    /**
     * @var list<int>
     */
    private const array SUPPORTED_DURATIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10];

    /**
     * @var list<int>
     */
    private const array LONG_VIDEO_DURATIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15];

    /**
     * @var list<string>
     */
    private const array SUPPORTED_RESOLUTIONS = ['720p', '1080p'];

    /**
     * @var list<array{label: string, value: string, width: int, height: int, resolution: string}>
     */
    private const array SUPPORTED_SIZES = [
        ['label' => '16:9', 'value' => '1280x720', 'width' => 1280, 'height' => 720, 'resolution' => '720p'],
        ['label' => '9:16', 'value' => '720x1280', 'width' => 720, 'height' => 1280, 'resolution' => '720p'],
        ['label' => '1:1', 'value' => '960x960', 'width' => 960, 'height' => 960, 'resolution' => '720p'],
        ['label' => '16:9', 'value' => '1920x1080', 'width' => 1920, 'height' => 1080, 'resolution' => '1080p'],
        ['label' => '9:16', 'value' => '1080x1920', 'width' => 1080, 'height' => 1920, 'resolution' => '1080p'],
        ['label' => '1:1', 'value' => '1440x1440', 'width' => 1440, 'height' => 1440, 'resolution' => '1080p'],
    ];

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        return in_array(strtolower(trim($modelId)), self::SUPPORTED_MODEL_NAMES, true)
            || in_array(strtolower(trim($modelVersion)), self::SUPPORTED_MODEL_NAMES, true);
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        if (! $this->supportsModel($modelVersion, $modelId)) {
            return null;
        }

        return new VideoGenerationConfig([
            'supported_inputs' => ['text_prompt', 'image', 'last_frame', 'reference_images', 'reference_videos'],
            'generation' => [
                'aspect_ratios' => self::SUPPORTED_ASPECT_RATIOS,
                'durations' => $this->resolveSupportedDurations($modelVersion, $modelId),
                'default_duration_seconds' => self::DEFAULT_DURATION_SECONDS,
                'resolutions' => self::SUPPORTED_RESOLUTIONS,
                'sizes' => self::SUPPORTED_SIZES,
                'default_resolution' => self::DEFAULT_RESOLUTION,
                'supports_seed' => true,
                'supports_watermark' => true,
                'supports_negative_prompt' => true,
                'supports_generate_audio' => true,
                'supports_person_generation' => false,
                'supports_enhance_prompt' => true,
                'supports_compression_quality' => false,
                'supports_resize_mode' => false,
                'supports_sample_count' => false,
            ],
            'input_modes' => [
                VideoInputMode::Standard->value => VideoInputModeDefinition::standard(
                    $this->translateInputMode('standard'),
                )->toArray(),
                VideoInputMode::ImageReference->value => VideoInputModeDefinition::imageReference(
                    description: $this->translateInputMode('image_reference.single'),
                    maxCount: 1,
                    referenceTypes: ['asset'],
                    styleSupported: false,
                )->toArray(),
                VideoInputMode::OmniReference->value => VideoInputModeDefinition::omniReference(
                    description: $this->translateInputMode('omni_reference', [
                        'max_count' => 4,
                    ]),
                    supportedFields: ['reference_images', 'reference_videos'],
                    maxCount: 4,
                )->toArray(),
                VideoInputMode::KeyframeGuided->value => VideoInputModeDefinition::keyframeGuided(
                    description: $this->translateInputMode('keyframe_guided.start_end'),
                    frameRoles: ['start', 'end'],
                )->toArray(),
            ],
        ]);
    }

    public function resolveProviderModelName(string $inputMode): string
    {
        return match ($inputMode) {
            VideoInputMode::ImageReference->value,
            VideoInputMode::KeyframeGuided->value => self::IMAGE_TO_VIDEO_MODEL_NAME,
            VideoInputMode::OmniReference->value => self::REFERENCE_TO_VIDEO_MODEL_NAME,
            default => self::TEXT_TO_VIDEO_MODEL_NAME,
        };
    }

    /**
     * 逻辑模型 wan2.7 需要对外暴露所有 input_mode 都安全的交集能力。
     * 只有明确指定到 t2v / i2v 具体模型时，才暴露 12s / 15s 的长视频能力。
     *
     * @return list<int>
     */
    private function resolveSupportedDurations(string $modelVersion, string $modelId): array
    {
        $normalizedModelId = strtolower(trim($modelId));
        $normalizedModelVersion = strtolower(trim($modelVersion));

        if (in_array($normalizedModelId, [self::TEXT_TO_VIDEO_MODEL_NAME, self::IMAGE_TO_VIDEO_MODEL_NAME], true)
            || in_array($normalizedModelVersion, [self::TEXT_TO_VIDEO_MODEL_NAME, self::IMAGE_TO_VIDEO_MODEL_NAME], true)) {
            return self::LONG_VIDEO_DURATIONS;
        }

        return self::SUPPORTED_DURATIONS;
    }

    private function translateInputMode(string $key, array $replace = []): string
    {
        return di(TranslatorInterface::class)->trans('video.input_modes.' . $key, $replace);
    }
}
