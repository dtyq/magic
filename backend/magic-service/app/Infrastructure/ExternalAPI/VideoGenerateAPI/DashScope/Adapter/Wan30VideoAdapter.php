<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Adapter;

use App\Domain\ModelGateway\Contract\VideoGenerationConnectivityTestableInterface;
use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoInputMode;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\ErrorCode\VideoGenerateErrorCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\Capability\Wan30GenerationCapabilityProvider;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope\DashScopeTransportInterface;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoErrorMapper;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ReferenceMediaPayload;
use InvalidArgumentException;

final class Wan30VideoAdapter implements VideoGenerationConnectivityTestableInterface
{
    private const array MEDIA_FIELDS = ['frames', 'reference_images', 'reference_videos', 'reference_audios'];

    private const array GENERATION_FIELDS = ['resolution', 'duration_seconds', 'aspect_ratio', 'enhance_prompt', 'generate_audio', 'seed', 'watermark'];

    private const int SMART_DURATION = -1;

    public function __construct(
        private Wan30GenerationCapabilityProvider $capabilityProvider,
        private DashScopeTransportInterface $transport,
    ) {
    }

    public function supportsModel(string $modelVersion, string $modelId): bool
    {
        return $this->capabilityProvider->supportsModel($modelVersion, $this->preferModelVersion($modelVersion, $modelId));
    }

    public function resolveGenerationConfig(string $modelVersion, string $modelId): ?VideoGenerationConfig
    {
        return $this->capabilityProvider->resolveGenerationConfig($modelVersion, $modelId);
    }

    public function resolveHasAudioOutput(string $modelVersion, string $modelId, array $request): bool
    {
        $models = $this->tryResolveModels($modelVersion, $modelId);
        if ($models === null) {
            return false;
        }

        [$resolvedVersion, $resolvedId] = $models;
        $capability = $this->capabilityProvider->resolveGenerationConfig($resolvedVersion, $resolvedId);
        $generationConfig = $capability?->toArray()['generation'] ?? [];
        if (! (bool) ($generationConfig['supports_generate_audio'] ?? false)) {
            return false;
        }

        $generation = is_array($request['generation'] ?? null) ? $request['generation'] : [];
        return (bool) ($generation['generate_audio'] ?? true);
    }

    /**
     * Builds the DashScope request while keeping accepted and ignored request fields for operation auditing.
     */
    public function buildProviderPayload(VideoQueueOperationEntity $operation): array
    {
        $request = $operation->getRawRequest();
        $generation = is_array($request['generation'] ?? null) ? $request['generation'] : [];
        $rawInputs = is_array($request['inputs'] ?? null) ? $request['inputs'] : [];
        [$modelVersion, $modelId] = $this->resolveOperationModels($operation);
        $model = $this->capabilityProvider->resolveProviderModelName($modelVersion, $modelId);
        $capability = $this->capabilityProvider->resolveGenerationConfig($modelVersion, $modelId);
        if ($capability === null) {
            throw new InvalidArgumentException('Wan 3.x capability is unavailable.');
        }
        $capabilityData = $capability->toArray();
        $inputMode = $this->normalizeInputMode($request['input_mode'] ?? null);
        $generationConfig = $capabilityData['generation'];
        $inputModeConfig = $capabilityData['input_modes'][$inputMode];
        $constraints = $capabilityData['constraints'];
        $isVideoEdit = $inputMode === VideoInputMode::VideoEdit->value;
        $includeDuration = ! $isVideoEdit;
        $this->validateGeneration($generation, $generationConfig, $includeDuration);
        $inputs = $this->normalizeMediaInputs($rawInputs);

        $input = ['prompt' => (string) ($request['prompt'] ?? '')];
        $acceptedParams = ['prompt', 'input_mode'];
        if ($includeDuration) {
            $acceptedParams[] = 'generation.duration_seconds';
        }
        $ignoredParams = [];
        if (! $includeDuration && array_key_exists('duration_seconds', $generation)) {
            $ignoredParams[] = 'generation.duration_seconds';
        }

        // Each mode owns its media rules; an empty media list is valid for text-only modes.
        $media = match ($inputMode) {
            VideoInputMode::Standard->value => $this->buildStandardMedia($inputs),
            VideoInputMode::ImageReference->value => $this->buildImageReferenceMedia($inputs, $acceptedParams),
            VideoInputMode::KeyframeGuided->value => $this->buildKeyframeMedia($inputs, $acceptedParams, $inputModeConfig),
            VideoInputMode::OmniReference->value => $this->buildOmniMedia($inputs, $acceptedParams, $inputModeConfig, $constraints),
            VideoInputMode::VideoEdit->value => $this->buildVideoEditMedia($inputs, $acceptedParams),
            default => throw new InvalidArgumentException('Unsupported Wan 3.x input mode.'),
        };
        if ($media !== []) {
            $input['media'] = $media;
        }

        $parameters = $this->buildGenerationParameters($generation, $generationConfig, $acceptedParams, $ignoredParams, $includeDuration);
        if ($inputMode === VideoInputMode::VideoEdit->value) {
            $parameters['duration'] = self::SMART_DURATION;
        }
        $this->markIgnoredParams($request, $rawInputs, $inputs, $acceptedParams, $ignoredParams);

        $operation->setAcceptedParams(array_values(array_unique($acceptedParams)));
        $operation->setIgnoredParams(array_values(array_unique($ignoredParams)));
        return ['model' => $model, 'input' => $input, 'parameters' => $parameters];
    }

    public function submit(VideoQueueOperationEntity $operation, QueueExecutorConfig $config): string
    {
        $response = $this->transport->submitVideo($config, $operation->getProviderPayload(), $this->buildLogContext($operation));
        $taskId = $this->firstString($response['output']['task_id'] ?? null, $response['task_id'] ?? null);
        if ($taskId === null) {
            throw new ProviderVideoException(VideoGenerateErrorCode::GENERAL_ERROR, VideoGenerateErrorCode::GENERAL_ERROR->getMessage());
        }
        return $taskId;
    }

    public function testConnection(QueueExecutorConfig $config, string $modelVersion): bool
    {
        try {
            $response = $this->transport->submitVideo($config, [
                'model' => $this->capabilityProvider->resolveProviderModelName($modelVersion) . '11',
                'input' => ['prompt' => 'connectivity-test'],
                'parameters' => ['resolution' => '720P', 'duration' => 0],
            ], ['connectivity_test' => true]);
        } catch (ProviderVideoException $throwable) {
            if (str_contains($throwable->getMessage(), '请求参数不合法，请检查后重试')) {
                return true;
            }
            throw $throwable;
        }

        $taskId = $this->firstString($response['output']['task_id'] ?? null, $response['task_id'] ?? null);
        if ($taskId === null) {
            throw new ProviderVideoException(VideoGenerateErrorCode::INVALID_PARAMETER, 'Wan connectivity test task id missing');
        }

        $message = 'Wan connectivity test failed';
        for ($attempt = 0; $attempt < 20; ++$attempt) {
            $detail = $this->transport->queryTask($config, $taskId, ['connectivity_test' => true, 'provider_task_id' => $taskId]);
            $output = is_array($detail['output'] ?? null) ? $detail['output'] : [];
            $code = (string) ($output['code'] ?? $detail['code'] ?? '');
            $message = (string) ($output['message'] ?? $detail['message'] ?? $message);
            if ($code === 'InvalidParameter' && str_contains($message, 'duration must be')) {
                return true;
            }
            if ($attempt < 19) {
                sleep(3);
            }
        }

        throw new ProviderVideoException(VideoGenerateErrorCode::INVALID_PARAMETER, $message);
    }

    public function query(VideoQueueOperationEntity $operation, QueueExecutorConfig $config, string $providerTaskId): array
    {
        $detail = $this->transport->queryTask($config, $providerTaskId, $this->buildLogContext($operation, $providerTaskId));
        $output = is_array($detail['output'] ?? null) ? $detail['output'] : [];
        $providerStatus = strtoupper(trim((string) ($output['task_status'] ?? 'PENDING')));
        $status = match ($providerStatus) {
            'SUCCEEDED' => 'succeeded',
            'FAILED', 'CANCELED', 'UNKNOWN' => 'failed',
            default => 'processing',
        };
        $videoUrl = $this->firstString($output['video_url'] ?? null);
        if ($status === 'succeeded' && $videoUrl === null) {
            return $this->failedQueryResult($detail, VideoGenerateErrorCode::MISSING_VIDEO_DATA, $providerTaskId);
        }
        $errorCode = ProviderVideoErrorMapper::resolveDashScope(null, $detail);
        return [
            'status' => $status,
            'provider_result' => $detail,
            'output' => $videoUrl === null ? [] : [
                'video_url' => $videoUrl,
                'provider_task_id' => $providerTaskId,
                'provider_base_url' => rtrim($config->getBaseUrl(), '/'),
            ],
            'error' => $status !== 'failed' ? null : [
                'code' => (string) $errorCode->value,
                'message' => $errorCode->getMessage(),
            ],
        ];
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

    private function firstString(mixed ...$values): ?string
    {
        foreach ($values as $value) {
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        return null;
    }

    /**
     * Maps request generation options to DashScope parameters and records unsupported options.
     *
     * @param array<string, mixed> $generation
     * @param array<string, mixed> $generationConfig
     * @param list<string> $acceptedParams
     * @param list<string> $ignoredParams
     * @return array<string, mixed>
     */
    private function buildGenerationParameters(array $generation, array $generationConfig, array &$acceptedParams, array &$ignoredParams, bool $includeDuration = true): array
    {
        $parameters = [
            'resolution' => strtoupper($this->normalizeResolution($generation['resolution'] ?? ($generationConfig['default_resolution'] ?? '720p'))),
        ];
        if ($includeDuration) {
            $parameters['duration'] = (int) ($generation['duration_seconds'] ?? ($generationConfig['default_duration_seconds'] ?? 5));
        }
        $providerFields = [
            'aspect_ratio' => 'ratio',
            'enhance_prompt' => 'prompt_extend',
            'generate_audio' => 'audio',
            'seed' => 'seed',
            'watermark' => 'watermark',
        ];
        $supportFlags = [
            'enhance_prompt' => 'supports_enhance_prompt',
            'generate_audio' => 'supports_generate_audio',
            'seed' => 'supports_seed',
            'watermark' => 'supports_watermark',
        ];

        foreach ($providerFields as $requestField => $providerField) {
            if (! array_key_exists($requestField, $generation)) {
                continue;
            }
            if (isset($supportFlags[$requestField]) && ! $generationConfig[$supportFlags[$requestField]]) {
                $ignoredParams[] = 'generation.' . $requestField;
                continue;
            }

            $parameters[$providerField] = match ($requestField) {
                'enhance_prompt', 'generate_audio', 'watermark' => (bool) $generation[$requestField],
                'seed' => (int) $generation[$requestField],
                default => (string) $generation[$requestField],
            };
            $acceptedParams[] = 'generation.' . $requestField;
        }

        $acceptedParams[] = 'generation.resolution';
        foreach (array_keys($generation) as $field) {
            if (! in_array($field, self::GENERATION_FIELDS, true)) {
                $ignoredParams[] = 'generation.' . $field;
            }
        }

        return $parameters;
    }

    private function failedQueryResult(array $detail, VideoGenerateErrorCode $errorCode, string $providerTaskId): array
    {
        return [
            'status' => 'failed',
            'provider_result' => $detail,
            'output' => [],
            'error' => [
                'code' => (string) $errorCode->value,
                'message' => $errorCode->getMessage(),
                'provider_task_id' => $providerTaskId,
            ],
        ];
    }

    /**
     * Records request fields intentionally ignored by the provider adapter for auditability.
     *
     * @param array<string, mixed> $request
     * @param array<string, mixed> $rawInputs
     * @param array<string, list<array<string, mixed>>> $inputs
     * @param list<string> $acceptedParams
     * @param list<string> $ignoredParams
     */
    private function markIgnoredParams(array $request, array $rawInputs, array $inputs, array $acceptedParams, array &$ignoredParams): void
    {
        foreach (self::MEDIA_FIELDS as $field) {
            if ($this->hasItems($inputs, $field) && ! in_array('inputs.' . $field, $acceptedParams, true)) {
                $ignoredParams[] = 'inputs.' . $field;
            }
        }
        if (array_key_exists('task', $request)) {
            $ignoredParams[] = 'task';
        }
        foreach (array_keys($request) as $field) {
            if (! in_array($field, ['prompt', 'input_mode', 'inputs', 'generation', 'task'], true)) {
                $ignoredParams[] = $field;
            }
        }
        foreach (array_keys($rawInputs) as $field) {
            if (! in_array($field, self::MEDIA_FIELDS, true)) {
                $ignoredParams[] = 'inputs.' . $field;
            }
        }
    }

    private function resolveOperationModels(VideoQueueOperationEntity $operation): array
    {
        $version = trim($operation->getModelVersion()) !== '' ? $operation->getModelVersion() : $operation->getModel();
        $id = $operation->getProviderModelId();
        $models = $this->tryResolveModels($version, $id);
        if ($models === null) {
            throw new InvalidArgumentException('Unsupported or conflicting Wan 3.x model identifiers.');
        }
        return $models;
    }

    /** @return null|array{0: string, 1: string} */
    private function tryResolveModels(string $version, string $id): ?array
    {
        $id = $this->preferModelVersion($version, $id);
        if ($this->supportsModel($version, $id)) {
            return [$version, $id];
        }
        if ($this->supportsModel($version, '')) {
            return $this->supportsModel('', $id) ? null : [$version, ''];
        }
        return null;
    }

    private function preferModelVersion(string $modelVersion, string $modelId): string
    {
        $modelVersion = trim($modelVersion);
        $modelId = trim($modelId);

        // Persisted provider IDs can be numeric; keep the explicit Wan model version in that case.
        return $modelVersion !== '' && ctype_digit($modelId) ? '' : $modelId;
    }

    /**
     * Validates generation options against the capability schema published by Wan 3.x.
     */
    private function validateGeneration(array $generation, array $capability, bool $validateDuration = true): void
    {
        $resolution = $this->normalizeResolution($generation['resolution'] ?? ($capability['default_resolution'] ?? '720p'));
        if (! in_array($resolution, $capability['resolutions'], true)) {
            throw new InvalidArgumentException('Wan 3.x resolution is invalid.');
        }

        if ($validateDuration) {
            $duration = (int) ($generation['duration_seconds'] ?? ($capability['default_duration_seconds'] ?? 5));
            $durationConfig = $capability['durations'];
            if ($duration < $durationConfig['min'] || $duration > $durationConfig['max']
                || ($duration - $durationConfig['min']) % $durationConfig['step'] !== 0) {
                throw new InvalidArgumentException('Wan 3.x duration is invalid.');
            }
        }

        if (array_key_exists('aspect_ratio', $generation) && ! in_array((string) $generation['aspect_ratio'], $capability['aspect_ratios'], true)) {
            throw new InvalidArgumentException('Wan 3.x aspect ratio is invalid.');
        }
    }

    private function buildStandardMedia(array $inputs): array
    {
        foreach (self::MEDIA_FIELDS as $field) {
            if ($this->hasItems($inputs, $field)) {
                throw new InvalidArgumentException('Wan 3.x standard mode does not accept reference media.');
            }
        }
        return [];
    }

    /**
     * Reference images stay reference media: only keyframe mode may claim first/last frame semantics.
     */
    private function buildImageReferenceMedia(array $inputs, array &$accepted): array
    {
        $images = $inputs['reference_images'] ?? [];
        if (count($images) !== 1 || $this->hasItems($inputs, 'frames') || $this->hasItems($inputs, 'reference_videos') || $this->hasItems($inputs, 'reference_audios')) {
            throw new InvalidArgumentException('Wan 3.x image reference mode requires exactly one image.');
        }
        $accepted[] = 'inputs.reference_images';
        return [['type' => 'reference_image', 'url' => $images[0]['uri']]];
    }

    /**
     * Keyframe mode is the only mode that maps request frames to first_frame / last_frame media.
     */
    private function buildKeyframeMedia(array $inputs, array &$accepted, array $capability): array
    {
        if ($this->hasItems($inputs, 'reference_images') || $this->hasItems($inputs, 'reference_videos') || $this->hasItems($inputs, 'reference_audios')) {
            throw new InvalidArgumentException('Wan 3.x keyframe mode does not accept reference media.');
        }
        $frames = $inputs['frames'] ?? [];
        $roles = $capability['frame_roles'];
        $aliases = $capability['role_aliases'];
        $byRole = [];
        foreach ($frames as $frame) {
            $rawRole = strtolower(trim((string) ($frame['role'] ?? '')));
            $role = is_string($aliases[$rawRole] ?? null) ? strtolower(trim($aliases[$rawRole])) : $rawRole;
            if (! in_array($role, $roles, true)) {
                throw new InvalidArgumentException('Wan 3.x keyframe mode contains an unknown frame role.');
            }
            if (isset($byRole[$role])) {
                throw new InvalidArgumentException('Wan 3.x keyframe mode contains duplicate frame roles.');
            }
            $byRole[$role] = $frame['uri'];
        }
        foreach ($roles as $role) {
            if (($capability['limits'][$role]['min'] ?? 0) > 0 && ! isset($byRole[$role])) {
                throw new InvalidArgumentException('Wan 3.x keyframe mode requires a ' . $role . ' frame.');
            }
        }
        $media = [];
        foreach ($roles as $role) {
            if (! isset($byRole[$role])) {
                continue;
            }
            $accepted[] = 'inputs.frames.' . $role;
            $media[] = ['type' => $role === 'start' ? 'first_frame' : 'last_frame', 'url' => $byRole[$role]];
        }
        return $media;
    }

    /**
     * Applies Omni media limits only when media is supplied; text-only Omni requests remain valid.
     */
    private function buildOmniMedia(array $inputs, array &$accepted, array $capability, array $constraints): array
    {
        if ($this->hasItems($inputs, 'frames')) {
            throw new InvalidArgumentException('Wan 3.x omni reference mode does not accept keyframes.');
        }
        $images = $inputs['reference_images'] ?? [];
        $videos = $inputs['reference_videos'] ?? [];
        $audios = $inputs['reference_audios'] ?? [];
        if ($images === [] && $videos === [] && $audios === []) {
            // Omni mode also supports text-only generation; media is optional, not a fallback to standard mode.
            return [];
        }
        $variantLimits = array_column($capability['variants'], 'limits', 'code');
        if (count($images) + count($videos) + count($audios) > $capability['max_count']
            || count($images) > $variantLimits['reference_image']['count']['max']
            || count($videos) > $variantLimits['reference_video']['count']['max']
            || count($audios) > $variantLimits['reference_audio']['count']['max']) {
            throw new InvalidArgumentException('Wan 3.x omni reference media limit exceeded.');
        }
        $videoItemLimit = $variantLimits['reference_video']['duration_seconds']['max'];
        foreach ($videos as $item) {
            if ((int) ($item['duration_seconds'] ?? 0) > $videoItemLimit) {
                throw new InvalidArgumentException('Wan 3.x reference media duration limit exceeded.');
            }
        }
        $audioItemLimit = $variantLimits['reference_audio']['duration_seconds']['max'];
        foreach ($audios as $item) {
            if ((int) ($item['duration_seconds'] ?? 0) > $audioItemLimit) {
                throw new InvalidArgumentException('Wan 3.x reference media duration limit exceeded.');
            }
        }
        $videoDuration = array_sum(array_map(static fn (array $item): int => (int) ($item['duration_seconds'] ?? 0), $videos));
        $audioDuration = array_sum(array_map(static fn (array $item): int => (int) ($item['duration_seconds'] ?? 0), $audios));
        if ($videoDuration > $variantLimits['reference_video']['total_duration_seconds']['max']
            || $audioDuration > $variantLimits['reference_audio']['total_duration_seconds']['max']
            || $videoDuration + $audioDuration > $constraints['reference_media']['max_total_duration_seconds']) {
            throw new InvalidArgumentException('Wan 3.x reference media total duration limit exceeded.');
        }
        $accepted = array_merge($accepted, ['inputs.reference_images', 'inputs.reference_videos', 'inputs.reference_audios']);
        return array_merge(
            $this->typedMedia($images, 'reference_image'),
            $this->typedMedia($videos, 'reference_video'),
            $this->typedMedia($audios, 'reference_audio'),
        );
    }

    private function buildVideoEditMedia(array $inputs, array &$accepted): array
    {
        $videos = $inputs['reference_videos'] ?? [];
        $images = $inputs['reference_images'] ?? [];
        $audios = $inputs['reference_audios'] ?? [];
        if (count($videos) !== 1 || count($images) > 10 || count($audios) > 5 || $this->hasItems($inputs, 'frames')) {
            throw new InvalidArgumentException('Wan 3.x video edit mode requires one reference video, up to ten reference images, and up to five reference audios.');
        }
        $accepted = array_merge($accepted, ['inputs.reference_images', 'inputs.reference_videos', 'inputs.reference_audios']);
        return array_merge(
            $this->typedMedia($images, 'reference_image'),
            $this->typedMedia($audios, 'reference_audio'),
            [['type' => 'reference_video', 'url' => $videos[0]['uri']]],
        );
    }

    private function typedMedia(array $items, string $type): array
    {
        return array_map(static fn (array $item): array => ['type' => $type, 'url' => $item['uri']], $items);
    }

    private function mediaItems(array $inputs, string $field): array
    {
        if (! array_key_exists($field, $inputs)) {
            return [];
        }
        $value = $inputs[$field];
        if (! is_array($value)) {
            throw new InvalidArgumentException('Wan 3.x media field must be an array.');
        }
        $items = [];
        $uris = [];
        $defaultMimeType = match ($field) {
            'reference_videos' => 'video/mp4',
            'reference_audios' => 'audio/mpeg',
            default => 'image/png',
        };
        foreach ($value as $item) {
            if (! is_array($item)) {
                throw new InvalidArgumentException('Wan 3.x media entry is invalid.');
            }
            $uri = ReferenceMediaPayload::normalize($item, 'Wan 3.x ' . $field . ' entry', $defaultMimeType);
            if (isset($uris[$uri])) {
                throw new InvalidArgumentException('Wan 3.x media entries must be unique.');
            }
            $uris[$uri] = true;
            $item['uri'] = $uri;
            $items[] = $item;
        }
        return $items;
    }

    /**
     * Normalizes each supported media field once so mode builders only consume canonical URIs.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    private function normalizeMediaInputs(array $inputs): array
    {
        $normalized = [];
        foreach (self::MEDIA_FIELDS as $field) {
            if (array_key_exists($field, $inputs)) {
                $normalized[$field] = $this->mediaItems($inputs, $field);
            }
        }

        return $normalized;
    }

    private function hasItems(array $inputs, string $field): bool
    {
        return ! empty($inputs[$field]);
    }

    private function normalizeInputMode(mixed $mode): string
    {
        $mode = is_string($mode) ? trim($mode) : '';
        if ($mode === '') {
            return VideoInputMode::Standard->value;
        }
        if (! VideoInputMode::isRequestValid($mode)) {
            throw new InvalidArgumentException('Wan 3.x input mode is invalid.');
        }
        return $mode;
    }

    private function normalizeResolution(mixed $value): string
    {
        return strtolower(trim((string) ($value ?? '720p')));
    }
}
