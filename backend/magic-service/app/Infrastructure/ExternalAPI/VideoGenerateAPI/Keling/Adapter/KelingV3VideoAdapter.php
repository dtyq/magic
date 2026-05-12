<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Adapter;

use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Capability\KelingV3GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\KelingTransportFactory;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Prompt\KelingPromptReferenceFormatter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;

readonly class KelingV3VideoAdapter implements VideoGenerationProviderAdapterInterface
{
    public function __construct(
        private KelingV3GenerationCapabilityProvider $capabilityProvider,
        private KelingTransportFactory $transportFactory,
    ) {
    }

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        return $this->capabilityProvider->supportsModel($modelVersion, $modelId);
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        return $this->capabilityProvider->resolveGenerationConfig($modelVersion, $modelId);
    }

    public function buildProviderPayload(VideoQueueOperationEntity $operation): array
    {
        $request = $operation->getRawRequest();
        $inputs = is_array($request['inputs'] ?? null) ? $request['inputs'] : [];
        $generation = is_array($request['generation'] ?? null) ? $request['generation'] : [];
        $frames = is_array($inputs['frames'] ?? null) ? $inputs['frames'] : [];
        $referenceImages = is_array($inputs['reference_images'] ?? null) ? $inputs['reference_images'] : [];

        $payload = [
            'model_name' => $this->capabilityProvider->providerModelName(),
            'prompt' => (new KelingPromptReferenceFormatter())->format((string) ($request['prompt'] ?? '')),
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

            $payload[$providerKey] = $requestKey === 'duration_seconds'
                ? (string) ((int) $generation[$requestKey])
                : $generation[$requestKey];
            $acceptedParams[] = 'generation.' . $requestKey;
        }
        if (! array_key_exists('duration', $payload)) {
            $payload['duration'] = $this->capabilityProvider->resolveDuration($generation);
            $acceptedParams[] = 'generation.duration_seconds';
        }

        $payload['mode'] = $this->capabilityProvider->resolveGenerationMode($generation);
        if (array_key_exists('mode', $generation)) {
            $acceptedParams[] = 'generation.mode';
        } elseif (array_key_exists('resolution', $generation)) {
            $acceptedParams[] = 'generation.resolution';
        } else {
            $acceptedParams[] = 'generation.resolution';
        }

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

        $operation->setAcceptedParams(array_values(array_unique($acceptedParams)));
        $operation->setIgnoredParams(array_values(array_unique($ignoredParams)));

        return $payload;
    }

    public function submit(VideoQueueOperationEntity $operation, QueueExecutorConfig $config): string
    {
        $transport = $this->transportFactory->create($config);
        $response = $transport->submitV3Video(
            $config,
            $operation->getProviderPayload(),
            $this->hasImageInput($operation),
            $this->buildLogContext($operation),
        );

        $taskId = $this->firstNonEmptyString(
            $response['data']['task_id'] ?? null,
            $response['data']['id'] ?? null,
        );
        if ($taskId === null) {
            throw new ProviderVideoException('keling v3 submit succeeded but task id missing');
        }

        return $taskId;
    }

    public function query(VideoQueueOperationEntity $operation, QueueExecutorConfig $config, string $providerTaskId): array
    {
        $transport = $this->transportFactory->create($config);
        $detail = $transport->queryV3Video(
            $config,
            $providerTaskId,
            $this->hasImageInput($operation),
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
                'message' => 'video generation failed',
                'provider_code' => isset($detail['code']) ? (string) $detail['code'] : null,
            ] : null,
        ];
    }

    private function hasImageInput(VideoQueueOperationEntity $operation): bool
    {
        $inputs = is_array($operation->getRawRequest()['inputs'] ?? null) ? $operation->getRawRequest()['inputs'] : [];
        $frames = is_array($inputs['frames'] ?? null) ? $inputs['frames'] : [];
        $referenceImages = is_array($inputs['reference_images'] ?? null) ? $inputs['reference_images'] : [];

        return $this->firstNonEmptyString(
            $this->extractFrameUri($frames, 'start'),
            $this->extractReferenceImageUri($referenceImages),
        ) !== null;
    }

    private function extractFrameUri(array $frames, string $targetRole): ?string
    {
        foreach ($frames as $frame) {
            if (! is_array($frame)) {
                continue;
            }

            $role = strtolower(trim((string) ($frame['role'] ?? '')));
            $uri = $this->normalizeOptionalString($frame['uri'] ?? null);
            if ($role === $targetRole && $uri !== null) {
                return $uri;
            }
        }

        return null;
    }

    private function extractReferenceImageUri(array $referenceImages): ?string
    {
        foreach ($referenceImages as $referenceImage) {
            if (! is_array($referenceImage)) {
                continue;
            }

            $uri = $this->normalizeOptionalString($referenceImage['uri'] ?? null);
            if ($uri !== null) {
                return $uri;
            }
        }

        return null;
    }

    private function normalizeOptionalString(mixed $value): ?string
    {
        $normalized = is_string($value) ? trim($value) : '';
        return $normalized === '' ? null : $normalized;
    }

    private function firstNonEmptyString(mixed ...$values): ?string
    {
        foreach ($values as $value) {
            $normalized = $this->normalizeOptionalString($value);
            if ($normalized !== null) {
                return $normalized;
            }
        }

        return null;
    }

    private function buildLogContext(VideoQueueOperationEntity $operation, ?string $providerTaskId = null): array
    {
        return array_filter([
            'video_id' => $operation->getVideoId(),
            'operation_id' => $operation->getId(),
            'provider_task_id' => $providerTaskId,
            'model' => $operation->getModelVersion(),
            'endpoint' => $operation->getEndpoint(),
        ], static fn (mixed $value): bool => $value !== null && $value !== '');
    }
}
