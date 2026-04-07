<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterFactoryInterface;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfigCandidate;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use InvalidArgumentException;

/**
 * 视频统一参数配置领域服务。
 *
 * 这是视频能力单一来源的核心入口，负责两件事：
 *
 * 1. 单 provider/model 能力解析
 *    从 adapter 读取当前系统真实支持的 VideoGenerationConfig。
 *
 * 2. featured 多 provider 交集计算
 *    把同一个逻辑 model_id 下多个 provider 的配置收缩成一份安全配置。
 *
 * 这里不负责 provider 模型查询与组织过滤，这些由 app 层完成。
 */
readonly class VideoGenerationConfigDomainService
{
    public function __construct(
        private VideoGenerationProviderAdapterFactoryInterface $adapterFactory,
    ) {
    }

    public function resolve(string $modelVersion, string $modelId, ProviderCode $providerCode): ?VideoGenerationConfig
    {
        try {
            $adapter = $this->adapterFactory->createByProviderCode($providerCode, $modelVersion);
        } catch (InvalidArgumentException) {
            // 未接入该 provider 时，视为当前没有可用能力配置。
            return null;
        }

        if (! $adapter->supportsModel($modelVersion, $modelId)) {
            return null;
        }

        return $adapter->resolveGenerationConfig($modelVersion, $modelId);
    }

    /**
     * @param list<VideoGenerationConfigCandidate> $candidates
     * @return array<string, VideoGenerationConfig>
     */
    public function resolveFeatured(array $candidates): array
    {
        // featured 对外按逻辑 model_id 返回，因此先按 model_id 分组。
        $groupedCandidates = [];
        foreach ($candidates as $candidate) {
            $groupedCandidates[$candidate->getModelId()][] = $candidate;
        }

        $resolvedConfigs = [];
        foreach ($groupedCandidates as $modelId => $modelCandidates) {
            $configs = [];
            foreach ($modelCandidates as $candidate) {
                $config = $this->resolve(
                    $candidate->getModelVersion(),
                    $candidate->getModelId(),
                    $candidate->getProviderCode(),
                );
                if ($config instanceof VideoGenerationConfig) {
                    $configs[] = $config;
                }
            }

            if ($configs === []) {
                continue;
            }

            // 单 provider 直接返回，多 provider 逐个做交集 fold。
            $featuredConfig = array_shift($configs);
            if (! $featuredConfig instanceof VideoGenerationConfig) {
                continue;
            }
            foreach ($configs as $config) {
                $featuredConfig = $this->intersect($featuredConfig, $config);
            }

            $resolvedConfigs[$modelId] = $featuredConfig;
        }

        return $resolvedConfigs;
    }

    public function intersect(VideoGenerationConfig $left, VideoGenerationConfig $right): VideoGenerationConfig
    {
        $leftConfig = self::normalizeConfig($left);
        $rightConfig = self::normalizeConfig($right);

        // 输入能力本身就是一组 capability，因此直接取交集。
        $supportedInputs = self::intersectStringList(
            $leftConfig['supported_inputs'],
            $rightConfig['supported_inputs'],
        );

        $referenceTypes = self::intersectStringList(
            $leftConfig['reference_images']['reference_types'],
            $rightConfig['reference_images']['reference_types'],
        );
        $referenceImageSupported = in_array('reference_images', $supportedInputs, true);
        // 上限类字段取更严格值；如果整体不支持，则统一收缩为 0。
        $referenceMaxCount = $referenceImageSupported
            ? min($leftConfig['reference_images']['max_count'], $rightConfig['reference_images']['max_count'])
            : 0;

        $aspectRatios = self::intersectStringList(
            $leftConfig['generation']['aspect_ratios'],
            $rightConfig['generation']['aspect_ratios'],
        );
        $durations = self::intersectIntList(
            $leftConfig['generation']['durations'],
            $rightConfig['generation']['durations'],
        );
        $resolutions = self::intersectStringList(
            $leftConfig['generation']['resolutions'],
            $rightConfig['generation']['resolutions'],
        );
        $sizes = self::intersectSizeOptions(
            $leftConfig['generation']['sizes'],
            $rightConfig['generation']['sizes'],
        );
        if ($sizes !== []) {
            $aspectRatios = self::extractSizeFieldList($sizes, 'label');
            $resolutions = self::extractSizeFieldList($sizes, 'resolution');
        }

        $supportsSeed = $leftConfig['generation']['supports_seed'] && $rightConfig['generation']['supports_seed'];
        $supportsNegativePrompt = $leftConfig['generation']['supports_negative_prompt'] && $rightConfig['generation']['supports_negative_prompt'];
        $supportsGenerateAudio = $leftConfig['generation']['supports_generate_audio'] && $rightConfig['generation']['supports_generate_audio'];
        $supportsPersonGeneration = $leftConfig['generation']['supports_person_generation'] && $rightConfig['generation']['supports_person_generation'];
        $supportsCompressionQuality = $leftConfig['generation']['supports_compression_quality'] && $rightConfig['generation']['supports_compression_quality'];
        $supportsResizeMode = $leftConfig['generation']['supports_resize_mode'] && $rightConfig['generation']['supports_resize_mode'];
        $supportsSampleCount = $leftConfig['generation']['supports_sample_count'] && $rightConfig['generation']['supports_sample_count'];
        $supportsEnhancePrompt = $leftConfig['generation']['supports_enhance_prompt'] && $rightConfig['generation']['supports_enhance_prompt'];

        $generation = [
            'aspect_ratios' => $aspectRatios,
            'durations' => $durations,
            'resolutions' => $resolutions,
            'sizes' => $sizes,
            // 布尔能力统一取 AND，只要有一个 provider 不支持，就不能对外宣告支持。
            'supports_seed' => $supportsSeed,
            'supports_negative_prompt' => $supportsNegativePrompt,
            'supports_generate_audio' => $supportsGenerateAudio,
            'supports_person_generation' => $supportsPersonGeneration,
            'supports_compression_quality' => $supportsCompressionQuality,
            'supports_resize_mode' => $supportsResizeMode,
            'supports_sample_count' => $supportsSampleCount,
            'supports_enhance_prompt' => $supportsEnhancePrompt,
        ];

        $defaultDuration = self::intersectDefaultInt(
            $leftConfig['generation']['default_duration_seconds'],
            $rightConfig['generation']['default_duration_seconds'],
            $durations,
        );
        if ($defaultDuration !== null) {
            $generation['default_duration_seconds'] = $defaultDuration;
        }

        $defaultResolution = self::intersectDefaultString(
            $leftConfig['generation']['default_resolution'],
            $rightConfig['generation']['default_resolution'],
            $resolutions,
        );
        if ($defaultResolution !== null) {
            $generation['default_resolution'] = $defaultResolution;
        }

        if ($supportsSeed) {
            // 区间字段取重叠区间；无重叠则返回空数组。
            $seedRange = self::intersectRange(
                $leftConfig['generation']['seed_range'],
                $rightConfig['generation']['seed_range'],
            );
            if ($seedRange !== []) {
                $generation['seed_range'] = $seedRange;
            }
        }

        if ($supportsPersonGeneration) {
            $personGenerationOptions = self::intersectStringList(
                $leftConfig['generation']['person_generation_options'],
                $rightConfig['generation']['person_generation_options'],
            );
            if ($personGenerationOptions !== []) {
                $generation['person_generation_options'] = $personGenerationOptions;
            }
        }

        if ($supportsCompressionQuality) {
            $compressionQualityOptions = self::intersectStringList(
                $leftConfig['generation']['compression_quality_options'],
                $rightConfig['generation']['compression_quality_options'],
            );
            if ($compressionQualityOptions !== []) {
                $generation['compression_quality_options'] = $compressionQualityOptions;
            }
        }

        if ($supportsResizeMode) {
            $resizeModeOptions = self::intersectStringList(
                $leftConfig['generation']['resize_mode_options'],
                $rightConfig['generation']['resize_mode_options'],
            );
            if ($resizeModeOptions !== []) {
                $generation['resize_mode_options'] = $resizeModeOptions;
            }
        }

        if ($supportsSampleCount) {
            $sampleCountRange = self::intersectRange(
                $leftConfig['generation']['sample_count_range'],
                $rightConfig['generation']['sample_count_range'],
            );
            if ($sampleCountRange !== []) {
                $generation['sample_count_range'] = $sampleCountRange;
            }
        }

        $constraints = [];
        if ($referenceImageSupported) {
            // 约束字段取更严格规则；这里用更大的时长约束代表更严格。
            $referenceImagesDuration = self::intersectNullableInt(
                $leftConfig['constraints']['reference_images_requires_duration_seconds'],
                $rightConfig['constraints']['reference_images_requires_duration_seconds'],
            );
            if ($referenceImagesDuration !== null) {
                $constraints['reference_images_requires_duration_seconds'] = $referenceImagesDuration;
            }
        }

        if ($resolutions !== [] && $durations !== []) {
            $highResolutionDuration = self::intersectNullableInt(
                $leftConfig['constraints']['high_resolution_requires_duration_seconds'],
                $rightConfig['constraints']['high_resolution_requires_duration_seconds'],
            );
            if ($highResolutionDuration !== null) {
                $constraints['high_resolution_requires_duration_seconds'] = $highResolutionDuration;
            }
        }

        if ($resolutions !== [] && in_array('video_extension', $supportedInputs, true)) {
            $videoExtensionOutputResolution = self::intersectNullableString(
                $leftConfig['constraints']['video_extension_output_resolution'],
                $rightConfig['constraints']['video_extension_output_resolution'],
            );
            if ($videoExtensionOutputResolution !== null) {
                $constraints['video_extension_output_resolution'] = $videoExtensionOutputResolution;
            }
        }

        return new VideoGenerationConfig([
            'supported_inputs' => $supportedInputs,
            'reference_images' => [
                'max_count' => $referenceMaxCount,
                // 能力本身不支持时，列表字段统一返回空数组，避免前端误判。
                'reference_types' => $referenceImageSupported ? $referenceTypes : [],
                'style_supported' => $referenceImageSupported
                    && $leftConfig['reference_images']['style_supported']
                    && $rightConfig['reference_images']['style_supported'],
            ],
            'generation' => $generation,
            'constraints' => $constraints,
        ]);
    }

    /**
     * @return array{
     *     supported_inputs: list<string>,
     *     reference_images: array{max_count: int, reference_types: list<string>, style_supported: bool},
     *     generation: array{
     *         aspect_ratios: list<string>,
     *         durations: list<int>,
     *         default_duration_seconds: ?int,
     *         resolutions: list<string>,
     *         sizes: list<array{label: string, value: string, width: int, height: int, resolution: string}>,
     *         default_resolution: ?string,
     *         supports_seed: bool,
     *         seed_range: list<int>,
     *         supports_negative_prompt: bool,
     *         supports_generate_audio: bool,
     *         supports_person_generation: bool,
     *         supports_enhance_prompt: bool,
     *         person_generation_options: list<string>,
     *         supports_compression_quality: bool,
     *         compression_quality_options: list<string>,
     *         supports_resize_mode: bool,
     *         resize_mode_options: list<string>,
     *         supports_sample_count: bool,
     *         sample_count_range: list<int>
     *     },
     *     constraints: array{
     *         reference_images_requires_duration_seconds: ?int,
     *         high_resolution_requires_duration_seconds: ?int,
     *         video_extension_output_resolution: ?string
     *     }
     * }
     */
    private static function normalizeConfig(VideoGenerationConfig $config): array
    {
        // 先把对外结构归一成稳定的内部结构，后续交集逻辑只处理一种形态。
        $configArray = $config->toArray();
        $referenceImages = is_array($configArray['reference_images'] ?? null) ? $configArray['reference_images'] : [];
        $generation = is_array($configArray['generation'] ?? null) ? $configArray['generation'] : [];
        $constraints = is_array($configArray['constraints'] ?? null) ? $configArray['constraints'] : [];

        return [
            'supported_inputs' => self::normalizeStringList($configArray['supported_inputs'] ?? []),
            'reference_images' => [
                'max_count' => max(0, (int) ($referenceImages['max_count'] ?? 0)),
                'reference_types' => self::normalizeStringList($referenceImages['reference_types'] ?? []),
                'style_supported' => (bool) ($referenceImages['style_supported'] ?? false),
            ],
            'generation' => [
                'aspect_ratios' => self::normalizeStringList($generation['aspect_ratios'] ?? []),
                'durations' => self::normalizeIntList($generation['durations'] ?? []),
                'default_duration_seconds' => isset($generation['default_duration_seconds']) ? (int) $generation['default_duration_seconds'] : null,
                'resolutions' => self::normalizeStringList($generation['resolutions'] ?? []),
                'sizes' => self::normalizeSizeOptions($generation['sizes'] ?? []),
                'default_resolution' => is_string($generation['default_resolution'] ?? null) ? $generation['default_resolution'] : null,
                'supports_seed' => (bool) ($generation['supports_seed'] ?? false),
                'seed_range' => self::normalizeIntList($generation['seed_range'] ?? []),
                'supports_negative_prompt' => (bool) ($generation['supports_negative_prompt'] ?? false),
                'supports_generate_audio' => (bool) ($generation['supports_generate_audio'] ?? false),
                'supports_person_generation' => (bool) ($generation['supports_person_generation'] ?? false),
                'supports_enhance_prompt' => (bool) ($generation['supports_enhance_prompt'] ?? false),
                'person_generation_options' => self::normalizeStringList($generation['person_generation_options'] ?? []),
                'supports_compression_quality' => (bool) ($generation['supports_compression_quality'] ?? false),
                'compression_quality_options' => self::normalizeStringList($generation['compression_quality_options'] ?? []),
                'supports_resize_mode' => (bool) ($generation['supports_resize_mode'] ?? false),
                'resize_mode_options' => self::normalizeStringList($generation['resize_mode_options'] ?? []),
                'supports_sample_count' => (bool) ($generation['supports_sample_count'] ?? false),
                'sample_count_range' => self::normalizeIntList($generation['sample_count_range'] ?? []),
            ],
            'constraints' => [
                'reference_images_requires_duration_seconds' => isset($constraints['reference_images_requires_duration_seconds'])
                    ? (int) $constraints['reference_images_requires_duration_seconds']
                    : null,
                'high_resolution_requires_duration_seconds' => isset($constraints['high_resolution_requires_duration_seconds'])
                    ? (int) $constraints['high_resolution_requires_duration_seconds']
                    : null,
                'video_extension_output_resolution' => is_string($constraints['video_extension_output_resolution'] ?? null)
                    ? $constraints['video_extension_output_resolution']
                    : null,
            ],
        ];
    }

    /**
     * @return list<string>
     */
    private static function normalizeStringList(mixed $values): array
    {
        if (! is_array($values)) {
            return [];
        }

        $result = [];
        foreach ($values as $value) {
            if (! is_string($value) || $value === '') {
                continue;
            }
            $result[] = $value;
        }

        return array_values(array_unique($result));
    }

    /**
     * @return list<int>
     */
    private static function normalizeIntList(mixed $values): array
    {
        if (! is_array($values)) {
            return [];
        }

        $result = [];
        foreach ($values as $value) {
            if (! is_int($value) && ! is_numeric($value)) {
                continue;
            }
            $result[] = (int) $value;
        }

        return array_values(array_unique($result));
    }

    /**
     * @return list<array{label: string, value: string, width: int, height: int, resolution: string}>
     */
    private static function normalizeSizeOptions(mixed $values): array
    {
        if (! is_array($values)) {
            return [];
        }

        $result = [];
        foreach ($values as $value) {
            if (! is_array($value)) {
                continue;
            }

            $label = trim((string) ($value['label'] ?? ''));
            $rawValue = trim((string) ($value['value'] ?? ''));
            $resolution = trim((string) ($value['resolution'] ?? ''));
            $width = isset($value['width']) && is_numeric($value['width']) ? (int) $value['width'] : 0;
            $height = isset($value['height']) && is_numeric($value['height']) ? (int) $value['height'] : 0;
            if ($label === '' || $rawValue === '' || $resolution === '' || $width <= 0 || $height <= 0) {
                continue;
            }

            $key = implode('|', [$label, $rawValue, $resolution]);
            $result[$key] = [
                'label' => $label,
                'value' => $rawValue,
                'width' => $width,
                'height' => $height,
                'resolution' => $resolution,
            ];
        }

        return array_values($result);
    }

    /**
     * @param list<string> $left
     * @param list<string> $right
     * @return list<string>
     */
    private static function intersectStringList(array $left, array $right): array
    {
        return array_values(array_intersect($left, $right));
    }

    /**
     * @param list<int> $left
     * @param list<int> $right
     * @return list<int>
     */
    private static function intersectIntList(array $left, array $right): array
    {
        return array_values(array_intersect($left, $right));
    }

    /**
     * @param list<array{label: string, value: string, width: int, height: int, resolution: string}> $left
     * @param list<array{label: string, value: string, width: int, height: int, resolution: string}> $right
     * @return list<array{label: string, value: string, width: int, height: int, resolution: string}>
     */
    private static function intersectSizeOptions(array $left, array $right): array
    {
        if ($left === [] || $right === []) {
            return [];
        }

        $rightIndex = [];
        foreach ($right as $option) {
            $rightIndex[self::buildSizeOptionKey($option)] = true;
        }

        $result = [];
        foreach ($left as $option) {
            if (! isset($rightIndex[self::buildSizeOptionKey($option)])) {
                continue;
            }

            $result[] = $option;
        }

        return $result;
    }

    /**
     * @param list<int> $left
     * @param list<int> $right
     * @return list<int>
     */
    private static function intersectRange(array $left, array $right): array
    {
        if (count($left) !== 2 || count($right) !== 2) {
            return array_values(array_intersect($left, $right));
        }

        $start = max($left[0], $right[0]);
        $end = min($left[1], $right[1]);

        return $start <= $end ? [$start, $end] : [];
    }

    private static function intersectNullableInt(?int $left, ?int $right): ?int
    {
        return self::intersectNullableValue(
            $left,
            $right,
            static fn (int $leftValue, int $rightValue): int => max($leftValue, $rightValue),
        );
    }

    private static function intersectNullableString(?string $left, ?string $right): ?string
    {
        return self::intersectNullableValue(
            $left,
            $right,
            static fn (string $leftValue, string $rightValue): ?string => $leftValue === $rightValue ? $leftValue : null,
        );
    }

    /**
     * @template T of int|string
     * @param ?T $left
     * @param ?T $right
     * @param callable(T, T): ?T $intersector
     * @return ?T
     */
    private static function intersectNullableValue(null|int|string $left, null|int|string $right, callable $intersector): null|int|string
    {
        if ($left === null) {
            return $right;
        }
        if ($right === null) {
            return $left;
        }

        return $intersector($left, $right);
    }

    /**
     * @param list<int> $availableValues
     */
    private static function intersectDefaultInt(?int $left, ?int $right, array $availableValues): ?int
    {
        if ($left === null || $right === null || $left !== $right) {
            return null;
        }

        return in_array($left, $availableValues, true) ? $left : null;
    }

    /**
     * @param list<string> $availableValues
     */
    private static function intersectDefaultString(?string $left, ?string $right, array $availableValues): ?string
    {
        if ($left === null || $right === null || $left !== $right) {
            return null;
        }

        return in_array($left, $availableValues, true) ? $left : null;
    }

    /**
     * @param list<array{label: string, value: string, width: int, height: int, resolution: string}> $sizes
     * @return list<string>
     */
    private static function extractSizeFieldList(array $sizes, string $field): array
    {
        $result = [];
        foreach ($sizes as $size) {
            $value = trim((string) ($size[$field] ?? ''));
            if ($value === '') {
                continue;
            }

            $result[] = $value;
        }

        return array_values(array_unique($result));
    }

    /**
     * @param array{label: string, value: string, width: int, height: int, resolution: string} $option
     */
    private static function buildSizeOptionKey(array $option): string
    {
        return implode('|', [$option['label'], $option['value'], $option['resolution']]);
    }
}
