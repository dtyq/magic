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

readonly class KelingV3GenerationCapabilityProvider implements KelingGenerationCapabilityProviderInterface
{
    private const string MODEL_ID = 'keling-3.0-video';

    private const string PROVIDER_MODEL_NAME = 'kling-v3';

    private const string LEGACY_MODEL_VERSION = 'kling-v3';

    private const int DEFAULT_DURATION_SECONDS = 5;

    private const string DEFAULT_MODE = 'std';

    /**
     * @var list<string>
     */
    private const array SUPPORTED_ASPECT_RATIOS = ['16:9', '9:16', '1:1'];

    /**
     * @var list<int>
     */
    private const array SUPPORTED_DURATIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

    /**
     * @var list<string>
     */
    private const array SUPPORTED_RESOLUTIONS = ['720p', '1080p', '4k'];

    /**
     * @var array<string, string>
     */
    private const array RESOLUTION_TO_MODE = [
        '720p' => 'std',
        '1080p' => 'pro',
        '4k' => '4k',
    ];

    /**
     * @var array<string, string>
     */
    private const array MODE_TO_RESOLUTION = [
        'std' => '720p',
        'pro' => '1080p',
        '4k' => '4k',
    ];

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
        ['label' => '16:9', 'value' => '3840x2160', 'width' => 3840, 'height' => 2160, 'resolution' => '4k'],
        ['label' => '9:16', 'value' => '2160x3840', 'width' => 2160, 'height' => 3840, 'resolution' => '4k'],
        ['label' => '1:1', 'value' => '2880x2880', 'width' => 2880, 'height' => 2880, 'resolution' => '4k'],
    ];

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        $normalizedModelId = strtolower(trim($modelId));
        if ($normalizedModelId === self::MODEL_ID) {
            return true;
        }

        return in_array(strtolower(trim($modelVersion)), [
            strtolower(self::LEGACY_MODEL_VERSION),
            'maas_keling_3.0_video',
        ], true);
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        if (! $this->supportsModel($modelVersion, $modelId)) {
            return null;
        }

        return new VideoGenerationConfig([
            'generation' => [
                'aspect_ratios' => self::SUPPORTED_ASPECT_RATIOS,
                'durations' => self::SUPPORTED_DURATIONS,
                'default_duration_seconds' => self::DEFAULT_DURATION_SECONDS,
                'resolutions' => self::SUPPORTED_RESOLUTIONS,
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

    public function providerModelName(): string
    {
        return self::PROVIDER_MODEL_NAME;
    }

    private function translateInputMode(string $key, array $replace = []): string
    {
        return di(TranslatorInterface::class)->trans('video.input_modes.' . $key, $replace);
    }
}
