<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Adapter;

use App\Domain\ModelGateway\Contract\VideoGenerationConnectivityTestableInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoTaskType;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\ErrorCode\VideoGenerateErrorCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\Capability\KelingOmniGenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling\KelingTransportFactory;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Prompt\KelingPromptReferenceFormatter;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;

readonly class KelingOmniVideoAdapter implements VideoGenerationConnectivityTestableInterface
{
    public function __construct(
        private KelingOmniGenerationCapabilityProvider $capabilityProvider,
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

    public function resolveHasAudioOutput(string $modelVersion, string $modelId, array $request): bool
    {
        $task = $this->normalizeTask($request['task'] ?? null);
        $inputs = is_array($request['inputs'] ?? null) ? $request['inputs'] : [];
        $sound = $this->resolveSound($this->buildVideoList($inputs, $task));

        return $sound === 'on';
    }

    public function buildProviderPayload(VideoQueueOperationEntity $operation): array
    {
        $request = $operation->getRawRequest();
        $task = $this->normalizeTask($request['task'] ?? null);
        $inputs = is_array($request['inputs'] ?? null) ? $request['inputs'] : [];
        $generation = is_array($request['generation'] ?? null) ? $request['generation'] : [];
        $ignoredParams = [];
        $extensions = is_array($request['extensions']['keling']['omni_video'] ?? null)
            ? $request['extensions']['keling']['omni_video']
            : [];

        $payload = array_filter([
            'model_name' => trim($operation->getModelVersion()) !== '' ? $operation->getModelVersion() : 'kling-v3-omni',
            'prompt' => (new KelingPromptReferenceFormatter())->format((string) ($request['prompt'] ?? '')),
            'multi_shot' => $this->normalizeOptionalBool($extensions['multi_shot'] ?? null),
            'shot_type' => $this->normalizeOptionalString($extensions['shot_type'] ?? null),
            'multi_prompt' => is_array($extensions['multi_prompt'] ?? null) ? array_values($extensions['multi_prompt']) : [],
            'image_list' => $this->buildImageList($inputs),
            'video_list' => $this->buildVideoList($inputs, $task),
            'element_list' => is_array($extensions['element_list'] ?? null) ? array_values($extensions['element_list']) : [],
            'mode' => $this->capabilityProvider->resolveGenerationMode($generation),
            'aspect_ratio' => $this->normalizeOptionalString($generation['aspect_ratio'] ?? null),
            'duration' => $task === VideoTaskType::Edit->value ? null : $this->capabilityProvider->resolveDuration($generation),
            'external_task_id' => $this->normalizeOptionalString($extensions['external_task_id'] ?? null),
        ], static fn (mixed $value): bool => $value !== null && $value !== '' && $value !== []);

        $payload['sound'] = $this->resolveSound($payload['video_list'] ?? []);

        if (array_key_exists('watermark', $generation)) {
            $payload['watermark_info'] = ['enabled' => (bool) $generation['watermark']];
        }

        $negativePrompt = $this->normalizeOptionalString($generation['negative_prompt'] ?? null);
        if ($negativePrompt !== null) {
            $payload['prompt'] = trim(((string) ($payload['prompt'] ?? '')) . "\n\n负向约束：" . $negativePrompt);
        }
        if (array_key_exists('generate_audio', $generation)) {
            $ignoredParams[] = 'generation.generate_audio';
        }

        $operation->setAcceptedParams($this->acceptedParamsFromPayload($payload));
        $operation->setIgnoredParams($ignoredParams);

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
            throw new ProviderVideoException(VideoGenerateErrorCode::GENERAL_ERROR, VideoGenerateErrorCode::GENERAL_ERROR->getMessage());
        }

        return $taskId;
    }

    /**
     * 执行连通性测试。
     *
     * 通过非法时长触发 Keling 参数校验，只有命中 400 才视为连通成功。
     */
    public function testConnection(QueueExecutorConfig $config, string $modelVersion): bool
    {
        $transport = $this->transportFactory->create($config);

        try {
            $transport->submitOmniVideo(
                $config,
                [
                    'model_name' => $modelVersion,
                    'prompt' => 'connectivity-test',
                    'duration' => '0',
                    'mode' => 'std',
                    'aspect_ratio' => '16:9',
                    'sound' => 'on',
                ],
                ['connectivity_test' => true],
            );
        } catch (ProviderVideoException $exception) {
            if ($exception->getHttpStatus() === 400) {
                return true;
            }

            throw $exception;
        }

        // 未返回预期校验错误说明请求可能被接受，不能视为连通性测试成功。
        throw new ProviderVideoException(VideoGenerateErrorCode::INVALID_PARAMETER, 'Keling connectivity test did not receive the expected validation error');
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
                'message' => VideoGenerateErrorCode::GENERAL_ERROR->getMessage(),
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

    private function resolveSound(array $videoList): string
    {
        return $videoList === [] ? 'on' : 'off';
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
            if ($key === 'sound') {
                continue;
            }

            $accepted[] = match ($key) {
                'prompt' => 'prompt',
                'image_list' => 'inputs.reference_images',
                'video_list' => 'inputs.reference_videos',
                'mode' => 'generation.mode',
                'aspect_ratio' => 'generation.aspect_ratio',
                'duration' => 'generation.duration_seconds',
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
}
