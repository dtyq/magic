<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use Hyperf\Contract\TranslatorInterface;

readonly class CloudswayKelingVideoAdapter extends AbstractCloudswayVideoAdapter
{
    private const string MODEL_ID = 'keling-3.0-video';

    private const int DEFAULT_DURATION_SECONDS = 5;

    private const array SUPPORTED_ASPECT_RATIOS = ['16:9', '9:16', '1:1'];

    private const array SUPPORTED_DURATIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

    private const array SUPPORTED_MODES = ['std', 'pro'];

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

    private const string DEFAULT_MODE = 'std';

    /**
     * @var array<string, string>
     */
    private const array RESOLUTION_TO_MODE = [
        '720p' => 'std',
        '1080p' => 'pro',
    ];

    /**
     * @var array<string, string>
     */
    private const array MODE_TO_RESOLUTION = [
        'std' => '720p',
        'pro' => '1080p',
    ];

    private const string PROVIDER_MODEL_NAME = 'kling-v3';

    private const string LEGACY_MODEL_VERSION = 'kling-v3';

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
            'supported_inputs' => ['text_prompt', 'image', 'last_frame'],
            'reference_images' => [
                'max_count' => 1,
                'reference_types' => ['asset'],
                'style_supported' => false,
            ],
            'generation' => [
                'aspect_ratios' => self::SUPPORTED_ASPECT_RATIOS,
                'durations' => self::SUPPORTED_DURATIONS,
                'default_duration_seconds' => 5,
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
                'standard' => [
                    'description' => $this->translateInputMode('standard'),
                    'supported_fields' => [],
                ],
                'image_reference' => [
                    'description' => $this->translateInputMode('image_reference.single'),
                    'supported_fields' => ['reference_images'],
                    'reference_images' => [
                        'max_count' => 1,
                        'reference_types' => ['asset'],
                        'style_supported' => false,
                    ],
                ],
                'keyframe_guided' => [
                    'description' => $this->translateInputMode('keyframe_guided.start_end'),
                    'supported_fields' => ['frames'],
                    'frame_roles' => ['start', 'end'],
                ],
            ],
            'constraints' => [],
        ]);
    }

    public function buildProviderPayload(VideoQueueOperationEntity $operation): array
    {
        $request = $operation->getRawRequest();
        $inputs = is_array($request['inputs'] ?? null) ? $request['inputs'] : [];
        $generation = is_array($request['generation'] ?? null) ? $request['generation'] : [];
        $frames = is_array($inputs['frames'] ?? null) ? $inputs['frames'] : [];
        $referenceImages = is_array($inputs['reference_images'] ?? null) ? $inputs['reference_images'] : [];

        $payload = [
            'model_name' => self::PROVIDER_MODEL_NAME,
            'prompt' => (string) ($request['prompt'] ?? ''),
        ];
        $acceptedParams = ['prompt'];
        $ignoredParams = [];

        $image = $this->firstNonEmptyString(
            $this->extractFrameUri($frames, 'start'),
            $this->extractReferenceImageUri($referenceImages),
        );
        if ($image !== null) {
            $payload['image'] = $image;
            $acceptedParams[] = $this->extractFrameUri($frames, 'start') === $image ? 'inputs.frames.start' : 'inputs.reference_images';
        }

        $imageTail = $this->extractFrameUri($frames, 'end');
        if ($imageTail !== null) {
            $payload['image_tail'] = $imageTail;
            $acceptedParams[] = 'inputs.frames.end';
        }

        foreach ([
            'negative_prompt' => 'negative_prompt',
            'aspect_ratio' => 'aspect_ratio',
            'duration_seconds' => 'duration',
        ] as $requestKey => $providerKey) {
            if (! array_key_exists($requestKey, $generation)) {
                continue;
            }

            $value = $generation[$requestKey];
            if (
                ($requestKey === 'aspect_ratio' && ! in_array($value, self::SUPPORTED_ASPECT_RATIOS, true))
                || ($requestKey === 'duration_seconds' && ! in_array((int) $value, self::SUPPORTED_DURATIONS, true))
            ) {
                $ignoredParams[] = 'generation.' . $requestKey;
                continue;
            }

            $payload[$providerKey] = $requestKey === 'duration_seconds'
                ? (string) ((int) $generation[$requestKey])
                : $generation[$requestKey];
            $acceptedParams[] = 'generation.' . $requestKey;
        }
        if (! array_key_exists('duration', $payload)) {
            $payload['duration'] = (string) self::DEFAULT_DURATION_SECONDS;
            $acceptedParams[] = 'generation.duration_seconds';
        }
        $payload['mode'] = $this->resolveGenerationMode($generation, $acceptedParams, $ignoredParams);
        if (array_key_exists('size', $generation)) {
            $ignoredParams[] = 'generation.size';
        }

        if (array_key_exists('generate_audio', $generation)) {
            $payload['sound'] = $generation['generate_audio'] ? 'on' : 'off';
            $acceptedParams[] = 'generation.generate_audio';
        }
        if (array_key_exists('watermark', $generation)) {
            $payload['watermark_info'] = ['enabled' => (bool) $generation['watermark']];
            $acceptedParams[] = 'generation.watermark';
        }
        foreach (array_keys($generation) as $field) {
            if (in_array($field, ['negative_prompt', 'mode', 'resolution', 'aspect_ratio', 'duration_seconds', 'size', 'generate_audio', 'watermark'], true)) {
                continue;
            }

            $ignoredParams[] = 'generation.' . $field;
        }
        if (! empty($request['task'] ?? null)) {
            $ignoredParams[] = 'task';
        }
        if (! empty($inputs['reference_videos'] ?? null)) {
            $ignoredParams[] = 'inputs.reference_videos';
        }

        $this->markAcceptedAndIgnored($operation, $acceptedParams, $ignoredParams);

        return $payload;
    }

    public function submit(VideoQueueOperationEntity $operation, QueueExecutorConfig $config): string
    {
        $path = $this->buildTaskPath($operation, false, null);
        $response = $this->postWithOperationContext(
            $operation,
            $config,
            $path,
            $operation->getProviderPayload(),
        );

        $taskId = $this->firstNonEmptyString(
            $response['data']['task_id'] ?? null,
            $response['data']['id'] ?? null,
        );
        if ($taskId === null) {
            throw new ProviderVideoException(
                $this->extractProviderMessage($response, 'cloudsway keling submit succeeded but task id missing')
            );
        }

        return $taskId;
    }

    public function query(VideoQueueOperationEntity $operation, QueueExecutorConfig $config, string $providerTaskId): array
    {
        $detail = $this->getWithOperationContext(
            $operation,
            $config,
            $this->buildTaskPath($operation, true, $providerTaskId),
            $providerTaskId,
        );

        $data = is_array($detail['data'] ?? null) ? $detail['data'] : [];
        $status = strtolower(trim((string) ($data['task_status'] ?? 'processing')));
        $videos = is_array($data['task_result']['videos'] ?? null) ? $data['task_result']['videos'] : [];
        $videoUrl = null;
        foreach ($videos as $video) {
            if (! is_array($video)) {
                continue;
            }

            $videoUrl = $this->firstNonEmptyString($video['url'] ?? null);
            if ($videoUrl !== null) {
                break;
            }
        }

        return [
            'status' => match ($status) {
                'succeed', 'succeeded', 'success' => 'succeeded',
                'failed', 'error' => 'failed',
                default => 'processing',
            },
            'provider_result' => $detail,
            'output' => $videoUrl === null ? [] : [
                'video_url' => $videoUrl,
                'provider_task_id' => $providerTaskId,
                'provider_base_url' => rtrim($config->getBaseUrl(), '/'),
            ],
            'error' => in_array($status, ['failed', 'error'], true) ? [
                'code' => 'PROVIDER_FAILED',
                'message' => $this->firstNonEmptyString($data['task_status_msg'] ?? null, $detail['message'] ?? null, 'video generation failed') ?? 'video generation failed',
                'provider_code' => isset($detail['code']) ? (string) $detail['code'] : null,
            ] : null,
        ];
    }

    /**
     * @param list<string> $acceptedParams
     * @param list<string> $ignoredParams
     */
    private function resolveGenerationMode(array $generation, array &$acceptedParams, array &$ignoredParams): string
    {
        $resolution = $this->normalizeResolution($generation['resolution'] ?? null);
        if ($resolution !== null) {
            $acceptedParams[] = 'generation.resolution';
            return self::RESOLUTION_TO_MODE[$resolution];
        }
        if (array_key_exists('resolution', $generation)) {
            $ignoredParams[] = 'generation.resolution';
        }

        // 正常链路会先在 canonical request 中补齐 resolution；这里只保留异常 rawRequest 的兜底。
        $mode = $this->normalizeMode($generation['mode'] ?? null);
        if ($mode !== null) {
            $acceptedParams[] = 'generation.mode';
            return $mode;
        }
        if (array_key_exists('mode', $generation)) {
            $ignoredParams[] = 'generation.mode';
        }

        return self::DEFAULT_MODE;
    }

    private function normalizeMode(mixed $value): ?string
    {
        $mode = strtolower(trim((string) $value));
        if ($mode === '') {
            return null;
        }

        return in_array($mode, self::SUPPORTED_MODES, true) ? $mode : null;
    }

    private function normalizeResolution(mixed $value): ?string
    {
        $resolution = strtolower(trim((string) $value));
        if ($resolution === '') {
            return null;
        }

        return in_array($resolution, self::SUPPORTED_RESOLUTIONS, true) ? $resolution : null;
    }

    private function buildTaskPath(VideoQueueOperationEntity $operation, bool $withTaskId, ?string $taskId): string
    {
        $request = $operation->getRawRequest();
        $inputs = is_array($request['inputs'] ?? null) ? $request['inputs'] : [];
        $frames = is_array($inputs['frames'] ?? null) ? $inputs['frames'] : [];
        $referenceImages = is_array($inputs['reference_images'] ?? null) ? $inputs['reference_images'] : [];
        $hasImageInput = $this->firstNonEmptyString(
            $this->extractFrameUri($frames, 'start'),
            $this->extractReferenceImageUri($referenceImages),
        ) !== null;
        $path = $hasImageInput ? 'kling/videos/image2video' : 'kling/videos/text2video';

        if ($withTaskId) {
            return $this->buildEndpointPath($operation, $path . '/' . rawurlencode((string) $taskId));
        }

        return $this->buildEndpointPath($operation, $path);
    }

    /**
     * Keling 的 mode 文案保留在 adapter 内生成，避免前端看到的说明和模型能力配置脱节。
     */
    private function translateInputMode(string $key, array $replace = []): string
    {
        return di(TranslatorInterface::class)->trans('video.input_modes.' . $key, $replace);
    }
}
