<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\VolcengineArk\Capability;

use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputModeDefinition;
use Hyperf\Contract\TranslatorInterface;

use function Hyperf\Translation\__;

/**
 * 方舟 Seedance 生成能力声明的公共骨架。
 *
 * 2.0 mini/fast、2.0、2.5 三个家族的配置结构完全一致，差异只有标识匹配规则、
 * 分辨率、时长区间与参考素材上限；子类只需声明这三样，其余在这里统一产出，
 * 避免同一份 input_modes 骨架在三个家族里各写一遍。
 */
abstract readonly class AbstractSeedanceGenerationCapabilityProvider
{
    /**
     * 模型标识命中其中任意片段即属于该家族。
     *
     * @var list<string>
     */
    protected const array MODEL_MARKERS = [];

    /**
     * 模型标识命中其中任意片段时排除，用于让 2.0 家族让出 mini/fast。
     *
     * @var list<string>
     */
    protected const array EXCLUDED_MARKERS = [];

    // 对齐方舟 Seedance 当前文档里的默认时长，缺省时我们按 5 秒回填。
    private const int DEFAULT_DURATION_SECONDS = 5;

    // 这是当前接入侧采用的保守默认值，不表示官方永远固定只会默认到 720p。
    private const string DEFAULT_RESOLUTION = '720p';

    /**
     * @var list<string>
     */
    private const array SUPPORTED_ASPECT_RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'];

    /**
     * @var list<string>
     */
    private const array SUPPORTED_INPUTS = [
        'text_prompt',
        'image',
        'reference_images',
        'reference_videos',
        'reference_audios',
        'mask',
        'video_extension',
        'video_edit',
        'video_upscale',
    ];

    // 样片模式的样片分辨率档位：样片只用于快速预览效果，固定 480p，
    // 正式分辨率留到成片阶段（见 DRAFT_TASK_RESOLUTIONS）。
    private const array DRAFT_RESOLUTIONS = ['480p'];

    // 样片成片的成片分辨率档位：成片按正式分辨率出片，样片档位不再暴露给前端。
    private const array DRAFT_TASK_RESOLUTIONS = ['1080p'];

    /**
     * 当前接入的 Seedance 尺寸基表。
     * 这里用于 featured 能力下发给前端；不同家族再按分辨率过滤。
     *
     * @var list<array{label: string, value: string, width: int, height: int, resolution: string}>
     */
    private const array SUPPORTED_SIZES = [
        ['label' => '16:9', 'value' => '864x496', 'width' => 864, 'height' => 496, 'resolution' => '480p'],
        ['label' => '4:3', 'value' => '752x560', 'width' => 752, 'height' => 560, 'resolution' => '480p'],
        ['label' => '1:1', 'value' => '640x640', 'width' => 640, 'height' => 640, 'resolution' => '480p'],
        ['label' => '3:4', 'value' => '560x752', 'width' => 560, 'height' => 752, 'resolution' => '480p'],
        ['label' => '9:16', 'value' => '496x864', 'width' => 496, 'height' => 864, 'resolution' => '480p'],
        ['label' => '21:9', 'value' => '992x432', 'width' => 992, 'height' => 432, 'resolution' => '480p'],
        ['label' => '16:9', 'value' => '1280x720', 'width' => 1280, 'height' => 720, 'resolution' => '720p'],
        ['label' => '4:3', 'value' => '1112x834', 'width' => 1112, 'height' => 834, 'resolution' => '720p'],
        ['label' => '1:1', 'value' => '960x960', 'width' => 960, 'height' => 960, 'resolution' => '720p'],
        ['label' => '3:4', 'value' => '834x1112', 'width' => 834, 'height' => 1112, 'resolution' => '720p'],
        ['label' => '9:16', 'value' => '720x1280', 'width' => 720, 'height' => 1280, 'resolution' => '720p'],
        ['label' => '21:9', 'value' => '1470x630', 'width' => 1470, 'height' => 630, 'resolution' => '720p'],
        ['label' => '16:9', 'value' => '1920x1080', 'width' => 1920, 'height' => 1080, 'resolution' => '1080p'],
        ['label' => '4:3', 'value' => '1668x1252', 'width' => 1668, 'height' => 1252, 'resolution' => '1080p'],
        ['label' => '1:1', 'value' => '1440x1440', 'width' => 1440, 'height' => 1440, 'resolution' => '1080p'],
        ['label' => '3:4', 'value' => '1252x1668', 'width' => 1252, 'height' => 1668, 'resolution' => '1080p'],
        ['label' => '9:16', 'value' => '1080x1920', 'width' => 1080, 'height' => 1920, 'resolution' => '1080p'],
        ['label' => '21:9', 'value' => '2205x945', 'width' => 2205, 'height' => 945, 'resolution' => '1080p'],
        ['label' => '16:9', 'value' => '3840x2160', 'width' => 3840, 'height' => 2160, 'resolution' => '4k'],
        ['label' => '4:3', 'value' => '3328x2496', 'width' => 3328, 'height' => 2496, 'resolution' => '4k'],
        ['label' => '1:1', 'value' => '2880x2880', 'width' => 2880, 'height' => 2880, 'resolution' => '4k'],
        ['label' => '3:4', 'value' => '2496x3328', 'width' => 2496, 'height' => 3328, 'resolution' => '4k'],
        ['label' => '9:16', 'value' => '2160x3840', 'width' => 2160, 'height' => 3840, 'resolution' => '4k'],
        ['label' => '21:9', 'value' => '4410x1890', 'width' => 4410, 'height' => 1890, 'resolution' => '4k'],
    ];

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        $identifiers = $this->normalizeIdentifiers($modelVersion, $modelId);

        return $this->containsAnyMarker($identifiers, static::MODEL_MARKERS)
            && ! $this->containsAnyMarker($identifiers, static::EXCLUDED_MARKERS);
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        if (! $this->supportsModel($modelVersion, $modelId)) {
            return null;
        }

        $profile = $this->resolveProfile();

        return new VideoGenerationConfig([
            'supported_inputs' => $this->supportedInputs(),
            'reference_images' => [
                'max_count' => $profile['reference_limits']['images'],
                'reference_types' => ['asset'],
                'style_supported' => false,
            ],
            'generation' => $this->buildGeneration($profile),
            'input_modes' => $this->buildInputModes($profile),
        ]);
    }

    /**
     * 是否支持显式声明视频编辑子任务类型。目前只有 Seedance 2.5 支持，
     * 2.0 系列由模型按素材与提示词自行判定。
     *
     * 由 adapter 在构造 payload 时读取，因此必须是公开方法。
     */
    public function supportsEditTaskType(): bool
    {
        return false;
    }

    /**
     * 样片成片允许的目标分辨率档位。
     *
     * adapter 在成片分支里据此裁剪调用方传入的分辨率：成片固定出正式档位，
     * 传入样片档位（480p/720p）会被记为未生效并回落到这里的档位，
     * 避免 /v1/videos 直接调用时把成片降档出片。
     *
     * @return list<string>
     */
    public function resolveDraftTaskResolutions(): array
    {
        return self::DRAFT_TASK_RESOLUTIONS;
    }

    /**
     * 是否支持样片模式（draft）。目前只有 Seedance 2.5 支持：先以 480p 出样片，
     * 确认后再以正式分辨率出片，两次出片分别计费。
     *
     * 仅能力层内部使用，决定 generation 里是否声明 draft 开关。
     */
    protected function supportsDraft(): bool
    {
        return false;
    }

    /**
     * 是否支持样片成片（draft_task）。目前只有 Seedance 2.5 支持：用样片任务 ID
     * 直接出正式分辨率的成片，提示词与参考素材全部继承样片。
     *
     * 仅能力层内部使用，决定 input_modes 与 supported_inputs 里是否声明该模式。
     */
    protected function supportsDraftTask(): bool
    {
        return false;
    }

    /**
     * 该家族声明的 supported_inputs。默认与公共基表一致，支持样片成片的家族再追加。
     *
     * @return list<string>
     */
    protected function supportedInputs(): array
    {
        return self::SUPPORTED_INPUTS;
    }

    /**
     * 该家族的分辨率、时长区间与参考素材上限。
     *
     * @return array{
     *     resolutions: list<string>,
     *     durations: array{min: int, max: int, step: int},
     *     reference_limits: array{images: int, videos: int, audios: int}
     * }
     */
    abstract protected function resolveProfile(): array;

    /**
     * 键顺序沿用拆分前 baseGenerationConfig() 与家族档位合并后的实际顺序，
     * 避免能力配置在对外结构上发生无谓变化。
     *
     * @param array{
     *     resolutions: list<string>,
     *     durations: array{min: int, max: int, step: int},
     *     reference_limits: array{images: int, videos: int, audios: int}
     * } $profile
     * @return array<string, mixed>
     */
    private function buildGeneration(array $profile): array
    {
        $generation = [
            'aspect_ratios' => self::SUPPORTED_ASPECT_RATIOS,
            'duration_type' => 'range',
            'durations' => $profile['durations'],
            'default_duration_seconds' => self::DEFAULT_DURATION_SECONDS,
            'default_resolution' => self::DEFAULT_RESOLUTION,
            'supports_seed' => true,
            'seed_range' => [-1, 4294967295],
            'supports_watermark' => true,
            'supports_generate_audio' => true,
            'supports_person_generation' => false,
            'supports_enhance_prompt' => false,
            'supports_compression_quality' => false,
            'supports_resize_mode' => false,
            'supports_sample_count' => false,
            'generate_audio' => [
                'type' => 'switch',
                'default' => true,
                'name' => __('video.generation.generate_audio.name'),
                'description' => __('video.generation.generate_audio.description'),
            ],
            'resolutions' => $profile['resolutions'],
            'sizes' => $this->filterSizesByResolution($profile['resolutions']),
        ];

        // 样片模式目前只有 Seedance 2.5 支持，因此只在该家族的 generation 里声明开关。
        if ($this->supportsDraft()) {
            $generation['draft'] = [
                'type' => 'switch',
                'default' => false,
                'name' => __('video.generation.draft.name'),
                'description' => __('video.generation.draft.description'),
                // 开关打开时分辨率收窄到 480p，关闭时不受影响。
                // 这里只是声明，后端不据此拦截：越界由上游方舟报错，
                // 这样声明与执行不会出现两套判定标准。
                'constraints' => ['resolutions' => self::DRAFT_RESOLUTIONS],
            ];
        }

        return $generation;
    }

    /**
     * @param array{
     *     resolutions: list<string>,
     *     durations: array{min: int, max: int, step: int},
     *     reference_limits: array{images: int, videos: int, audios: int}
     * } $profile
     * @return array<string, mixed>
     */
    private function buildInputModes(array $profile): array
    {
        $limits = $profile['reference_limits'];
        $totalCount = $limits['images'] + $limits['videos'] + $limits['audios'];

        $inputModes = [
            'standard' => [
                'description' => $this->translateInputMode('standard'),
                'supported_fields' => [],
            ],
            'image_reference' => [
                'description' => $this->translateInputMode('image_reference.multiple', [
                    'max_count' => $limits['images'],
                ]),
                'supported_fields' => ['reference_images'],
                'reference_images' => [
                    'max_count' => $limits['images'],
                    'reference_types' => ['asset'],
                    'style_supported' => false,
                ],
            ],
            'omni_reference' => [
                'description' => $this->translateInputMode('omni_reference', [
                    'max_count' => $totalCount,
                ]),
                'supported_fields' => ['reference_images', 'reference_videos', 'reference_audios'],
                'max_count' => $totalCount,
                'variants' => [[
                    'code' => 'multimodal_reference_limits',
                    'limits' => [
                        'reference_images' => ['min' => 0, 'max' => $limits['images']],
                        'reference_videos' => ['min' => 0, 'max' => $limits['videos']],
                        'reference_audios' => ['min' => 0, 'max' => $limits['audios']],
                    ],
                ]],
            ],
            // 首帧/首尾帧：输出比例强制跟随首帧图片，因此该模式不支持选择比例，
            // 尺寸档位（分辨率 × 比例）同样不暴露给前端。与 Keling 的约束写法保持一致。
            'keyframe_guided' => [
                'description' => $this->translateInputMode('keyframe_guided.start_end'),
                'supported_fields' => ['frames'],
                'frame_roles' => ['start', 'end'],
                'generation_constraints' => ['aspect_ratios' => [], 'sizes' => []],
            ],
            // 视频编辑：至少一个参考视频，可搭配参考图片；时长与比例跟随待编辑视频，不暴露给前端。
            VideoInputMode::VideoEdit->value => array_merge(
                VideoInputModeDefinition::videoEdit(
                    description: $this->translateInputMode('video_edit'),
                    supportedFields: ['reference_images', 'reference_videos'],
                    maxCount: $limits['images'] + $limits['videos'],
                    variants: [[
                        'code' => 'image_and_video',
                        'description' => $this->translateInputMode('video_edit'),
                        'limits' => [
                            'reference_images' => ['min' => 0, 'max' => $limits['images']],
                            'reference_videos' => ['min' => 1, 'max' => $limits['videos']],
                            'reference_audios' => ['min' => 0, 'max' => $limits['audios']],
                        ],
                    ]],
                )->toArray(),
                ['generation_constraints' => ['durations' => [], 'aspect_ratios' => []]],
            ),
        ];

        // 样片成片：输入只有样片任务引用，提示词与参考素材全部继承样片，时长与比例同理，
        // 因此这里只保留分辨率可选（成片档位）。
        if ($this->supportsDraftTask()) {
            $inputModes[VideoInputMode::DraftTask->value] = array_merge(
                VideoInputModeDefinition::draftTask(
                    description: $this->translateInputMode('draft_task'),
                )->toArray(),
                ['generation_constraints' => [
                    'durations' => [],
                    'aspect_ratios' => [],
                    'sizes' => [],
                    'resolutions' => self::DRAFT_TASK_RESOLUTIONS,
                ]],
            );
        }

        return $inputModes;
    }

    /**
     * 家族匹配只看规范化后的标识片段，空标识不参与匹配。
     *
     * @return list<string>
     */
    private function normalizeIdentifiers(string $modelVersion, string $modelId): array
    {
        $identifiers = [];
        foreach ([$modelVersion, $modelId] as $identifier) {
            $normalized = strtolower(trim($identifier));
            if ($normalized !== '') {
                $identifiers[] = $normalized;
            }
        }

        return $identifiers;
    }

    /**
     * @param list<string> $identifiers
     * @param list<string> $markers
     */
    private function containsAnyMarker(array $identifiers, array $markers): bool
    {
        foreach ($identifiers as $identifier) {
            foreach ($markers as $marker) {
                if (str_contains($identifier, $marker)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @param list<string> $resolutions
     * @return list<array{label: string, value: string, width: int, height: int, resolution: string}>
     */
    private function filterSizesByResolution(array $resolutions): array
    {
        return array_values(array_filter(
            self::SUPPORTED_SIZES,
            static fn (array $size): bool => in_array($size['resolution'], $resolutions, true),
        ));
    }

    /**
     * 方舟 Seedance 的 mode 文案放在能力层原位生成，和它自己的能力配置保持同源。
     */
    private function translateInputMode(string $key, array $replace = []): string
    {
        return di(TranslatorInterface::class)->trans('video.input_modes.' . $key, $replace);
    }
}
