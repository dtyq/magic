<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;

/**
 * Wuyin 的 Veo 视频 adapter。
 *
 * 当前它只负责 Veo 模型族：
 * 1. 声明当前已接入的 `wuyin + veo-*` 实际支持能力
 * 2. 把统一视频请求映射成 Wuyin Veo 的 provider payload
 *
 * 这里写死的是“当前系统真实支持”的能力，而不是 Veo 官方理论能力。
 */
readonly class WuyinVeoVideoAdapter extends AbstractWuyinVideoAdapter
{
    private const string INPUT_TEXT_PROMPT = 'text_prompt';

    private const string INPUT_IMAGE = 'image';

    private const string INPUT_LAST_FRAME = 'last_frame';

    private const string FIELD_ASPECT_RATIO = 'aspect_ratio';

    private const string FIELD_RESOLUTION = 'resolution';

    private const string FIELD_SIZE = 'size';

    private const string RESOLUTION_4K = '4k';

    private const string PROVIDER_RESOLUTION_4K = '4K';

    private const string MODEL_ID_VEO_FAST = 'wuyin-veo-3.1-fast-generate-preview';

    private const string LEGACY_MODEL_ID_VEO_FAST = 'veo-3.1-fast-generate-preview';

    private const string MODEL_VERSION_VEO_FAST = 'veo3.1_fast';

    private const string MODEL_ID_VEO_PRO = 'wuyin-veo-3.1-generate-preview';

    private const string LEGACY_MODEL_ID_VEO_PRO = 'veo-3.1-generate-preview';

    private const string MODEL_VERSION_VEO_PRO = 'veo3.1_pro';

    private const array SUPPORTED_ASPECT_RATIOS = ['16:9', '9:16'];

    private const array SUPPORTED_RESOLUTIONS = ['720p', '1080p', '4k'];

    /**
     * @var list<array{label: string, value: string, width: int, height: int, resolution: string}>
     */
    private const array SUPPORTED_SIZES = [
        ['label' => '16:9', 'value' => '1280x720', 'width' => 1280, 'height' => 720, 'resolution' => '720p'],
        ['label' => '16:9', 'value' => '1920x1080', 'width' => 1920, 'height' => 1080, 'resolution' => '1080p'],
        ['label' => '16:9', 'value' => '3840x2160', 'width' => 3840, 'height' => 2160, 'resolution' => '4k'],
        ['label' => '9:16', 'value' => '720x1280', 'width' => 720, 'height' => 1280, 'resolution' => '720p'],
        ['label' => '9:16', 'value' => '1080x1920', 'width' => 1080, 'height' => 1920, 'resolution' => '1080p'],
        ['label' => '9:16', 'value' => '2160x3840', 'width' => 2160, 'height' => 3840, 'resolution' => '4k'],
    ];

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        return $this->isVeoModel($this->normalizedCandidates($modelVersion, $modelId));
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        if (! $this->supportsModel($modelVersion, $modelId)) {
            return null;
        }

        // 当前 Wuyin 接入的 Veo 能力只开放已经在线文档和线上模板都验证通过的字段。
        return new VideoGenerationConfig([
            'supported_inputs' => [self::INPUT_TEXT_PROMPT, self::INPUT_IMAGE, self::INPUT_LAST_FRAME],
            'reference_images' => [
                'max_count' => 0,
                'reference_types' => [],
                'style_supported' => false,
            ],
            'generation' => [
                'aspect_ratios' => ['16:9', '9:16'],
                'durations' => [],
                'resolutions' => ['720p', '1080p', '4k'],
                'sizes' => self::SUPPORTED_SIZES,
                'default_resolution' => '720p',
                'supports_seed' => false,
                'supports_watermark' => false,
                'supports_negative_prompt' => false,
                'supports_generate_audio' => false,
                'supports_person_generation' => false,
                'supports_enhance_prompt' => false,
                'supports_compression_quality' => false,
                'supports_resize_mode' => false,
                'supports_sample_count' => false,
            ],
            'constraints' => [],
        ]);
    }

    public function buildProviderPayload(VideoQueueOperationEntity $operation): array
    {
        $request = $operation->getRawRequest();
        $frames = $this->indexFrames($request['inputs']['frames'] ?? []);
        $referenceImages = $this->extractRequestInputArray($request, 'reference_images');
        $videoInput = $this->extractRequestInputArray($request, 'video');
        $generation = $this->extractRequestGeneration($request);
        ['payload' => $payload, 'accepted_params' => $acceptedParams, 'ignored_params' => $ignoredParams] = $this->createPromptPayloadState($request);

        // 当前 Wuyin Veo 仅接收这些字段，其余字段统一在 adapter 内过滤并记录 ignoredParams。
        if (isset($frames['start'])) {
            $payload['firstFrameUrl'] = $frames['start'];
            $acceptedParams[] = 'inputs.frames.start';
        }
        if (isset($frames['end'])) {
            $payload['lastFrameUrl'] = $frames['end'];
            $acceptedParams[] = 'inputs.frames.end';
        }
        if (isset($generation[self::FIELD_ASPECT_RATIO])) {
            if (in_array($generation[self::FIELD_ASPECT_RATIO], self::SUPPORTED_ASPECT_RATIOS, true)) {
                $payload['aspectRatio'] = $generation[self::FIELD_ASPECT_RATIO];
                $acceptedParams[] = 'generation.aspect_ratio';
            } else {
                $ignoredParams[] = 'generation.aspect_ratio';
            }
        }
        if (isset($generation[self::FIELD_RESOLUTION])) {
            if (in_array($generation[self::FIELD_RESOLUTION], self::SUPPORTED_RESOLUTIONS, true)) {
                $payload['size'] = $generation[self::FIELD_RESOLUTION] === self::RESOLUTION_4K
                    ? self::PROVIDER_RESOLUTION_4K
                    : $generation[self::FIELD_RESOLUTION];
                $acceptedParams[] = 'generation.resolution';
            } else {
                $ignoredParams[] = 'generation.resolution';
            }
        }
        if (isset($generation[self::FIELD_SIZE])) {
            $sizeAccepted = $this->applyGenerationSize($generation, $payload, $acceptedParams);
            if (! $sizeAccepted) {
                $ignoredParams[] = 'generation.size';
            }
        }
        foreach (array_keys($generation) as $field) {
            if (in_array($field, [self::FIELD_ASPECT_RATIO, self::FIELD_RESOLUTION, self::FIELD_SIZE], true)) {
                continue;
            }

            $ignoredParams[] = 'generation.' . $field;
        }
        $this->appendCommonIgnoredParams($request, $ignoredParams);
        if ($referenceImages !== []) {
            // 这些字段当前不会进入 provider payload，但会记录到 ignoredParams，便于排查。
            $ignoredParams[] = 'inputs.reference_images';
        }
        if ($videoInput !== []) {
            $ignoredParams[] = 'inputs.video';
        }

        return $this->finalizeProviderPayload($operation, $payload, $acceptedParams, $ignoredParams);
    }

    /**
     * @param array<string, mixed> $generation
     * @param array<string, mixed> $payload
     * @param list<string> $acceptedParams
     */
    private function applyGenerationSize(array $generation, array &$payload, array &$acceptedParams): bool
    {
        $matchedSize = $this->matchSupportedSize($generation[self::FIELD_SIZE] ?? null);
        if ($matchedSize === null) {
            return false;
        }

        $matchedAspectRatio = trim((string) ($matchedSize['label'] ?? ''));
        if (
            isset($generation[self::FIELD_ASPECT_RATIO])
            && is_string($generation[self::FIELD_ASPECT_RATIO])
            && $matchedAspectRatio !== ''
            && $generation[self::FIELD_ASPECT_RATIO] !== $matchedAspectRatio
        ) {
            return false;
        }

        $matchedResolution = trim((string) ($matchedSize['resolution'] ?? ''));
        if (
            isset($generation[self::FIELD_RESOLUTION])
            && is_string($generation[self::FIELD_RESOLUTION])
            && $matchedResolution !== ''
            && $generation[self::FIELD_RESOLUTION] !== $matchedResolution
        ) {
            return false;
        }

        if (! isset($payload['aspectRatio']) && $matchedAspectRatio !== '') {
            $payload['aspectRatio'] = $matchedAspectRatio;
        }
        if (! isset($payload['size']) && $matchedResolution !== '') {
            $payload['size'] = $matchedResolution === self::RESOLUTION_4K
                ? self::PROVIDER_RESOLUTION_4K
                : $matchedResolution;
        }
        $acceptedParams[] = 'generation.size';

        return true;
    }

    /**
     * @return null|array{label: string, value: string, width: int, height: int, resolution: string}
     */
    private function matchSupportedSize(mixed $value): ?array
    {
        $normalizedValue = is_string($value) ? strtolower(trim($value)) : '';
        if ($normalizedValue === '') {
            return null;
        }

        foreach (self::SUPPORTED_SIZES as $size) {
            if (strtolower($size['value']) === $normalizedValue) {
                return $size;
            }
        }

        return null;
    }

    /**
     * @param array<int, array<string, mixed>> $frames
     * @return array<string, string>
     */
    private function indexFrames(array $frames): array
    {
        // 把 frames 数组转成按 role 索引的 map，方便 provider payload 直接读取。
        $result = [];
        foreach ($frames as $frame) {
            $role = trim((string) ($frame['role'] ?? ''));
            $uri = trim((string) ($frame['uri'] ?? ''));
            if ($role !== '' && $uri !== '') {
                $result[$role] = $uri;
            }
        }

        return $result;
    }

    /**
     * @param list<string> $normalizedCandidates
     */
    private function isVeoModel(array $normalizedCandidates): bool
    {
        // 同时兼容 modelId / modelVersion 两种入口，避免上游传任意一种时失配。
        return array_any($normalizedCandidates, fn (string $candidate): bool => in_array($candidate, [
            self::MODEL_ID_VEO_FAST,
            self::LEGACY_MODEL_ID_VEO_FAST,
            self::MODEL_VERSION_VEO_FAST,
            self::MODEL_ID_VEO_PRO,
            self::LEGACY_MODEL_ID_VEO_PRO,
            self::MODEL_VERSION_VEO_PRO,
        ], true) || str_contains($candidate, 'veo'));
    }
}
