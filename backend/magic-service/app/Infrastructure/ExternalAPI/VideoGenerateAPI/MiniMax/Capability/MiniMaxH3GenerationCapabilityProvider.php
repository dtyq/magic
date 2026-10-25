<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\MiniMax\Capability;

use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputModeDefinition;
use Hyperf\Contract\TranslatorInterface;

readonly class MiniMaxH3GenerationCapabilityProvider
{
    /**
     * MiniMax H3 仅公开了分辨率档位与比例，未公布固定的宽高表。
     *
     * 这里以 768p 和 2K 的标准画布推导展示尺寸，仅用于前端元数据；
     * 实际请求仍只提交 resolution 与 ratio，由 MiniMax 决定最终像素。
     *
     * @var list<array{label: string, value: string, width: int, height: int, resolution: string}>
     */
    private const array SUPPORTED_SIZES = [
        ['label' => '16:9', 'value' => '1366x768', 'width' => 1366, 'height' => 768, 'resolution' => '768p'],
        ['label' => '4:3', 'value' => '1024x768', 'width' => 1024, 'height' => 768, 'resolution' => '768p'],
        ['label' => '1:1', 'value' => '768x768', 'width' => 768, 'height' => 768, 'resolution' => '768p'],
        ['label' => '3:4', 'value' => '576x768', 'width' => 576, 'height' => 768, 'resolution' => '768p'],
        ['label' => '9:16', 'value' => '432x768', 'width' => 432, 'height' => 768, 'resolution' => '768p'],
        ['label' => '21:9', 'value' => '1792x768', 'width' => 1792, 'height' => 768, 'resolution' => '768p'],
        ['label' => '16:9', 'value' => '2048x1152', 'width' => 2048, 'height' => 1152, 'resolution' => '2k'],
        ['label' => '4:3', 'value' => '1536x1152', 'width' => 1536, 'height' => 1152, 'resolution' => '2k'],
        ['label' => '1:1', 'value' => '1152x1152', 'width' => 1152, 'height' => 1152, 'resolution' => '2k'],
        ['label' => '3:4', 'value' => '864x1152', 'width' => 864, 'height' => 1152, 'resolution' => '2k'],
        ['label' => '9:16', 'value' => '648x1152', 'width' => 648, 'height' => 1152, 'resolution' => '2k'],
        ['label' => '21:9', 'value' => '2688x1152', 'width' => 2688, 'height' => 1152, 'resolution' => '2k'],
    ];

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        return in_array(strtolower(trim($modelId)), ['minimax-h3', 'minimax_h3'], true)
            || strtolower(trim($modelVersion)) === 'minimax-h3';
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        if (! $this->supportsModel($modelVersion, $modelId)) {
            return null;
        }

        return new VideoGenerationConfig([
            'supported_inputs' => ['text_prompt', 'image', 'last_frame', 'reference_images', 'reference_videos', 'reference_audios'],
            'reference_images' => [
                'max_count' => 9,
                'reference_types' => ['asset'],
                'style_supported' => false,
            ],
            'generation' => [
                'duration_type' => 'range',
                'durations' => ['min' => 4, 'max' => 15, 'step' => 1],
                'resolutions' => ['768p', '2k'],
                'aspect_ratios' => ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
                'sizes' => self::SUPPORTED_SIZES,
                'default_duration_seconds' => 5,
                'default_resolution' => '768p',
                'supports_watermark' => true,
                'supports_generate_audio' => true,
            ],
            'constraints' => [
                'reference_images_max_count' => 9,
                'reference_videos_max_count' => 3,
                'reference_audios_max_count' => 3,
                'reference_audios_require_image_or_video' => true,
                'frames_and_reference_media_mutually_exclusive' => true,
            ],
            'input_modes' => [
                VideoInputMode::Standard->value => VideoInputModeDefinition::standard(
                    $this->translateInputMode('standard'),
                )->toArray(),
                VideoInputMode::ImageReference->value => VideoInputModeDefinition::imageReference(
                    description: $this->translateInputMode('image_reference.multiple', [
                        'max_count' => 9,
                    ]),
                    maxCount: 9,
                    referenceTypes: ['asset'],
                    styleSupported: false,
                )->toArray(),
                VideoInputMode::OmniReference->value => VideoInputModeDefinition::omniReference(
                    description: $this->translateInputMode('minimax_h3_omni_reference'),
                    supportedFields: ['reference_images', 'reference_videos', 'reference_audios'],
                    maxCount: 15,
                    variants: [
                        [
                            'code' => 'reference_media',
                            'description' => $this->translateInputMode('minimax_h3_omni_reference_mode.reference_media'),
                            'limits' => [
                                'reference_images' => ['max' => 9],
                                'reference_videos' => ['max' => 3],
                                'reference_audios' => ['max' => 3],
                            ],
                        ],
                    ],
                )->toArray(),
                VideoInputMode::KeyframeGuided->value => VideoInputModeDefinition::keyframeGuided(
                    description: $this->translateInputMode('keyframe_guided.start_end'),
                    frameRoles: ['start', 'end'],
                )->toArray(),
            ],
        ]);
    }

    private function translateInputMode(string $key, array $replace = []): string
    {
        return di(TranslatorInterface::class)->trans('video.input_modes.' . $key, $replace);
    }
}
