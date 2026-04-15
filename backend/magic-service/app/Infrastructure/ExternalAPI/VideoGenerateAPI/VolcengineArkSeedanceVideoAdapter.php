<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI;

use App\Domain\ModelGateway\Contract\VideoGenerationProviderAdapterInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;

readonly class VolcengineArkSeedanceVideoAdapter implements VideoGenerationProviderAdapterInterface
{
    // 对齐方舟 Seedance 当前文档里的默认时长，缺省时我们按 5 秒回填。
    private const int DEFAULT_DURATION_SECONDS = 5;

    // 这是当前接入侧采用的保守默认值，不表示官方永远固定只会默认到 720p。
    private const string DEFAULT_RESOLUTION = '720p';

    /**
     * 当前按方舟 Seedance 文档支持范围声明，后续如果官方扩容需要同步这里。
     *
     * @var list<string>
     */
    private const array SUPPORTED_ASPECT_RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9', 'adaptive'];

    /**
     * 当前按方舟 Seedance 文档支持范围声明，后续如果官方扩容需要同步这里。
     *
     * @var list<int>
     */
    private const array SUPPORTED_DURATIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    /**
     * 当前按方舟 Seedance 文档支持范围声明，后续如果官方扩容需要同步这里。
     *
     * @var list<string>
     */
    private const array SUPPORTED_RESOLUTIONS = ['480p', '720p', '1080p'];

    public function __construct(
        private VolcengineArkVideoClient $client,
    ) {
    }

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        // VolcengineArk 的视频模型标识不是稳定白名单，当前运行时也是先按 providerCode
        // 路由到这个 adapter，再由它统一承接方舟视频协议，因此这里仅要求模型标识非空。
        return trim($modelId) !== '' || trim($modelVersion) !== '';
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        if (! $this->supportsModel($modelVersion, $modelId)) {
            return null;
        }

        return new VideoGenerationConfig([
            'supported_inputs' => [
                'text_prompt',
                'image',
                'reference_images',
                'audio',
                'video',
                'mask',
                'video_extension',
                'video_edit',
                'video_upscale',
            ],
            'reference_images' => [
                'max_count' => 4,
                'reference_types' => ['asset'],
                'style_supported' => false,
            ],
            'generation' => [
                'aspect_ratios' => self::SUPPORTED_ASPECT_RATIOS,
                'durations' => self::SUPPORTED_DURATIONS,
                'default_duration_seconds' => self::DEFAULT_DURATION_SECONDS,
                'resolutions' => self::SUPPORTED_RESOLUTIONS,
                'default_resolution' => self::DEFAULT_RESOLUTION,
                'supports_seed' => true,
                'seed_range' => [-1, 4294967295],
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
        $inputs = is_array($request['inputs'] ?? null) ? $request['inputs'] : [];
        $generation = is_array($request['generation'] ?? null) ? $request['generation'] : [];
        $frames = is_array($inputs['frames'] ?? null) ? $inputs['frames'] : [];
        $referenceImages = is_array($inputs['reference_images'] ?? null) ? $inputs['reference_images'] : [];
        $audioInputs = is_array($inputs['audio'] ?? null) ? $inputs['audio'] : [];
        $content = [[
            'type' => 'text',
            'text' => $this->buildPrompt($request, $generation),
        ]];
        $acceptedParams = ['prompt', 'task'];
        $ignoredParams = [];

        $startFrameUri = $this->extractFrameUri($frames, ['start', 'first']);
        if ($startFrameUri !== null) {
            $content[] = [
                'type' => 'image_url',
                'image_url' => ['url' => $startFrameUri],
                'role' => 'first_frame',
            ];
            $acceptedParams[] = 'inputs.frames.start';
        }

        $endFrameUri = $this->extractFrameUri($frames, ['end', 'last']);
        if ($endFrameUri !== null) {
            $content[] = [
                'type' => 'image_url',
                'image_url' => ['url' => $endFrameUri],
                'role' => 'last_frame',
            ];
            $acceptedParams[] = 'inputs.frames.end';
        }

        foreach ($referenceImages as $referenceImage) {
            if (! is_array($referenceImage)) {
                continue;
            }

            $uri = $this->firstNonEmptyString($referenceImage['uri'] ?? null);
            if ($uri === null) {
                continue;
            }

            $content[] = [
                'type' => 'image_url',
                'image_url' => ['url' => $uri],
            ];
            $acceptedParams[] = 'inputs.reference_images';
        }

        $videoUri = $this->firstNonEmptyString($inputs['video']['uri'] ?? null);
        if ($videoUri !== null) {
            $content[] = [
                'type' => 'video_url',
                'video_url' => ['url' => $videoUri],
            ];
            $acceptedParams[] = 'inputs.video';
        }

        foreach ($audioInputs as $audioInput) {
            if (! is_array($audioInput)) {
                continue;
            }

            $audioUri = $this->firstNonEmptyString($audioInput['uri'] ?? null);
            if ($audioUri === null) {
                continue;
            }

            $audio = ['url' => $audioUri];
            $role = $this->firstNonEmptyString($audioInput['role'] ?? null);
            if ($role !== null) {
                $audio['role'] = $role;
            }

            $content[] = [
                'type' => 'audio_url',
                'audio_url' => $audio,
            ];
            $acceptedParams[] = 'inputs.audio';
        }

        $maskUri = $this->firstNonEmptyString($inputs['mask']['uri'] ?? null);
        if ($maskUri !== null) {
            $content[] = [
                'type' => 'mask_url',
                'mask_url' => ['url' => $maskUri],
            ];
            $acceptedParams[] = 'inputs.mask';
        }

        $modelId = $this->firstNonEmptyString($request['model_id'] ?? null, $operation->getModel()) ?? $operation->getModel();
        $payload = [
            'model' => $modelId,
            'task' => $this->firstNonEmptyString($request['task'] ?? null, 'generate') ?? 'generate',
            'content' => $content,
        ];

        $callbackUrl = $this->firstNonEmptyString($request['callbacks']['webhook_url'] ?? null);
        if ($callbackUrl !== null) {
            $payload['callback_url'] = $callbackUrl;
            $acceptedParams[] = 'callbacks.webhook_url';
        }

        $serviceTier = $this->firstNonEmptyString($request['execution']['service_tier'] ?? null);
        if ($serviceTier !== null) {
            $ignoredParams[] = 'execution.service_tier';
        }

        if (array_key_exists('expires_after_seconds', $request['execution'] ?? [])) {
            $payload['execution_expires_after'] = (int) $request['execution']['expires_after_seconds'];
            $acceptedParams[] = 'execution.expires_after_seconds';
        }
        if (array_key_exists('return_last_frame', $generation)) {
            $payload['return_last_frame'] = (bool) $generation['return_last_frame'];
            $acceptedParams[] = 'generation.return_last_frame';
        }
        if (array_key_exists('generate_audio', $generation)) {
            $payload['generate_audio'] = (bool) $generation['generate_audio'];
            $acceptedParams[] = 'generation.generate_audio';
        }
        if (array_key_exists('enhance_prompt', $generation)) {
            $payload['enhance_prompt'] = (bool) $generation['enhance_prompt'];
            $acceptedParams[] = 'generation.enhance_prompt';
        }
        if (array_key_exists('watermark', $generation)) {
            $acceptedParams[] = 'generation.watermark';
        }

        foreach (array_keys($generation) as $field) {
            if (in_array($field, [
                'aspect_ratio',
                'duration_seconds',
                'resolution',
                'seed',
                'camera_fixed',
                'return_last_frame',
                'generate_audio',
                'watermark',
                'enhance_prompt',
            ], true)) {
                continue;
            }

            $ignoredParams[] = 'generation.' . $field;
        }

        foreach (array_keys($request) as $field) {
            if (in_array($field, ['model_id', 'task', 'prompt', 'inputs', 'generation', 'callbacks', 'execution'], true)) {
                continue;
            }

            $ignoredParams[] = $field;
        }

        $operation->setAcceptedParams(array_values(array_unique($acceptedParams)));
        $operation->setIgnoredParams(array_values(array_unique($ignoredParams)));

        return $payload;
    }

    public function submit(VideoQueueOperationEntity $operation, QueueExecutorConfig $config): string
    {
        $response = $this->client->post(
            $config->getBaseUrl(),
            $config->getApiKey(),
            '/contents/generations/tasks',
            $operation->getProviderPayload(),
            ['operation_id' => $operation->getId()],
        );

        $taskId = $this->firstNonEmptyString(
            $response['id'] ?? null,
            $response['task_id'] ?? null,
            $response['data']['id'] ?? null,
            $response['data']['task_id'] ?? null,
        );
        if ($taskId === null) {
            throw new ProviderVideoException('volcengine ark seedance submit succeeded but task id missing');
        }

        return $taskId;
    }

    public function query(VideoQueueOperationEntity $operation, QueueExecutorConfig $config, string $providerTaskId): array
    {
        $detail = $this->client->get(
            $config->getBaseUrl(),
            $config->getApiKey(),
            '/contents/generations/tasks/' . rawurlencode($providerTaskId),
            [
                'operation_id' => $operation->getId(),
                'provider_task_id' => $providerTaskId,
            ],
        );

        $status = strtolower(trim((string) ($detail['status'] ?? $detail['data']['status'] ?? 'queued')));
        $content = is_array($detail['content'] ?? null)
            ? $detail['content']
            : (is_array($detail['data']['content'] ?? null) ? $detail['data']['content'] : []);
        $videoUrl = $this->firstNonEmptyString(
            $content['video_url'] ?? null,
            $content['url'] ?? null,
            is_array($content['videos'][0] ?? null) ? ($content['videos'][0]['video_url'] ?? $content['videos'][0]['url'] ?? null) : null,
        );
        $lastFrameUrl = $this->firstNonEmptyString(
            $content['last_frame_url'] ?? null,
            $content['lastFrameUrl'] ?? null,
            is_array($content['images'][0] ?? null) ? ($content['images'][0]['url'] ?? $content['images'][0]['image_url'] ?? null) : null,
        );

        $resultStatus = match ($status) {
            'succeeded', 'success' => 'succeeded',
            'failed', 'error', 'expired', 'cancelled', 'canceled' => 'failed',
            default => 'processing',
        };
        $errorCode = match ($status) {
            'expired' => 'PROVIDER_EXPIRED',
            'cancelled', 'canceled' => 'PROVIDER_CANCELLED',
            'failed', 'error' => 'PROVIDER_FAILED',
            default => null,
        };
        $error = is_array($detail['error'] ?? null) ? $detail['error'] : [];
        $data = is_array($detail['data'] ?? null) ? $detail['data'] : [];

        return [
            'status' => $resultStatus,
            'provider_result' => $detail,
            'output' => array_filter([
                'video_url' => $videoUrl,
                'last_frame_url' => $lastFrameUrl,
                'provider_task_id' => $providerTaskId,
                'provider_base_url' => rtrim($config->getBaseUrl(), '/'),
            ], static fn (mixed $value): bool => $value !== null && $value !== ''),
            'error' => $errorCode === null ? null : [
                'code' => $errorCode,
                'message' => $this->firstNonEmptyString(
                    $detail['message'] ?? null,
                    $detail['msg'] ?? null,
                    $error['message'] ?? null,
                    $data['message'] ?? null,
                    'video generation failed',
                ) ?? 'video generation failed',
                'provider_code' => null,
            ],
        ];
    }

    /**
     * @param array<string, mixed> $request
     * @param array<string, mixed> $generation
     */
    private function buildPrompt(array $request, array $generation): string
    {
        $parts = [];
        $prompt = trim((string) ($request['prompt'] ?? ''));
        if ($prompt !== '') {
            $parts[] = $prompt;
        }

        $resolution = trim((string) ($generation['resolution'] ?? self::DEFAULT_RESOLUTION));
        if (! in_array($resolution, self::SUPPORTED_RESOLUTIONS, true)) {
            $resolution = self::DEFAULT_RESOLUTION;
        }
        $parts[] = '--rs ' . $resolution;

        $aspectRatio = trim((string) ($generation['aspect_ratio'] ?? ''));
        if (in_array($aspectRatio, self::SUPPORTED_ASPECT_RATIOS, true)) {
            $parts[] = '--rt ' . $aspectRatio;
        }

        $duration = array_key_exists('duration_seconds', $generation)
            ? (int) $generation['duration_seconds']
            : self::DEFAULT_DURATION_SECONDS;
        if (! in_array($duration, self::SUPPORTED_DURATIONS, true)) {
            $duration = self::DEFAULT_DURATION_SECONDS;
        }
        $parts[] = '--dur ' . $duration;

        if (array_key_exists('seed', $generation)) {
            $parts[] = '--seed ' . (int) $generation['seed'];
        }

        if (array_key_exists('watermark', $generation)) {
            $parts[] = '--wm ' . ($generation['watermark'] ? 'true' : 'false');
        }

        if (array_key_exists('camera_fixed', $generation)) {
            $parts[] = '--cf ' . ($generation['camera_fixed'] ? 'true' : 'false');
        }

        return trim(implode(' ', $parts));
    }

    private function firstNonEmptyString(mixed ...$candidates): ?string
    {
        foreach ($candidates as $candidate) {
            if (! is_scalar($candidate)) {
                continue;
            }

            $value = trim((string) $candidate);
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    /**
     * @param list<array<string, mixed>> $frames
     * @param list<string> $roles
     */
    private function extractFrameUri(array $frames, array $roles): ?string
    {
        foreach ($frames as $frame) {
            if (! is_array($frame)) {
                continue;
            }

            $role = strtolower(trim((string) ($frame['role'] ?? '')));
            if (! in_array($role, $roles, true)) {
                continue;
            }

            $uri = $this->firstNonEmptyString($frame['uri'] ?? null);
            if ($uri !== null) {
                return $uri;
            }
        }

        return null;
    }
}
