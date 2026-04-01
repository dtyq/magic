<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\Dto\CreateVideoDTO;
use App\Domain\ModelGateway\Entity\Dto\VideoOperationErrorDTO;
use App\Domain\ModelGateway\Entity\Dto\VideoOperationQueueDTO;
use App\Domain\ModelGateway\Entity\Dto\VideoOperationResponseDTO;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\VideoExecutionSyncResult;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGatewayEndpoint;
use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationConfig;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use App\Domain\ModelGateway\Entity\VideoQueueOperationEntity;
use App\Domain\ModelGateway\Repository\VideoQueueOperationRepositoryInterface;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use RuntimeException;

/**
 * 视频队列领域服务。
 *
 * 统一视频参数设计落地后，这里不再自己拦 provider/model 的参数支持性，
 * 只消费外部传入的 VideoGenerationConfig 并执行领域规则：
 * - 规范化请求
 * - 基础结构 / 类型校验
 * - 创建 / 更新视频任务实体
 */
readonly class VideoQueueDomainService
{
    private const string TASK_GENERATE = 'generate';

    private const string TASK_EXTEND = 'extend';

    private const string TASK_EDIT = 'edit';

    private const string TASK_UPSCALE = 'upscale';

    private const array SUPPORTED_TASKS = [
        self::TASK_GENERATE,
        self::TASK_EXTEND,
        self::TASK_EDIT,
        self::TASK_UPSCALE,
    ];

    private const string AUDIO_ROLE_REFERENCE = 'reference';

    private const array SERVICE_TIERS = ['default', 'flex'];

    private const string RESULT_STATUS_PROCESSING = 'processing';

    private const string RESULT_STATUS_SUCCEEDED = 'succeeded';

    private const string RESULT_STATUS_FAILED = 'failed';

    private const string PUBLIC_STATUS_QUEUED = 'queued';

    private const string PUBLIC_STATUS_RUNNING = 'running';

    private const string PUBLIC_STATUS_CANCELED = 'canceled';

    private const string ERROR_MESSAGE_FAILED = 'video generation failed';

    private const string ERROR_MESSAGE_TIMEOUT = 'video generation timeout';

    private const string KELING_MODEL_ID = 'keling-3.0-video';

    /**
     * @var array<string, string>
     */
    private const array ASPECT_RATIO_ALIASES = [
        '16:9' => '16:9',
        '16/9' => '16:9',
        '16x9' => '16:9',
        '9:16' => '9:16',
        '9/16' => '9:16',
        '9x16' => '9:16',
        '1:1' => '1:1',
        '1/1' => '1:1',
        '1x1' => '1:1',
    ];

    /**
     * @var array<string, string>
     */
    private const array KELING_MODE_TO_RESOLUTION = [
        'std' => '720p',
        'pro' => '1080p',
    ];

    /**
     * @var array<string, string>
     */
    private const array KELING_RESOLUTION_TO_MODE = [
        '720p' => 'std',
        '1080p' => 'pro',
    ];

    /**
     * @var array<string, string>
     */
    private const array KELING_DIMENSIONS_TO_RESOLUTION = [
        '720x1280' => '720p',
        '1280x720' => '720p',
        '1080x1920' => '1080p',
        '1920x1080' => '1080p',
    ];

    /**
     * @var array<string, int>
     */
    private const array RESOLUTION_SCORES = [
        '480p' => 480,
        '720p' => 720,
        '1080p' => 1080,
        '4k' => 2160,
    ];

    public function __construct(
        private VideoQueueOperationRepositoryInterface $videoQueueOperationRepository,
    ) {
    }

    public function createOperation(
        ModelGatewayDataIsolation $dataIsolation,
        string $modelVersion,
        string $providerModelId,
        ProviderCode $providerCode,
        CreateVideoDTO $requestDTO,
        VideoGenerationConfig $videoGenerationConfig,
    ): VideoQueueOperationEntity {
        $now = date(DATE_ATOM);
        // 统一在创建任务时完成请求规范化，
        // provider 参数支持性过滤统一放到 adapter / client 层。
        $normalizedRequest = $this->normalizeRequest($requestDTO, $providerCode, $videoGenerationConfig);

        return new VideoQueueOperationEntity(
            id: IdGenerator::getUuid(),
            endpoint: VideoGatewayEndpoint::fromModel($requestDTO->getModel()),
            model: $requestDTO->getModel(),
            modelVersion: $modelVersion,
            providerModelId: $providerModelId,
            providerCode: $providerCode->value,
            providerName: strtolower($providerCode->name),
            organizationCode: $dataIsolation->getCurrentOrganizationCode(),
            userId: $dataIsolation->getCurrentUserId(),
            status: VideoOperationStatus::QUEUED,
            seq: 0,
            projectId: $requestDTO->getProjectId(),
            topicId: $requestDTO->getTopicId(),
            taskId: $requestDTO->getTaskId(),
            sourceId: $requestDTO->getSourceId(),
            rawRequest: $normalizedRequest,
            providerPayload: [],
            output: [],
            acceptedParams: [],
            ignoredParams: [],
            createdAt: $now,
            heartbeatAt: $now,
        );
    }

    public function getOperation(string $operationId, string $organizationCode, string $userId): VideoQueueOperationEntity
    {
        $operation = $this->videoQueueOperationRepository->getOperation($operationId);
        if (! $operation || $operation->getOrganizationCode() !== $organizationCode || $operation->getUserId() !== $userId) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'video task not found');
        }

        return $operation;
    }

    public function syncWithExecutionResult(VideoQueueOperationEntity $operation, string $providerTaskId, array $result): VideoExecutionSyncResult
    {
        $previousStatus = $operation->getStatus();
        $operation->setProviderTaskId($providerTaskId);
        if ($operation->getStartedAt() === null) {
            $operation->setStartedAt(date(DATE_ATOM));
        }
        $operation->setHeartbeatAt(date(DATE_ATOM));
        $providerResult = $result['provider_result'] ?? null;
        if (is_array($providerResult)) {
            $operation->setProviderResult($providerResult);
        }

        match ((string) ($result['status'] ?? self::RESULT_STATUS_PROCESSING)) {
            self::RESULT_STATUS_SUCCEEDED => $this->finishSucceeded($operation, $result),
            self::RESULT_STATUS_FAILED => $this->finishFailed($operation, $result),
            default => $this->markProviderProcessing($operation),
        };

        return new VideoExecutionSyncResult(
            $previousStatus !== $operation->getStatus(),
            $previousStatus !== VideoOperationStatus::SUCCEEDED && $operation->getStatus() === VideoOperationStatus::SUCCEEDED,
            $operation->getStatus(),
        );
    }

    public function finishProviderTimeout(VideoQueueOperationEntity $operation): void
    {
        $this->finish(
            $operation,
            VideoOperationStatus::FAILED,
            [],
            'PROVIDER_TIMEOUT',
            self::ERROR_MESSAGE_TIMEOUT,
        );
    }

    public function finishExecutionFailure(VideoQueueOperationEntity $operation, string $message): void
    {
        $this->finish(
            $operation,
            VideoOperationStatus::FAILED,
            [],
            'EXECUTION_FAILED',
            $this->resolvePublicErrorMessage($message),
        );
    }

    public function markProviderRunning(VideoQueueOperationEntity $operation, string $providerTaskId): void
    {
        $now = date(DATE_ATOM);
        $operation->setStatus(VideoOperationStatus::PROVIDER_RUNNING);
        $operation->setProviderTaskId($providerTaskId);
        if ($operation->getStartedAt() === null) {
            $operation->setStartedAt($now);
        }
        $operation->setHeartbeatAt($now);
    }

    public function saveOperation(VideoQueueOperationEntity $operation): void
    {
        $this->videoQueueOperationRepository->saveOperation($operation, $this->operationTtlSeconds());
    }

    public function buildDirectQueueSnapshot(): array
    {
        return [
            'queue_position' => null,
            'same_user_ahead_count' => 0,
            'endpoint_total_ahead_count' => 0,
            'running_count' => 0,
        ];
    }

    public function buildOperationResponse(VideoQueueOperationEntity $operation, array $snapshot): VideoOperationResponseDTO
    {
        $response = new VideoOperationResponseDTO();
        $response->setId($operation->getId());
        $response->setObject('video.generation');
        $response->setModelId($operation->getModel());
        $response->setStatus($this->mapPublicStatus($operation));
        $response->setCreatedAt($operation->getCreatedAt());
        $response->setUpdatedAt($this->resolveUpdateTime($operation));
        $response->setRequest($operation->getRawRequest());
        $response->setQueue($this->buildOperationQueue($snapshot));
        $response->setOutput($operation->getOutput());
        $response->setError($this->buildOperationError($operation));
        $response->setProviderResult($operation->getProviderResult());

        return $response;
    }

    public function maxConcurrency(): int
    {
        return max(1, (int) config('model_gateway.video_queue.max_concurrency', 1));
    }

    public function operationTtlSeconds(): int
    {
        return max(600, (int) config('model_gateway.video_queue.operation_ttl_seconds', 72 * 3600));
    }

    public function lockExpireSeconds(): int
    {
        return max(5, (int) config('model_gateway.video_queue.lock_expire_seconds', 30));
    }

    private function normalizeRequest(
        CreateVideoDTO $requestDTO,
        ProviderCode $providerCode,
        VideoGenerationConfig $videoGenerationConfig
    ): array {
        // DTO 到 canonical request 的映射统一收口在这里，
        // 方便后续校验与 provider payload 转换共享同一套结构。
        return $this->normalizeCanonicalRequest([
            'model_id' => $requestDTO->getModel(),
            'task' => $requestDTO->getTask(),
            'prompt' => $requestDTO->getPrompt(),
            'inputs' => $requestDTO->getInputs(),
            'generation' => $requestDTO->getGeneration(),
            'callbacks' => $requestDTO->getCallbacks(),
            'execution' => $requestDTO->getExecution(),
            'extensions' => $requestDTO->getExtensions(),
        ], $providerCode, $videoGenerationConfig);
    }

    private function normalizeCanonicalRequest(
        array $requestData,
        ProviderCode $providerCode,
        VideoGenerationConfig $videoGenerationConfig
    ): array {
        // 先把输入清洗成稳定结构。
        $frames = [];
        foreach ($requestData['inputs']['frames'] ?? [] as $frame) {
            $role = trim((string) ($frame['role'] ?? ''));
            $uri = trim((string) ($frame['uri'] ?? ''));
            if ($role !== '' && $uri !== '') {
                $frames[] = [
                    'role' => $role,
                    'uri' => $uri,
                ];
            }
        }

        $referenceImages = [];
        foreach ($requestData['inputs']['reference_images'] ?? [] as $referenceImage) {
            $uri = trim((string) ($referenceImage['uri'] ?? ''));
            if ($uri === '') {
                continue;
            }

            $item = ['uri' => $uri];
            $type = $this->normalizeReferenceImageType($referenceImage['type'] ?? null);
            if ($type !== '') {
                $item['type'] = $type;
            }
            $referenceImages[] = $item;
        }

        $videoInput = $this->normalizeMediaInput($requestData['inputs']['video'] ?? null, 'inputs.video');
        $maskInput = $this->normalizeMediaInput($requestData['inputs']['mask'] ?? null, 'inputs.mask');
        $audioInputs = $this->normalizeAudioInputs($requestData['inputs']['audio'] ?? []);

        $generation = array_filter([
            'size' => $this->normalizeGenerationSize($requestData['generation']['size'] ?? null),
            'width' => $this->normalizePositiveInt($requestData['generation']['width'] ?? null),
            'height' => $this->normalizePositiveInt($requestData['generation']['height'] ?? null),
            'mode' => $this->normalizeOptionalString($requestData['generation']['mode'] ?? null),
            'aspect_ratio' => $this->normalizeAspectRatio($requestData['generation']['aspect_ratio'] ?? null),
            'duration_seconds' => $this->normalizeNullableInt($requestData['generation']['duration_seconds'] ?? null),
            'resolution' => $this->normalizeResolution($requestData['generation']['resolution'] ?? null),
            'fps' => $this->normalizePositiveInt($requestData['generation']['fps'] ?? null),
            'seed' => $this->normalizeNullableInt($requestData['generation']['seed'] ?? null),
            'watermark' => $this->normalizeOptionalBool($requestData['generation']['watermark'] ?? null, 'generation.watermark'),
            'negative_prompt' => $this->normalizeOptionalString($requestData['generation']['negative_prompt'] ?? null),
            'generate_audio' => $this->normalizeOptionalBool($requestData['generation']['generate_audio'] ?? null, 'generation.generate_audio'),
            'person_generation' => $this->normalizeOptionalString($requestData['generation']['person_generation'] ?? null),
            'enhance_prompt' => $this->normalizeOptionalBool($requestData['generation']['enhance_prompt'] ?? null, 'generation.enhance_prompt'),
            'compression_quality' => $this->normalizeOptionalString($requestData['generation']['compression_quality'] ?? null),
            'resize_mode' => $this->normalizeOptionalString($requestData['generation']['resize_mode'] ?? null),
            'sample_count' => $this->normalizeNullableInt($requestData['generation']['sample_count'] ?? null),
            'camera_fixed' => $this->normalizeOptionalBool($requestData['generation']['camera_fixed'] ?? null, 'generation.camera_fixed'),
            'return_last_frame' => $this->normalizeOptionalBool($requestData['generation']['return_last_frame'] ?? null, 'generation.return_last_frame'),
        ], static fn (mixed $value): bool => $value !== null && $value !== '');
        $generation = $this->normalizeProviderSpecificGeneration(
            $generation,
            $providerCode,
            (string) ($requestData['model_id'] ?? ''),
        );
        $generation = $this->applyGenerationDefaults($generation, $videoGenerationConfig);
        $generation = $this->applyGenerationConstraints($generation, $referenceImages, $videoGenerationConfig);
        $generation = $this->applyGenerationSupportRules($generation, $videoGenerationConfig);

        $callbacks = array_filter([
            'webhook_url' => $this->normalizeOptionalString($requestData['callbacks']['webhook_url'] ?? null),
        ], static fn (mixed $value): bool => $value !== null && $value !== '');

        $execution = array_filter([
            'service_tier' => $this->normalizeServiceTier($requestData['execution']['service_tier'] ?? null),
            'expires_after_seconds' => $this->normalizePositiveInt($requestData['execution']['expires_after_seconds'] ?? null),
        ], static fn (mixed $value): bool => $value !== null && $value !== '');

        $task = $this->normalizeTask($requestData['task'] ?? null);
        $extensions = [];
        $this->assertTaskRequirements($task, $videoInput);
        $this->assertCapability($task, $maskInput, $audioInputs, $extensions);
        $maskInput = [];
        $audioInputs = [];

        return [
            'model_id' => (string) ($requestData['model_id'] ?? ''),
            'task' => $task,
            'prompt' => (string) ($requestData['prompt'] ?? ''),
            'inputs' => array_filter([
                'frames' => $frames,
                'reference_images' => $referenceImages,
                'video' => $videoInput,
                'mask' => $maskInput,
                'audio' => $audioInputs,
            ], static fn (mixed $value): bool => $value !== []),
            'generation' => $generation,
            'callbacks' => $callbacks,
            'execution' => $execution,
            'extensions' => $extensions,
        ];
    }

    private function normalizeProviderSpecificGeneration(array $generation, ProviderCode $providerCode, string $modelId): array
    {
        if ($providerCode !== ProviderCode::Cloudsway || strtolower(trim($modelId)) !== self::KELING_MODEL_ID) {
            return $generation;
        }

        return $this->normalizeKelingGeneration($generation);
    }

    private function normalizeKelingGeneration(array $generation): array
    {
        $mode = $this->normalizeKelingMode($generation['mode'] ?? null);
        if ($mode !== null) {
            $generation['resolution'] = self::KELING_MODE_TO_RESOLUTION[$mode];
            unset($generation['mode']);

            return $generation;
        }

        $resolution = $this->normalizeOptionalString($generation['resolution'] ?? null);
        if ($resolution === null) {
            $resolution = $this->inferKelingResolutionFromDimensions($generation);
        }
        if ($resolution === null) {
            unset($generation['mode']);
            return $generation;
        }

        $resolution = $this->normalizeResolution($resolution);
        if ($resolution === null || ! array_key_exists($resolution, self::KELING_RESOLUTION_TO_MODE)) {
            unset($generation['resolution'], $generation['mode']);
            return $generation;
        }

        $generation['resolution'] = $resolution;
        unset($generation['mode']);

        return $generation;
    }

    private function applyGenerationDefaults(array $generation, VideoGenerationConfig $videoGenerationConfig): array
    {
        $config = $videoGenerationConfig->toArray();
        $configGeneration = is_array($config['generation'] ?? null) ? $config['generation'] : [];

        if (! array_key_exists('duration_seconds', $generation)) {
            $defaultDurationSeconds = $this->normalizePositiveInt($configGeneration['default_duration_seconds'] ?? null);
            if ($defaultDurationSeconds !== null) {
                $generation['duration_seconds'] = $defaultDurationSeconds;
            }
        }

        if (! array_key_exists('resolution', $generation)) {
            $defaultResolution = $this->normalizeResolution($configGeneration['default_resolution'] ?? null);
            if ($defaultResolution !== null) {
                $generation['resolution'] = $defaultResolution;
            }
        }

        return $generation;
    }

    /**
     * @param list<array{uri: string, type?: string}> $referenceImages
     */
    private function applyGenerationConstraints(
        array $generation,
        array $referenceImages,
        VideoGenerationConfig $videoGenerationConfig
    ): array {
        if ($referenceImages === []) {
            return $generation;
        }

        $config = $videoGenerationConfig->toArray();
        $constraints = is_array($config['constraints'] ?? null) ? $config['constraints'] : [];
        $requiredDurationSeconds = $this->normalizePositiveInt($constraints['reference_images_requires_duration_seconds'] ?? null);
        if ($requiredDurationSeconds !== null) {
            $generation['duration_seconds'] = $requiredDurationSeconds;
        }

        return $generation;
    }

    private function applyGenerationSupportRules(array $generation, VideoGenerationConfig $videoGenerationConfig): array
    {
        $config = $videoGenerationConfig->toArray();
        $configGeneration = is_array($config['generation'] ?? null) ? $config['generation'] : [];

        $generation = $this->normalizeSupportedAspectRatio($generation, $configGeneration);
        $generation = $this->normalizeSupportedResolution($generation, $configGeneration);
        $generation = $this->normalizeSupportedDuration($generation, $configGeneration);

        if (! (bool) ($configGeneration['supports_watermark'] ?? false)) {
            unset($generation['watermark']);
        }
        if (! (bool) ($configGeneration['supports_negative_prompt'] ?? false)) {
            unset($generation['negative_prompt']);
        }
        if (! (bool) ($configGeneration['supports_generate_audio'] ?? false)) {
            unset($generation['generate_audio']);
        }
        if (! (bool) ($configGeneration['supports_enhance_prompt'] ?? false)) {
            unset($generation['enhance_prompt']);
        }

        $generation = $this->normalizeSupportedEnumOption(
            $generation,
            'person_generation',
            (bool) ($configGeneration['supports_person_generation'] ?? false),
            $this->normalizeStringList($configGeneration['person_generation_options'] ?? []),
        );
        $generation = $this->normalizeSupportedEnumOption(
            $generation,
            'compression_quality',
            (bool) ($configGeneration['supports_compression_quality'] ?? false),
            $this->normalizeStringList($configGeneration['compression_quality_options'] ?? []),
        );
        $generation = $this->normalizeSupportedEnumOption(
            $generation,
            'resize_mode',
            (bool) ($configGeneration['supports_resize_mode'] ?? false),
            $this->normalizeStringList($configGeneration['resize_mode_options'] ?? []),
        );
        $generation = $this->normalizeSupportedRangeInt(
            $generation,
            'sample_count',
            (bool) ($configGeneration['supports_sample_count'] ?? false),
            $this->normalizeIntList($configGeneration['sample_count_range'] ?? []),
        );
        return $this->normalizeSupportedRangeInt(
            $generation,
            'seed',
            (bool) ($configGeneration['supports_seed'] ?? false),
            $this->normalizeIntList($configGeneration['seed_range'] ?? []),
        );
    }

    private function inferKelingResolutionFromDimensions(array $generation): ?string
    {
        $width = $this->normalizePositiveInt($generation['width'] ?? null);
        $height = $this->normalizePositiveInt($generation['height'] ?? null);
        if ($width === null || $height === null) {
            return null;
        }

        $dimensions = $width . 'x' . $height;
        return self::KELING_DIMENSIONS_TO_RESOLUTION[$dimensions] ?? null;
    }

    /**
     * @param list<array{role: string, uri: string}> $audioInputs
     */
    private function assertCapability(
        string $task,
        array $maskInput,
        array $audioInputs,
        array $extensions
    ): void {
        if ($task !== self::TASK_GENERATE) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'unsupported_option: task');
        }

        if ($maskInput !== []) {
            return;
        }

        if ($audioInputs !== []) {
            return;
        }

        if ($extensions === []) {
            return;
        }
    }

    private function assertTaskRequirements(string $task, array $videoInput): void
    {
        if (($task === self::TASK_EXTEND || $task === self::TASK_EDIT || $task === self::TASK_UPSCALE) && $videoInput === []) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'inputs.video is required');
        }
    }

    private function finishSucceeded(VideoQueueOperationEntity $operation, array $result): void
    {
        $output = $result['output'] ?? null;
        if (! is_array($output)) {
            throw new RuntimeException('video output missing in execution result');
        }

        $videoUrl = trim((string) ($output['video_url'] ?? ''));
        if ($videoUrl === '') {
            throw new RuntimeException('video url missing in execution result');
        }

        $this->finish($operation, VideoOperationStatus::SUCCEEDED, $output, null, null);
    }

    private function finishFailed(VideoQueueOperationEntity $operation, array $result): void
    {
        $error = $result['error'] ?? [];
        $this->finish(
            $operation,
            VideoOperationStatus::FAILED,
            [],
            is_array($error) && is_string($error['code'] ?? null) ? $error['code'] : 'PROVIDER_FAILED',
            $this->resolvePublicErrorMessage(
                is_array($error) && is_string($error['message'] ?? null) ? $error['message'] : null
            ),
        );
    }

    private function finish(
        VideoQueueOperationEntity $operation,
        VideoOperationStatus $status,
        array $output,
        ?string $errorCode,
        ?string $errorMessage
    ): void {
        $operation->setStatus($status);
        $operation->setOutput($output);
        $operation->setVideoUrl(isset($output['video_url']) && is_string($output['video_url']) ? $output['video_url'] : null);
        $operation->setErrorCode($errorCode);
        $operation->setErrorMessage($errorMessage);
        if ($status->isDone() && $operation->getFinishedAt() === null) {
            $operation->setFinishedAt(date(DATE_ATOM));
        }
    }

    private function markProviderProcessing(VideoQueueOperationEntity $operation): void
    {
        $operation->setStatus(VideoOperationStatus::PROVIDER_RUNNING);
    }

    private function mapPublicStatus(VideoQueueOperationEntity $operation): string
    {
        return match ($operation->getStatus()) {
            VideoOperationStatus::QUEUED => self::PUBLIC_STATUS_QUEUED,
            VideoOperationStatus::RUNNING, VideoOperationStatus::PROVIDER_RUNNING => self::PUBLIC_STATUS_RUNNING,
            VideoOperationStatus::SUCCEEDED => self::RESULT_STATUS_SUCCEEDED,
            VideoOperationStatus::FAILED => self::RESULT_STATUS_FAILED,
            VideoOperationStatus::CANCELED => self::PUBLIC_STATUS_CANCELED,
        };
    }

    private function resolveUpdateTime(VideoQueueOperationEntity $operation): ?string
    {
        return $operation->getFinishedAt()
            ?? $operation->getHeartbeatAt()
            ?? $operation->getStartedAt()
            ?? $operation->getCreatedAt();
    }

    private function buildOperationQueue(array $snapshot): VideoOperationQueueDTO
    {
        $queue = new VideoOperationQueueDTO();
        $queue->setPosition(isset($snapshot['queue_position']) && is_int($snapshot['queue_position']) ? $snapshot['queue_position'] : null);
        $queue->setSameUserAheadCount((int) ($snapshot['same_user_ahead_count'] ?? 0));
        $queue->setEndpointTotalAheadCount((int) ($snapshot['endpoint_total_ahead_count'] ?? 0));
        $queue->setRunningCount((int) ($snapshot['running_count'] ?? 0));

        return $queue;
    }

    private function buildOperationError(VideoQueueOperationEntity $operation): ?VideoOperationErrorDTO
    {
        $status = $operation->getStatus();
        if ($status !== VideoOperationStatus::FAILED && $status !== VideoOperationStatus::CANCELED) {
            return null;
        }

        $error = new VideoOperationErrorDTO();
        $error->setCode($operation->getErrorCode());
        $error->setMessage($this->resolvePublicErrorMessage($operation->getErrorMessage()));

        return $error;
    }

    private function resolvePublicErrorMessage(?string $message): string
    {
        $normalized = trim((string) $message);
        if ($normalized === '') {
            return self::ERROR_MESSAGE_FAILED;
        }

        return $normalized;
    }

    private function normalizeAspectRatio(mixed $value): ?string
    {
        $normalized = $this->normalizeAspectRatioAlias($value);
        if ($normalized === null) {
            return null;
        }

        return $normalized;
    }

    private function normalizeReferenceImageType(mixed $value): string
    {
        return strtolower(trim((string) $value));
    }

    private function normalizeMediaInput(mixed $value, string $field): array
    {
        if ($value === null) {
            return [];
        }

        if (! is_array($value)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s is invalid', $field));
        }

        $uri = trim((string) ($value['uri'] ?? ''));
        if ($uri === '') {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('%s.uri is required', $field));
        }

        return ['uri' => $uri];
    }

    /**
     * @return list<array{role: string, uri: string}>
     */
    private function normalizeAudioInputs(mixed $value): array
    {
        if ($value === null) {
            return [];
        }

        if (! is_array($value)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'inputs.audio is invalid');
        }

        $result = [];
        foreach ($value as $index => $item) {
            if (! is_array($item)) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('inputs.audio.%d is invalid', $index));
            }

            $role = trim((string) ($item['role'] ?? ''));
            $uri = trim((string) ($item['uri'] ?? ''));
            if ($role !== self::AUDIO_ROLE_REFERENCE) {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('inputs.audio.%d.role is invalid', $index));
            }
            if ($uri === '') {
                ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, sprintf('inputs.audio.%d.uri is required', $index));
            }

            $result[] = [
                'role' => $role,
                'uri' => $uri,
            ];
        }

        return $result;
    }

    private function normalizeOptionalString(mixed $value): ?string
    {
        $normalized = is_string($value) ? trim($value) : '';

        return $normalized === '' ? null : $normalized;
    }

    private function normalizeGenerationSize(mixed $value): ?string
    {
        $normalized = $this->normalizeOptionalString($value);
        if ($normalized === null) {
            return null;
        }

        if (! preg_match('/^\d+x\d+$/i', $normalized)) {
            return null;
        }

        return strtolower($normalized);
    }

    private function normalizeOptionalBool(mixed $value, string $field): ?bool
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

        $normalized = strtolower(trim((string) $value));
        return match ($normalized) {
            '1', 'true', 'on', 'yes' => true,
            '0', 'false', 'off', 'no' => false,
            default => null,
        };
    }

    private function normalizePositiveInt(mixed $value): ?int
    {
        $normalized = $this->normalizeNullableInt($value);
        return $normalized !== null && $normalized > 0 ? $normalized : null;
    }

    private function normalizeNullableInt(mixed $value): ?int
    {
        if (is_int($value)) {
            return $value;
        }
        if (is_numeric($value)) {
            return (int) $value;
        }

        return null;
    }

    private function normalizeResolution(mixed $value): ?string
    {
        $normalized = strtolower(trim((string) $value));
        return $normalized === '' ? null : $normalized;
    }

    private function normalizeKelingMode(mixed $value): ?string
    {
        $normalized = strtolower(trim((string) $value));
        if ($normalized === '') {
            return null;
        }

        return array_key_exists($normalized, self::KELING_MODE_TO_RESOLUTION) ? $normalized : null;
    }

    private function normalizeTask(mixed $value): string
    {
        $normalized = is_string($value) ? trim($value) : '';
        if (! in_array($normalized, self::SUPPORTED_TASKS, true)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'task is invalid');
        }

        return $normalized;
    }

    private function normalizeServiceTier(mixed $value): ?string
    {
        $normalized = strtolower(trim((string) $value));
        if ($normalized === '') {
            return null;
        }

        return in_array($normalized, self::SERVICE_TIERS, true) ? $normalized : null;
    }

    /**
     * @param array<string, mixed> $generation
     * @param array<string, mixed> $configGeneration
     * @return array<string, mixed>
     */
    private function normalizeSupportedAspectRatio(array $generation, array $configGeneration): array
    {
        if (! array_key_exists('aspect_ratio', $generation)) {
            return $generation;
        }

        $supportedAspectRatios = $this->normalizeStringList($configGeneration['aspect_ratios'] ?? []);
        if ($supportedAspectRatios === []) {
            unset($generation['aspect_ratio']);
            return $generation;
        }

        $aspectRatio = $this->normalizeAspectRatioAlias($generation['aspect_ratio']);
        if ($aspectRatio === null || ! in_array($aspectRatio, $supportedAspectRatios, true)) {
            unset($generation['aspect_ratio']);
            return $generation;
        }

        $generation['aspect_ratio'] = $aspectRatio;
        return $generation;
    }

    /**
     * @param array<string, mixed> $generation
     * @param array<string, mixed> $configGeneration
     * @return array<string, mixed>
     */
    private function normalizeSupportedResolution(array $generation, array $configGeneration): array
    {
        $supportedResolutions = $this->normalizeStringList($configGeneration['resolutions'] ?? []);
        if ($supportedResolutions === []) {
            unset($generation['resolution']);
            return $generation;
        }

        $resolution = $this->coerceResolutionValue(
            $generation['resolution'] ?? null,
            $generation,
            $supportedResolutions,
            $this->normalizeOptionalString($configGeneration['default_resolution'] ?? null),
            $configGeneration
        );
        if ($resolution === null) {
            unset($generation['resolution']);
            return $generation;
        }

        $generation['resolution'] = $resolution;
        return $generation;
    }

    /**
     * @param array<string, mixed> $generation
     * @param array<string, mixed> $configGeneration
     * @return array<string, mixed>
     */
    private function normalizeSupportedDuration(array $generation, array $configGeneration): array
    {
        $supportedDurations = $this->normalizeIntList($configGeneration['durations'] ?? []);
        if ($supportedDurations === []) {
            unset($generation['duration_seconds']);
            return $generation;
        }

        $defaultDuration = $this->normalizeNullableInt($configGeneration['default_duration_seconds'] ?? null);
        if (! array_key_exists('duration_seconds', $generation)) {
            return $generation;
        }

        $duration = $this->coerceIntToSupportedList($generation['duration_seconds'], $supportedDurations, $defaultDuration);
        if ($duration === null || $duration <= 0) {
            unset($generation['duration_seconds']);
            return $generation;
        }

        $generation['duration_seconds'] = $duration;
        return $generation;
    }

    /**
     * @param array<string, mixed> $generation
     * @param list<string> $supportedOptions
     * @return array<string, mixed>
     */
    private function normalizeSupportedEnumOption(
        array $generation,
        string $field,
        bool $supported,
        array $supportedOptions
    ): array {
        if (! array_key_exists($field, $generation)) {
            return $generation;
        }

        if (! $supported || $supportedOptions === []) {
            unset($generation[$field]);
            return $generation;
        }

        $value = $this->normalizeOptionalString($generation[$field]);
        if ($value === null) {
            unset($generation[$field]);
            return $generation;
        }
        $value = strtolower($value);
        if (! in_array($value, $supportedOptions, true)) {
            unset($generation[$field]);
            return $generation;
        }

        $generation[$field] = $value;
        return $generation;
    }

    /**
     * @param array<string, mixed> $generation
     * @param list<int> $range
     * @return array<string, mixed>
     */
    private function normalizeSupportedRangeInt(array $generation, string $field, bool $supported, array $range): array
    {
        if (! array_key_exists($field, $generation)) {
            return $generation;
        }

        if (! $supported || count($range) !== 2) {
            unset($generation[$field]);
            return $generation;
        }

        $value = $this->normalizeNullableInt($generation[$field]);
        if ($value === null) {
            unset($generation[$field]);
            return $generation;
        }

        $generation[$field] = max(min($value, max($range)), min($range));
        return $generation;
    }

    private function normalizeAspectRatioAlias(mixed $value): ?string
    {
        $normalized = strtolower(trim((string) $value));
        if ($normalized === '') {
            return null;
        }

        $normalized = str_replace([' ', '：'], '', $normalized);
        return self::ASPECT_RATIO_ALIASES[$normalized] ?? (preg_match('/^\d+:\d+$/', $normalized) === 1 ? $normalized : null);
    }

    /**
     * @param list<string> $supportedResolutions
     * @param array<string, mixed> $generation
     * @param array<string, mixed> $configGeneration
     */
    private function coerceResolutionValue(
        mixed $value,
        array $generation,
        array $supportedResolutions,
        ?string $defaultResolution,
        array $configGeneration
    ): ?string {
        $normalized = $this->normalizeResolution($value);
        if ($normalized !== null && in_array($normalized, $supportedResolutions, true)) {
            return $normalized;
        }

        $inferredFromSize = $this->inferResolutionFromSupportedSize($generation, $configGeneration);
        if ($inferredFromSize !== null && in_array($inferredFromSize, $supportedResolutions, true)) {
            return $inferredFromSize;
        }

        $targetScore = $this->extractResolutionScore($normalized);
        if ($targetScore !== null) {
            return $this->nearestResolution($targetScore, $supportedResolutions) ?? $defaultResolution;
        }

        return $defaultResolution;
    }

    /**
     * @param array<string, mixed> $generation
     * @param array<string, mixed> $configGeneration
     */
    private function inferResolutionFromSupportedSize(array $generation, array $configGeneration): ?string
    {
        $size = $this->normalizeGenerationSize($generation['size'] ?? null);
        if ($size === null) {
            return null;
        }

        foreach ($configGeneration['sizes'] ?? [] as $supportedSize) {
            if (! is_array($supportedSize)) {
                continue;
            }

            if (strtolower(trim((string) ($supportedSize['value'] ?? ''))) !== $size) {
                continue;
            }

            return $this->normalizeResolution($supportedSize['resolution'] ?? null);
        }

        return null;
    }

    /**
     * @param list<int> $supportedValues
     */
    private function coerceIntToSupportedList(mixed $value, array $supportedValues, ?int $defaultValue): ?int
    {
        if ($supportedValues === []) {
            return null;
        }

        $normalized = $this->normalizeNullableInt($value);
        if ($normalized === null) {
            return $defaultValue;
        }

        return $this->nearestInt($normalized, $supportedValues) ?? $defaultValue;
    }

    /**
     * @param list<int> $supportedValues
     */
    private function nearestInt(int $value, array $supportedValues): ?int
    {
        sort($supportedValues);
        $nearest = null;
        $nearestDistance = null;
        foreach ($supportedValues as $supportedValue) {
            $distance = abs($supportedValue - $value);
            if ($nearestDistance === null || $distance < $nearestDistance || ($distance === $nearestDistance && $supportedValue < $nearest)) {
                $nearest = $supportedValue;
                $nearestDistance = $distance;
            }
        }

        return $nearest;
    }

    /**
     * @param list<string> $supportedResolutions
     */
    private function nearestResolution(int $targetScore, array $supportedResolutions): ?string
    {
        $nearest = null;
        $nearestDistance = null;
        foreach ($supportedResolutions as $resolution) {
            $resolutionScore = self::RESOLUTION_SCORES[$resolution] ?? null;
            if ($resolutionScore === null) {
                continue;
            }

            $distance = abs($resolutionScore - $targetScore);
            if ($nearestDistance === null || $distance < $nearestDistance || ($distance === $nearestDistance && $resolutionScore < (self::RESOLUTION_SCORES[$nearest] ?? PHP_INT_MAX))) {
                $nearest = $resolution;
                $nearestDistance = $distance;
            }
        }

        return $nearest;
    }

    private function extractResolutionScore(?string $resolution): ?int
    {
        if ($resolution === null || $resolution === '') {
            return null;
        }

        if (isset(self::RESOLUTION_SCORES[$resolution])) {
            return self::RESOLUTION_SCORES[$resolution];
        }

        if (preg_match('/^(\d+)\s*p$/i', $resolution, $matches) === 1) {
            return (int) $matches[1];
        }
        if (preg_match('/^(\d+)\s*k$/i', $resolution, $matches) === 1) {
            return ((int) $matches[1]) * 540;
        }

        return null;
    }

    /**
     * @return list<string>
     */
    private function normalizeStringList(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $result = [];
        foreach ($value as $item) {
            $normalized = $this->normalizeOptionalString($item);
            if ($normalized !== null) {
                $result[] = strtolower($normalized);
            }
        }

        return array_values(array_unique($result));
    }

    /**
     * @return list<int>
     */
    private function normalizeIntList(mixed $value): array
    {
        if (! is_array($value)) {
            return [];
        }

        $result = [];
        foreach ($value as $item) {
            $normalized = $this->normalizeNullableInt($item);
            if ($normalized !== null) {
                $result[] = $normalized;
            }
        }

        return array_values(array_unique($result));
    }
}
