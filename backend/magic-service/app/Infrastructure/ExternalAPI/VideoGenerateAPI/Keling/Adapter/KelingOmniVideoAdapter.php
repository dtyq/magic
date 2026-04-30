<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Adapter;

use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputModeDefinition;
use App\Domain\ModelGateway\Entity\ValueObject\VideoTaskType;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\KelingTransportFactory;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;

readonly class KelingOmniVideoAdapter implements VideoGenerationProviderAdapterInterface
{
    private const array MODEL_IDS = ['keling-video', 'kling-v3-omni'];

    private const array MODEL_VERSIONS = ['kling-v3-omni', 'maas_kl_o3'];

    private const int DEFAULT_DURATION_SECONDS = 5;

    private const string DEFAULT_MODE = 'std';

    /**
     * @var array<string, string>
     */
    private const array MODE_TO_RESOLUTION = [
        'std' => '720p',
        'pro' => '1080p',
    ];

    /**
     * @var array<string, string>
     */
    private const array RESOLUTION_TO_MODE = [
        '720p' => 'std',
        '1080p' => 'pro',
    ];

    public function __construct(
        private KelingTransportFactory $transportFactory,
    ) {
    }

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
            'supported_inputs' => ['text_prompt', 'image', 'last_frame', 'reference_images', 'reference_videos', 'video_edit'],
            'reference_images' => [
                'max_count' => 7,
                'reference_types' => ['asset', 'style'],
                'style_supported' => true,
            ],
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
                'video_edit' => VideoInputModeDefinition::videoEdit(
                    description: 'video_edit',
                    maxCount: 1,
                )->toArray(),
                VideoInputMode::KeyframeGuided->value => VideoInputModeDefinition::keyframeGuided(
                    description: 'keyframe_guided',
                    frameRoles: ['start', 'end'],
                )->toArray(),
            ],
            'constraints' => [],
        ]);
    }

    public function buildProviderPayload(VideoQueueOperationEntity $operation): array
    {
        $request = $operation->getRawRequest();
        $task = $this->normalizeTask($request['task'] ?? null);
        $inputs = is_array($request['inputs'] ?? null) ? $request['inputs'] : [];
        $generation = is_array($request['generation'] ?? null) ? $request['generation'] : [];
        $extensions = is_array($request['extensions']['keling']['omni_video'] ?? null)
            ? $request['extensions']['keling']['omni_video']
            : [];

        $payload = array_filter([
            'model_name' => trim($operation->getModelVersion()) !== '' ? $operation->getModelVersion() : 'kling-v3-omni',
            'prompt' => (string) ($request['prompt'] ?? ''),
            'multi_shot' => $this->normalizeOptionalBool($extensions['multi_shot'] ?? null),
            'shot_type' => $this->normalizeOptionalString($extensions['shot_type'] ?? null),
            'multi_prompt' => is_array($extensions['multi_prompt'] ?? null) ? array_values($extensions['multi_prompt']) : [],
            'image_list' => $this->buildImageList($inputs),
            'video_list' => $this->buildVideoList($inputs, $task),
            'element_list' => is_array($extensions['element_list'] ?? null) ? array_values($extensions['element_list']) : [],
            'mode' => $this->resolveGenerationMode($generation),
            'aspect_ratio' => $this->normalizeOptionalString($generation['aspect_ratio'] ?? null),
            'duration' => $task === VideoTaskType::Edit->value ? null : $this->resolveDuration($generation),
            'external_task_id' => $this->normalizeOptionalString($extensions['external_task_id'] ?? null),
        ], static fn (mixed $value): bool => $value !== null && $value !== '' && $value !== []);

        $sound = $this->resolveSound($generation, $payload['video_list'] ?? []);
        if ($sound !== null) {
            $payload['sound'] = $sound;
        }

        if (array_key_exists('watermark', $generation)) {
            $payload['watermark_info'] = ['enabled' => (bool) $generation['watermark']];
        }

        $negativePrompt = $this->normalizeOptionalString($generation['negative_prompt'] ?? null);
        if ($negativePrompt !== null) {
            $payload['prompt'] = trim(((string) ($payload['prompt'] ?? '')) . "\n\n负向约束：" . $negativePrompt);
        }

        $operation->setAcceptedParams($this->acceptedParamsFromPayload($payload));
        $operation->setIgnoredParams([]);

        return $payload;
    }

    public function submit(VideoQueueOperationEntity $operation, QueueExecutorConfig $config): string
    {
        $transport = $this->transportFactory->create($config);
        $response = $transport->submitOmniVideo(
            $config,
            $operation->getProviderPayload(),
            $this->buildLogContext($operation),
        );

        $taskId = $this->firstNonEmptyString(
            $response['data']['task_id'] ?? null,
            $response['data']['id'] ?? null,
        );
        if ($taskId === null) {
            throw new ProviderVideoException($this->extractProviderMessage($response, 'keling submit succeeded but task id missing'));
        }

        return $taskId;
    }

    public function query(VideoQueueOperationEntity $operation, QueueExecutorConfig $config, string $providerTaskId): array
    {
        $transport = $this->transportFactory->create($config);
        $detail = $transport->queryOmniVideo(
            $config,
            $providerTaskId,
            $this->buildLogContext($operation, $providerTaskId),
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

    private function buildImageList(array $inputs): array
    {
        $imageList = [];
        $frames = is_array($inputs['frames'] ?? null) ? $inputs['frames'] : [];
        foreach ($frames as $frame) {
            if (! is_array($frame)) {
                continue;
            }

            $uri = $this->normalizeOptionalString($frame['uri'] ?? null);
            $role = $this->normalizeOptionalString($frame['role'] ?? null);
            if ($uri === null || $role === null) {
                continue;
            }

            $type = match ($role) {
                'start' => 'first_frame',
                'end' => 'end_frame',
                default => null,
            };
            if ($type === null) {
                continue;
            }

            $imageList[] = [
                'image_url' => $uri,
                'type' => $type,
            ];
        }

        $referenceImages = is_array($inputs['reference_images'] ?? null) ? $inputs['reference_images'] : [];
        foreach ($referenceImages as $referenceImage) {
            if (! is_array($referenceImage)) {
                continue;
            }

            $uri = $this->normalizeOptionalString($referenceImage['uri'] ?? null);
            if ($uri === null) {
                continue;
            }

            $imageList[] = ['image_url' => $uri];
        }

        return $imageList;
    }

    private function buildVideoList(array $inputs, string $task): array
    {
        $videoList = [];
        $referenceVideos = is_array($inputs['reference_videos'] ?? null) ? $inputs['reference_videos'] : [];
        $referType = $task === VideoTaskType::Edit->value ? 'base' : 'feature';
        foreach ($referenceVideos as $referenceVideo) {
            if (! is_array($referenceVideo)) {
                continue;
            }

            $uri = $this->normalizeOptionalString($referenceVideo['uri'] ?? null);
            if ($uri === null) {
                continue;
            }

            $videoList[] = [
                'video_url' => $uri,
                'refer_type' => $referType,
            ];
        }

        return $videoList;
    }

    private function normalizeTask(mixed $value): string
    {
        $task = strtolower(trim((string) $value));
        return $task === VideoTaskType::Edit->value ? VideoTaskType::Edit->value : VideoTaskType::Generate->value;
    }

    private function resolveGenerationMode(array $generation): string
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

    private function resolveDuration(array $generation): string
    {
        $duration = (int) ($generation['duration_seconds'] ?? self::DEFAULT_DURATION_SECONDS);
        if ($duration <= 0) {
            $duration = self::DEFAULT_DURATION_SECONDS;
        }

        return (string) $duration;
    }

    private function resolveSound(array $generation, array $videoList): ?string
    {
        if ($videoList !== []) {
            return 'off';
        }

        $generateAudio = $this->normalizeOptionalBool($generation['generate_audio'] ?? null);
        if ($generateAudio === null) {
            return null;
        }

        return $generateAudio ? 'on' : 'off';
    }

    private function normalizeOptionalString(mixed $value): ?string
    {
        $normalized = is_string($value) ? trim($value) : '';
        return $normalized === '' ? null : $normalized;
    }

    private function normalizeOptionalBool(mixed $value): ?bool
    {
        if ($value === null) {
            return null;
        }

        if (is_bool($value)) {
            return $value;
        }

        if (is_int($value) || is_float($value)) {
            return match ((int) $value) {
                1 => true,
                0 => false,
                default => null,
            };
        }

        return match (strtolower(trim((string) $value))) {
            '1', 'true', 'on', 'yes' => true,
            '0', 'false', 'off', 'no' => false,
            default => null,
        };
    }

    private function acceptedParamsFromPayload(array $payload): array
    {
        $accepted = [];
        foreach (array_keys($payload) as $key) {
            $accepted[] = match ($key) {
                'prompt' => 'prompt',
                'image_list' => 'inputs.reference_images',
                'video_list' => 'inputs.reference_videos',
                'mode' => 'generation.mode',
                'aspect_ratio' => 'generation.aspect_ratio',
                'duration' => 'generation.duration_seconds',
                'sound' => 'generation.generate_audio',
                'watermark_info' => 'generation.watermark',
                'multi_shot' => 'extensions.keling.omni_video.multi_shot',
                'shot_type' => 'extensions.keling.omni_video.shot_type',
                'multi_prompt' => 'extensions.keling.omni_video.multi_prompt',
                'element_list' => 'extensions.keling.omni_video.element_list',
                'external_task_id' => 'extensions.keling.omni_video.external_task_id',
                default => $key,
            };
        }

        return array_values(array_unique($accepted));
    }

    private function buildLogContext(VideoQueueOperationEntity $operation, ?string $providerTaskId = null): array
    {
        return array_filter([
            'video_id' => $operation->getVideoId(),
            'operation_id' => $operation->getId(),
            'provider_task_id' => $providerTaskId,
            'model' => $operation->getModel(),
            'endpoint' => $operation->getEndpoint(),
        ], static fn (mixed $value): bool => is_string($value) && trim($value) !== '');
    }

    private function firstNonEmptyString(mixed ...$candidates): ?string
    {
        foreach ($candidates as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }

        return null;
    }

    private function extractProviderMessage(array $response, string $fallback): string
    {
        foreach ([
            is_array($response['error'] ?? null) ? ($response['error']['message'] ?? null) : null,
            $response['message'] ?? null,
            $response['msg'] ?? null,
            is_array($response['data'] ?? null) ? ($response['data']['message'] ?? null) : null,
            is_array($response['data']['error'] ?? null) ? ($response['data']['error']['message'] ?? null) : null,
            is_array($response['data'] ?? null) ? ($response['data']['task_status_msg'] ?? null) : null,
        ] as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }

        return $fallback;
    }
}
