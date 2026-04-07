<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;

/** @noinspection SpellCheckingInspection */
readonly class CloudswaySeedanceVideoAdapter extends AbstractCloudswayVideoAdapter
{
    private const string MODEL_ID = 'seedance-1.5-pro';

    private const int DEFAULT_DURATION_SECONDS = 5;

    private const string DEFAULT_RESOLUTION = '720p';

    private const array SUPPORTED_ASPECT_RATIOS = ['16:9', '9:16', '1:1'];

    private const array SUPPORTED_DURATIONS = [5, 10];

    private const array SUPPORTED_RESOLUTIONS = ['480p', '720p', '1080p'];

    private const string PROVIDER_MODEL_NAME = 'doubao-seedance-1-5-pro-251215';

    private const string LEGACY_MODEL_VERSION = 'doubao-seedance-1-5-pro-251215';

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        $normalizedModelId = strtolower(trim($modelId));
        if ($normalizedModelId === self::MODEL_ID) {
            return true;
        }

        return in_array(strtolower(trim($modelVersion)), [
            strtolower(self::LEGACY_MODEL_VERSION),
            'maas_seedance_1.5_pro',
        ], true);
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        if (! $this->supportsModel($modelVersion, $modelId)) {
            return null;
        }

        return new VideoGenerationConfig([
            'supported_inputs' => ['text_prompt', 'image'],
            'reference_images' => [
                'max_count' => 1,
                'reference_types' => ['asset'],
                'style_supported' => false,
            ],
            'generation' => [
                'aspect_ratios' => ['16:9', '9:16', '1:1'],
                'durations' => [5, 10],
                'default_duration_seconds' => 5,
                'resolutions' => ['480p', '720p', '1080p'],
                'default_resolution' => '720p',
                'supports_seed' => false,
                'supports_watermark' => true,
                'supports_negative_prompt' => false,
                'supports_generate_audio' => true,
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
        $generation = is_array($request['generation'] ?? null) ? $request['generation'] : [];
        $inputs = is_array($request['inputs'] ?? null) ? $request['inputs'] : [];
        $referenceImages = is_array($inputs['reference_images'] ?? null) ? $inputs['reference_images'] : [];
        $frames = is_array($inputs['frames'] ?? null) ? $inputs['frames'] : [];
        $acceptedParams = ['prompt'];
        $ignoredParams = [];

        $content = [[
            'type' => 'text',
            'text' => $this->buildSeedancePrompt($request, $generation, $acceptedParams, $ignoredParams),
        ]];

        $startFrame = $this->extractFrameUri($frames, 'start');
        $endFrame = $this->extractFrameUri($frames, 'end');
        if ($startFrame !== null && $endFrame !== null) {
            $content[] = [
                'type' => 'image_url',
                'image_url' => ['url' => $startFrame],
                'role' => 'first_frame',
            ];
            $content[] = [
                'type' => 'image_url',
                'image_url' => ['url' => $endFrame],
                'role' => 'last_frame',
            ];
            $acceptedParams[] = 'inputs.frames.start';
            $acceptedParams[] = 'inputs.frames.end';
        } else {
            $referenceImage = $this->firstNonEmptyString(
                $startFrame,
                $this->extractReferenceImageUri($referenceImages),
            );
            if ($referenceImage !== null) {
                $content[] = [
                    'type' => 'image_url',
                    'image_url' => ['url' => $referenceImage],
                ];
                $acceptedParams[] = $startFrame === $referenceImage ? 'inputs.frames.start' : 'inputs.reference_images';
            }
        }

        $payload = [
            'model' => self::PROVIDER_MODEL_NAME,
            'content' => $content,
        ];

        if (array_key_exists('generate_audio', $generation)) {
            $payload['generate_audio'] = (bool) $generation['generate_audio'];
            $acceptedParams[] = 'generation.generate_audio';
        }
        if (array_key_exists('watermark', $generation)) {
            $payload['watermark'] = (bool) $generation['watermark'];
            $acceptedParams[] = 'generation.watermark';
        }
        if (array_key_exists('size', $generation)) {
            $ignoredParams[] = 'generation.size';
        }
        foreach (array_keys($generation) as $field) {
            if (in_array($field, ['aspect_ratio', 'duration_seconds', 'resolution', 'generate_audio', 'watermark', 'size'], true)) {
                continue;
            }

            $ignoredParams[] = 'generation.' . $field;
        }
        if (! empty($request['task'] ?? null)) {
            $ignoredParams[] = 'task';
        }
        if ($endFrame !== null && $startFrame === null) {
            $ignoredParams[] = 'inputs.frames';
        }
        if (! empty($inputs['video'] ?? null)) {
            $ignoredParams[] = 'inputs.video';
        }

        $this->markAcceptedAndIgnored($operation, $acceptedParams, $ignoredParams);

        return $payload;
    }

    public function submit(VideoQueueOperationEntity $operation, QueueExecutorConfig $config): string
    {
        $response = $this->cloudswayVideoClient->post(
            $config->getBaseUrl(),
            $config->getApiKey(),
            $this->buildEndpointPath($operation, 'seedance/contents/generations/tasks'),
            $operation->getProviderPayload(),
        );

        $taskId = $this->firstNonEmptyString(
            $response['id'] ?? null,
            $response['data']['id'] ?? null,
            $response['data']['task_id'] ?? null,
        );
        if ($taskId === null) {
            throw new ProviderVideoException(
                $this->extractProviderMessage($response, 'cloudsway seedance submit succeeded but task id missing')
            );
        }

        return $taskId;
    }

    public function query(VideoQueueOperationEntity $operation, QueueExecutorConfig $config, string $providerTaskId): array
    {
        $detail = $this->cloudswayVideoClient->get(
            $config->getBaseUrl(),
            $config->getApiKey(),
            $this->buildEndpointPath($operation, 'seedance/contents/generations/tasks/' . rawurlencode($providerTaskId)),
        );

        $status = strtolower(trim((string) ($detail['status'] ?? $detail['data']['status'] ?? 'processing')));
        $content = [];
        if (is_array($detail['content'] ?? null)) {
            $content = $detail['content'];
        } elseif (is_array($detail['data']['content'] ?? null)) {
            $content = $detail['data']['content'];
        }
        $videoUrl = $this->firstNonEmptyString($content['video_url'] ?? null, $content['url'] ?? null);

        return [
            'status' => match ($status) {
                'succeeded', 'success' => 'succeeded',
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
                'message' => $this->firstNonEmptyString($detail['message'] ?? null, $detail['msg'] ?? null, 'video generation failed') ?? 'video generation failed',
                'provider_code' => null,
            ] : null,
        ];
    }

    /**
     * @param list<string> $acceptedParams
     * @param list<string> $ignoredParams
     */
    private function buildSeedancePrompt(array $request, array $generation, array &$acceptedParams, array &$ignoredParams): string
    {
        $prompt = trim((string) ($request['prompt'] ?? ''));
        $suffixes = [];
        if (array_key_exists('aspect_ratio', $generation)) {
            if (in_array((string) $generation['aspect_ratio'], self::SUPPORTED_ASPECT_RATIOS, true)) {
                $suffixes[] = '--ratio ' . trim((string) $generation['aspect_ratio']);
                $acceptedParams[] = 'generation.aspect_ratio';
            } else {
                $ignoredParams[] = 'generation.aspect_ratio';
            }
        }
        $durationSeconds = self::DEFAULT_DURATION_SECONDS;
        if (array_key_exists('duration_seconds', $generation)) {
            if (in_array((int) $generation['duration_seconds'], self::SUPPORTED_DURATIONS, true)) {
                $durationSeconds = (int) $generation['duration_seconds'];
            } else {
                $ignoredParams[] = 'generation.duration_seconds';
            }
        }
        $suffixes[] = '--dur ' . $durationSeconds;
        $acceptedParams[] = 'generation.duration_seconds';
        $resolution = self::DEFAULT_RESOLUTION;
        if (array_key_exists('resolution', $generation)) {
            if (in_array((string) $generation['resolution'], self::SUPPORTED_RESOLUTIONS, true)) {
                $resolution = trim((string) $generation['resolution']);
            } else {
                $ignoredParams[] = 'generation.resolution';
            }
        }
        $suffixes[] = '--rs ' . $resolution;
        $acceptedParams[] = 'generation.resolution';

        return trim($prompt . ' ' . implode(' ', $suffixes));
    }
}
