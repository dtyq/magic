<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Capability;

use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputModeDefinition;
use Hyperf\Contract\TranslatorInterface;
use InvalidArgumentException;

readonly class GeminiOmniGenerationCapabilityProvider
{
    private const string MODEL = 'gemini-omni-1.1-flash';

    /** @var list<array{label: string, value: string, width: int, height: int, resolution: string}> */
    private const array SUPPORTED_SIZES = [
        ['label' => '16:9', 'value' => '640x360', 'width' => 640, 'height' => 360, 'resolution' => '360p'],
        ['label' => '9:16', 'value' => '360x640', 'width' => 360, 'height' => 640, 'resolution' => '360p'],
        ['label' => '16:9', 'value' => '1280x720', 'width' => 1280, 'height' => 720, 'resolution' => '720p'],
        ['label' => '9:16', 'value' => '720x1280', 'width' => 720, 'height' => 1280, 'resolution' => '720p'],
        ['label' => '16:9', 'value' => '1920x1080', 'width' => 1920, 'height' => 1080, 'resolution' => '1080p'],
        ['label' => '9:16', 'value' => '1080x1920', 'width' => 1080, 'height' => 1920, 'resolution' => '1080p'],
        ['label' => '16:9', 'value' => '3840x2160', 'width' => 3840, 'height' => 2160, 'resolution' => '4k'],
        ['label' => '9:16', 'value' => '2160x3840', 'width' => 2160, 'height' => 3840, 'resolution' => '4k'],
    ];

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        $version = $this->normalize($modelVersion);
        $id = $this->normalize($modelId);
        if ($version !== '' && $this->isNumericProviderModelId($id)) {
            $id = '';
        }

        return ($version === '' || str_starts_with($version, self::MODEL))
            && ($id === '' || str_starts_with($id, self::MODEL))
            && ($version !== '' || $id !== '');
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        if (! $this->supportsModel($modelVersion, $modelId)) {
            return null;
        }
        $translate = fn (string $key, array $replace = []): string => di(TranslatorInterface::class)->trans('video.input_modes.' . $key, $replace);
        return new VideoGenerationConfig([
            'generation' => [
                'duration_type' => 'range', 'durations' => [3, 4, 5, 6, 7, 8, 9, 10], 'default_duration_seconds' => 5,
                'resolutions' => ['360p', '720p', '1080p', '4k'], 'default_resolution' => '720p',
                'sizes' => self::SUPPORTED_SIZES,
                'aspect_ratios' => ['16:9', '9:16'], 'supports_background' => true, 'supports_generate_audio' => true,
            ],
            'input_modes' => [
                VideoInputMode::Standard->value => VideoInputModeDefinition::standard($translate('standard'))->toArray(),
                VideoInputMode::ImageReference->value => VideoInputModeDefinition::imageReference($translate('image_reference.single'), 1, ['asset'], false)->toArray(),
                VideoInputMode::KeyframeGuided->value => VideoInputModeDefinition::keyframeGuided($translate('keyframe_guided.start_end'), ['start', 'end'])->toArray(),
                VideoInputMode::VideoEdit->value => array_merge(
                    VideoInputModeDefinition::videoEdit(
                        $translate('video_edit'),
                        ['reference_images', 'reference_videos'],
                        7,
                        [
                            [
                                'code' => 'image_and_video',
                                'description' => $translate('video_edit'),
                                'limits' => [
                                    'reference_images' => ['min' => 0, 'max' => 6],
                                    'reference_videos' => ['min' => 1, 'max' => 1],
                                ],
                            ],
                        ],
                    )->toArray(),
                    ['generation_constraints' => ['durations' => [], 'aspect_ratios' => []]],
                ),
                VideoInputMode::OmniReference->value => VideoInputModeDefinition::omniReference(
                    $translate('gemini_omni_reference'),
                    ['reference_images', 'reference_videos', 'reference_audios'],
                    8,
                    [
                        ['code' => 'reference_images', 'description' => $translate('gemini_omni_reference'), 'limits' => ['reference_images' => ['max' => 8], 'reference_videos' => ['max' => 0]]],
                        ['code' => 'reference_video', 'description' => $translate('gemini_omni_reference'), 'limits' => ['reference_images' => ['max' => 6], 'reference_videos' => ['max' => 1]]],
                    ],
                )->toArray(),
            ],
        ]);
    }

    public function resolveProviderModelName(string $modelVersion, string $modelId = ''): string
    {
        if (! $this->supportsModel($modelVersion, $modelId)) {
            throw new InvalidArgumentException('Unsupported or conflicting Gemini video model identifiers.');
        }

        return trim($modelVersion) !== '' ? trim($modelVersion) : trim($modelId);
    }

    private function normalize(string $value): string
    {
        return strtolower(trim($value));
    }

    private function isNumericProviderModelId(string $value): bool
    {
        return $value !== '' && ctype_digit($value);
    }
}
