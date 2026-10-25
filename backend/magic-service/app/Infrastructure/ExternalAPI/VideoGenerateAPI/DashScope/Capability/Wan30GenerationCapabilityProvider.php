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
use InvalidArgumentException;

readonly class Wan30GenerationCapabilityProvider
{
    private const string MODEL_NAME = 'wan3.0-video';

    private const string PRIME_MODEL_NAME = 'wan3.0-video-prime';

    /** @var list<string> */
    private const array SUPPORTED_MODEL_NAMES = [
        self::MODEL_NAME,
        self::PRIME_MODEL_NAME,
    ];

    /** @var list<string> */
    private const array SUPPORTED_ASPECT_RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16'];

    /** @var list<string> */
    private const array SUPPORTED_RESOLUTIONS = ['480p', '720p', '1080p'];

    /** @var list<array{label: string, value: string, width: int, height: int, resolution: string}> */
    private const array SUPPORTED_SIZES = [
        ['label' => '16:9', 'value' => '864x496', 'width' => 864, 'height' => 496, 'resolution' => '480p'],
        ['label' => '4:3', 'value' => '752x560', 'width' => 752, 'height' => 560, 'resolution' => '480p'],
        ['label' => '1:1', 'value' => '640x640', 'width' => 640, 'height' => 640, 'resolution' => '480p'],
        ['label' => '3:4', 'value' => '560x752', 'width' => 560, 'height' => 752, 'resolution' => '480p'],
        ['label' => '9:16', 'value' => '496x864', 'width' => 496, 'height' => 864, 'resolution' => '480p'],
        ['label' => '16:9', 'value' => '1280x720', 'width' => 1280, 'height' => 720, 'resolution' => '720p'],
        ['label' => '4:3', 'value' => '1112x834', 'width' => 1112, 'height' => 834, 'resolution' => '720p'],
        ['label' => '1:1', 'value' => '960x960', 'width' => 960, 'height' => 960, 'resolution' => '720p'],
        ['label' => '3:4', 'value' => '834x1112', 'width' => 834, 'height' => 1112, 'resolution' => '720p'],
        ['label' => '9:16', 'value' => '720x1280', 'width' => 720, 'height' => 1280, 'resolution' => '720p'],
        ['label' => '16:9', 'value' => '1920x1080', 'width' => 1920, 'height' => 1080, 'resolution' => '1080p'],
        ['label' => '4:3', 'value' => '1668x1252', 'width' => 1668, 'height' => 1252, 'resolution' => '1080p'],
        ['label' => '1:1', 'value' => '1440x1440', 'width' => 1440, 'height' => 1440, 'resolution' => '1080p'],
        ['label' => '3:4', 'value' => '1252x1668', 'width' => 1252, 'height' => 1668, 'resolution' => '1080p'],
        ['label' => '9:16', 'value' => '1080x1920', 'width' => 1080, 'height' => 1920, 'resolution' => '1080p'],
    ];

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        return $this->resolveRequestedModel($modelVersion, $modelId) !== null;
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        if (! $this->supportsModel($modelVersion, $modelId)) {
            return null;
        }

        $keyframeGuided = VideoInputModeDefinition::keyframeGuided(
            description: $this->translateInputMode('keyframe_guided.start_end'),
            frameRoles: ['start', 'end'],
        )->toArray();
        $keyframeGuided['limits'] = [
            'start' => ['min' => 1, 'max' => 1],
            'end' => ['max' => 1],
        ];
        $keyframeGuided['role_aliases'] = ['first' => 'start', 'last' => 'end'];

        return new VideoGenerationConfig([
            'generation' => [
                'aspect_ratios' => self::SUPPORTED_ASPECT_RATIOS,
                'duration_type' => 'range',
                'durations' => ['min' => 2, 'max' => 30, 'step' => 1],
                'default_duration_seconds' => 5,
                'resolutions' => self::SUPPORTED_RESOLUTIONS,
                'sizes' => self::SUPPORTED_SIZES,
                'default_resolution' => '720p',
                'supports_seed' => true,
                'supports_watermark' => true,
                'supports_generate_audio' => true,
                'supports_enhance_prompt' => true,
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
                VideoInputMode::KeyframeGuided->value => $keyframeGuided,
                VideoInputMode::OmniReference->value => VideoInputModeDefinition::omniReference(
                    description: $this->translateInputMode('wan30_omni_reference'),
                    supportedFields: ['reference_images', 'reference_videos', 'reference_audios'],
                    maxCount: 20,
                    variants: [
                        ['code' => 'reference_image', 'description' => $this->translateInputMode('reference_image'), 'limits' => ['count' => ['max' => 10]]],
                        ['code' => 'reference_video', 'description' => $this->translateInputMode('reference_video'), 'limits' => ['count' => ['max' => 5], 'duration_seconds' => ['max' => 15], 'total_duration_seconds' => ['max' => 15]]],
                        ['code' => 'reference_audio', 'description' => $this->translateInputMode('reference_audio'), 'limits' => ['count' => ['max' => 5], 'duration_seconds' => ['max' => 15], 'total_duration_seconds' => ['max' => 15]]],
                    ],
                )->toArray(),
                VideoInputMode::VideoEdit->value => array_merge(
                    VideoInputModeDefinition::videoEdit(
                        description: $this->translateInputMode('video_edit'),
                        supportedFields: ['reference_images', 'reference_videos', 'reference_audios'],
                        maxCount: 16,
                        variants: [
                            [
                                'code' => 'image_video_audio',
                                'description' => $this->translateInputMode('video_edit'),
                                'limits' => [
                                    'reference_images' => ['min' => 0, 'max' => 10],
                                    'reference_videos' => ['min' => 1, 'max' => 1],
                                    'reference_audios' => ['min' => 0, 'max' => 5],
                                ],
                            ],
                        ],
                    )->toArray(),
                    ['generation_constraints' => ['durations' => []]],
                ),
            ],
            'constraints' => [
                'reference_media' => [
                    'max_count' => 20,
                    'max_total_duration_seconds' => 30,
                    'max_files' => 1,
                    'max_public_urls' => 1,
                    'file_and_public_url_mutually_exclusive' => true,
                ],
            ],
        ]);
    }

    public function resolveProviderModelName(string $modelVersion, string $modelId = ''): string
    {
        $model = $this->resolveRequestedModel($modelVersion, $modelId);
        if ($model === null) {
            throw new InvalidArgumentException('Unsupported or conflicting Wan 3.x model identifiers.');
        }

        return $modelVersion;
    }

    private function resolveRequestedModel(string $modelVersion, string $modelId): ?string
    {
        $version = $this->normalizeModel($modelVersion);
        $id = $this->normalizeModel($modelId);

        if ($version === '') {
            return $this->isSupportedModel($id) ? $id : null;
        }
        if ($id === '') {
            return $this->isSupportedModel($version) ? $version : null;
        }

        return $version === $id && $this->isSupportedModel($version) ? $version : null;
    }

    private function isSupportedModel(string $model): bool
    {
        return in_array($model, self::SUPPORTED_MODEL_NAMES, true);
    }

    private function normalizeModel(string $model): string
    {
        return strtolower(trim($model));
    }

    private function translateInputMode(string $key, array $replace = []): string
    {
        return di(TranslatorInterface::class)->trans('video.input_modes.' . $key, $replace);
    }
}
