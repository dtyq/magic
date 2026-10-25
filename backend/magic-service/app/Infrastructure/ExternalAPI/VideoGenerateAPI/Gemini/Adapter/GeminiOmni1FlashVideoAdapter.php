<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Adapter;

use App\Domain\ModelGateway\Contract\VideoGenerationConnectivityTestableInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\ErrorCode\VideoGenerateErrorCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Capability\GeminiOmniGenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\GeminiTransportInterface;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoErrorMapper;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ReferenceMediaPayload;
use Dtyq\CloudFile\Kernel\Utils\RemoteDownloadSecurityConfig;
use Dtyq\CloudFile\Kernel\Utils\SafeRemoteFileDownloader;
use InvalidArgumentException;

final class GeminiOmni1FlashVideoAdapter implements VideoGenerationConnectivityTestableInterface
{
    private const string CONNECTIVITY_SUCCESS_MESSAGE = 'Video response format duration must be positive';

    private const array MEDIA_TYPES = [
        'frames' => 'image',
        'reference_images' => 'image',
        'reference_videos' => 'video',
        'reference_audios' => 'audio',
    ];

    private const array INPUT_MODES = [
        VideoInputMode::Standard->value,
        VideoInputMode::ImageReference->value,
        VideoInputMode::KeyframeGuided->value,
        VideoInputMode::VideoEdit->value,
        VideoInputMode::OmniReference->value,
    ];

    private SafeRemoteFileDownloader $remoteFileDownloader;

    public function __construct(
        private GeminiOmniGenerationCapabilityProvider $capabilityProvider,
        private GeminiTransportInterface $transport,
        ?SafeRemoteFileDownloader $remoteFileDownloader = null,
    ) {
        $this->remoteFileDownloader = $remoteFileDownloader ?? new SafeRemoteFileDownloader(new RemoteDownloadSecurityConfig(
            enabled: true,
            level: RemoteDownloadSecurityConfig::LEVEL_STANDARD,
            maxDownloadSize: 100 * 1024 * 1024,
        ));
    }

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        return $this->capabilityProvider->supportsModel($modelVersion, $this->preferModelVersion($modelVersion, $modelId));
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        return $this->capabilityProvider->resolveGenerationConfig($modelVersion, $this->preferModelVersion($modelVersion, $modelId));
    }

    public function resolveHasAudioOutput(string $modelVersion, string $modelId, array $request): bool
    {
        return true;
    }

    /**
     * Builds a Gemini Interactions request from the shared video-generation request format.
     */
    public function buildProviderPayload(VideoQueueOperationEntity $operation): array
    {
        $modelVersion = trim($operation->getModelVersion()) !== '' ? $operation->getModelVersion() : $operation->getModel();
        $modelId = $this->preferModelVersion($modelVersion, $operation->getProviderModelId());
        $model = $this->capabilityProvider->resolveProviderModelName($modelVersion, $modelId);
        $request = $operation->getRawRequest();
        $inputs = $request['inputs'] ?? [];

        if (! is_array($inputs)) {
            throw new InvalidArgumentException('Gemini inputs must be an array.');
        }
        $generation = is_array($request['generation'] ?? null) ? $request['generation'] : [];
        $capability = $this->capabilityProvider->resolveGenerationConfig($modelVersion, $modelId);
        if ($capability === null) {
            throw new InvalidArgumentException('Gemini capability is unavailable.');
        }
        $generationConfig = $capability->toArray()['generation'];
        $mode = $this->normalizeInputMode($request['input_mode'] ?? null);
        $this->validateGeneration($generation, $generationConfig, $mode !== VideoInputMode::VideoEdit->value);
        $this->validateModeInputs($mode, $inputs);
        $normalizedInputs = $this->normalizeMediaInputs($inputs);
        $parts = $this->buildInputParts($normalizedInputs, $request['prompt'] ?? null);
        $responseFormat = $this->buildResponseFormat($generation, $generationConfig, $mode !== VideoInputMode::VideoEdit->value);
        $ignored = $this->ignoredParams($request, $generation);
        if ($mode === VideoInputMode::VideoEdit->value && array_key_exists('duration_seconds', $generation)) {
            $ignored[] = 'generation.duration_seconds';
        }
        $acceptedParams = ['prompt', 'input_mode', 'inputs', 'generation.aspect_ratio', 'generation.resolution'];
        if ($mode !== VideoInputMode::VideoEdit->value) {
            $acceptedParams[] = 'generation.duration_seconds';
        }
        $operation->setAcceptedParams($acceptedParams);
        $operation->setIgnoredParams($ignored);

        $task = match ($mode) {
            VideoInputMode::Standard->value => 'text_to_video',
            VideoInputMode::KeyframeGuided->value => 'image_to_video',
            VideoInputMode::VideoEdit->value => 'edit',
            default => 'reference_to_video',
        };
        if ($mode == VideoInputMode::OmniReference->value && empty($inputs)) {
            $task = 'text_to_video';
        }

        return [
            'model' => $model,
            'input' => $parts,
            'background' => array_key_exists('background', $request) ? (bool) $request['background'] : true,
            'generation_config' => [
                'video_config' => [
                    'task' => $task,
                ],
            ],
            'response_format' => $responseFormat,
        ];
    }

    public function submit(VideoQueueOperationEntity $operation, QueueExecutorConfig $config): string
    {
        $response = $this->transport->createInteraction($config, $operation->getProviderPayload(), ['operation_id' => $operation->getId()]);
        $id = isset($response['id']) && is_string($response['id']) ? trim($response['id']) : '';
        if ($id === '') {
            throw new ProviderVideoException(VideoGenerateErrorCode::GENERAL_ERROR, VideoGenerateErrorCode::GENERAL_ERROR->getMessage());
        }
        return $id;
    }

    public function testConnection(QueueExecutorConfig $config, string $modelVersion): bool
    {
        $payload = [
            'model' => $this->capabilityProvider->resolveProviderModelName($modelVersion),
            'input' => [['type' => 'text', 'text' => 'connectivity-test']],
            'background' => true,
            'response_format' => [
                'type' => 'video',
                'delivery' => 'uri',
                'aspect_ratio' => '16:9',
                'resolution' => '720p',
                'duration' => '0s',
            ],
        ];

        try {
            $this->transport->createInteraction($config, $payload, ['connectivity_test' => true]);
        } catch (ProviderVideoException $exception) {
            if (str_contains((string) $exception->getResponseContent(), self::CONNECTIVITY_SUCCESS_MESSAGE)) {
                return true;
            }

            throw new ProviderVideoException(VideoGenerateErrorCode::INVALID_PARAMETER, $exception->getRequestException()?->getMessage() ?? $exception->getMessage(), $exception->getRequestException());
        }

        throw new ProviderVideoException(VideoGenerateErrorCode::INVALID_PARAMETER, 'Gemini connectivity test did not receive the expected validation error');
    }

    public function query(VideoQueueOperationEntity $operation, QueueExecutorConfig $config, string $providerTaskId): array
    {
        $detail = $this->transport->getInteraction($config, $providerTaskId, ['operation_id' => $operation->getId(), 'provider_task_id' => $providerTaskId]);
        $providerStatus = strtolower(trim((string) ($detail['status'] ?? 'queued')));
        $status = match ($providerStatus) {
            'completed', 'succeeded', 'success' => 'succeeded',
            'failed', 'cancelled', 'canceled', 'expired' => 'failed',
            default => 'processing',
        };
        $videoUrl = '';
        $videoBase64 = '';
        $videoMimeType = 'video/mp4';
        foreach ($detail['steps'] ?? [] as $step) {
            if (($step['type'] ?? '') !== 'model_output') {
                continue;
            }
            foreach ($step['content'] ?? [] as $content) {
                if (($content['type'] ?? '') === 'video') {
                    $videoUrl = trim((string) ($content['uri'] ?? ''));
                    if ($videoUrl !== '') {
                        break 2;
                    }
                    $inlineData = is_array($content['inlineData'] ?? null) ? $content['inlineData'] : [];
                    $videoBase64 = trim((string) ($content['data'] ?? $inlineData['data'] ?? ''));
                    $videoMimeType = trim((string) ($content['mime_type'] ?? $inlineData['mimeType'] ?? $videoMimeType));
                }
            }
        }
        if ($status === 'succeeded' && $videoUrl === '' && $videoBase64 === '') {
            return $this->failedResult($detail, $providerTaskId, VideoGenerateErrorCode::MISSING_VIDEO_DATA);
        }
        if ($videoUrl === '' && $videoBase64 !== '') {
            $detail['response']['videos'][] = ['bytesBase64Encoded' => $videoBase64, 'mimeType' => $videoMimeType];
        }
        $errorCode = ProviderVideoErrorMapper::resolveGemini(null, $detail);
        $result = ['status' => $status, 'provider_result' => $detail, 'output' => $videoUrl === '' ? [] : ['video_url' => $videoUrl, 'provider_task_id' => $providerTaskId], 'error' => null];
        if ($status === 'failed') {
            $result['error'] = ['code' => (string) $errorCode->value, 'message' => $errorCode->getMessage(), 'provider_code' => null];
        }
        return $result;
    }

    private function normalizeInputMode(mixed $mode): string
    {
        $mode = strtolower(trim((string) ($mode ?? VideoInputMode::Standard->value)));
        if (! in_array($mode, self::INPUT_MODES, true)) {
            throw new InvalidArgumentException('Gemini input mode is invalid.');
        }

        return $mode;
    }

    /** @param array<string, mixed> $generationConfig */
    private function validateGeneration(array $generation, array $generationConfig, bool $validateDuration = true): void
    {
        $resolution = strtolower(trim((string) ($generation['resolution'] ?? $generationConfig['default_resolution'])));
        if (! in_array($resolution, $generationConfig['resolutions'], true)) {
            throw new InvalidArgumentException('Gemini resolution is invalid.');
        }

        $aspectRatio = trim((string) ($generation['aspect_ratio'] ?? '16:9'));
        if (! in_array($aspectRatio, $generationConfig['aspect_ratios'], true)) {
            throw new InvalidArgumentException('Gemini aspect ratio is invalid.');
        }

        if ($validateDuration) {
            $duration = (int) ($generation['duration_seconds'] ?? $generationConfig['default_duration_seconds']);
            if (! in_array($duration, array_map('intval', $generationConfig['durations']), true)) {
                throw new InvalidArgumentException('Gemini duration is invalid.');
            }
        }
    }

    /** @param array<string, mixed> $inputs */
    private function validateModeInputs(string $mode, array $inputs): void
    {
        if ($mode === VideoInputMode::Standard->value && $inputs !== []) {
            throw new InvalidArgumentException('Gemini standard mode does not accept media.');
        }
        if ($mode === VideoInputMode::ImageReference->value && (($inputs['reference_images'] ?? []) === [] || ($inputs['frames'] ?? []) !== [] || ($inputs['reference_videos'] ?? []) !== [])) {
            throw new InvalidArgumentException('Gemini image reference mode requires reference images only.');
        }
        if ($mode === VideoInputMode::KeyframeGuided->value && (($inputs['frames'] ?? []) === [] || ($inputs['reference_images'] ?? []) !== [] || ($inputs['reference_videos'] ?? []) !== [])) {
            throw new InvalidArgumentException('Gemini keyframe mode requires frames only.');
        }
        if ($mode === VideoInputMode::VideoEdit->value
            && (count($inputs['reference_videos'] ?? []) !== 1
                || count($inputs['reference_images'] ?? []) > 6
                || ($inputs['frames'] ?? []) !== []
                || ($inputs['reference_audios'] ?? []) !== [])) {
            throw new InvalidArgumentException('Gemini video edit mode requires a reference video.');
        }
        // Omni mode accepts zero or more reference media items, so prompt-only requests stay valid.
    }

    /**
     * Normalizes supported media once; the provider request builder only consumes canonical URIs.
     *
     * @param array<string, mixed> $inputs
     * @return array<string, list<array<string, mixed>>>
     */
    private function normalizeMediaInputs(array $inputs): array
    {
        $normalized = [];
        foreach (self::MEDIA_TYPES as $field => $type) {
            if (! array_key_exists($field, $inputs)) {
                continue;
            }
            if (! is_array($inputs[$field])) {
                throw new InvalidArgumentException('Gemini media input must be an array.');
            }
            $normalized[$field] = array_map(
                fn (mixed $item): array => $this->normalizeMediaItem($field, $type, $item),
                $inputs[$field],
            );
        }

        return $normalized;
    }

    /** @return array<string, mixed> */
    private function normalizeMediaItem(string $field, string $type, mixed $item): array
    {
        if (! is_array($item)) {
            throw new InvalidArgumentException('Gemini media item is invalid.');
        }

        $uri = ReferenceMediaPayload::normalize(
            $item,
            'Gemini ' . $field . ' entry',
            $type === 'video' ? 'video/mp4' : ($type === 'audio' ? 'audio/mpeg' : 'image/png'),
        );
        if (preg_match('#^https?://#i', $uri) === 1) {
            $file = $this->remoteFileDownloader->download($uri);
            $path = $file->getRealPath();
            try {
                $mimeType = trim($file->getMimeType()) ?: ($type === 'video' ? 'video/mp4' : ($type === 'audio' ? 'audio/mpeg' : 'image/png'));
                $uri = 'data:' . $mimeType . ';base64,' . base64_encode((string) file_get_contents($path));
            } finally {
                @unlink($path);
            }
        }
        $normalized = ['uri' => $uri];
        if ($type === 'image' && isset($item['role'])) {
            $role = strtolower(trim((string) $item['role']));
            if ($field === 'frames' && ! in_array($role, ['start', 'end', 'first', 'last'], true)) {
                throw new InvalidArgumentException('Gemini frame role is invalid.');
            }
            $normalized['role'] = $role === 'first' ? 'start' : ($role === 'last' ? 'end' : $role);
        }

        return $normalized;
    }

    /** @param array<string, list<array<string, mixed>>> $inputs */
    private function buildInputParts(array $inputs, mixed $prompt): array
    {
        $parts = [];
        foreach (self::MEDIA_TYPES as $field => $type) {
            foreach ($inputs[$field] ?? [] as $item) {
                $part = ['type' => $type];
                if (preg_match('/^data:(?<mime_type>[^;]+);base64,(?<data>.+)$/s', (string) $item['uri'], $matches) === 1) {
                    $part['data'] = $matches['data'];
                    $part['mime_type'] = $matches['mime_type'];
                } else {
                    $part['uri'] = $item['uri'];
                }
                $parts[] = $part;
            }
        }
        $prompt = trim((string) ($prompt ?? ''));
        if ($prompt !== '') {
            $parts[] = ['type' => 'text', 'text' => $prompt];
        }

        return $parts;
    }

    /** @param array<string, mixed> $generationConfig */
    private function buildResponseFormat(array $generation, array $generationConfig, bool $includeDuration = true): array
    {
        $resolution = strtolower(trim((string) ($generation['resolution'] ?? $generationConfig['default_resolution'])));
        $aspectRatio = trim((string) ($generation['aspect_ratio'] ?? '16:9'));
        $duration = (int) ($generation['duration_seconds'] ?? $generationConfig['default_duration_seconds']);

        $responseFormat = [
            'type' => 'video',
            'delivery' => 'uri',
            'resolution' => $resolution,
        ];
        if ($includeDuration) {
            $responseFormat['duration'] = $duration . 's';
        }
        if ($includeDuration) {
            $responseFormat['aspect_ratio'] = $aspectRatio;
        }

        return $responseFormat;
    }

    /** @param array<string, mixed> $request @param array<string, mixed> $generation */
    private function ignoredParams(array $request, array $generation): array
    {
        $ignored = array_key_exists('generate_audio', $generation) ? ['generation.generate_audio'] : [];
        foreach (array_keys($request) as $field) {
            if (! in_array($field, ['prompt', 'input_mode', 'inputs', 'generation', 'background'], true)) {
                $ignored[] = $field;
            }
        }

        return $ignored;
    }

    private function failedResult(array $detail, string $taskId, VideoGenerateErrorCode $code): array
    {
        return ['status' => 'failed', 'provider_result' => $detail, 'output' => [], 'error' => ['code' => (string) $code->value, 'message' => $code->getMessage(), 'provider_code' => null, 'provider_task_id' => $taskId]];
    }

    private function preferModelVersion(string $modelVersion, string $modelId): string
    {
        $modelVersion = trim($modelVersion);
        $modelId = trim($modelId);
        return $modelVersion !== '' && ctype_digit($modelId) ? '' : $modelId;
    }
}
