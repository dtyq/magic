<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity;

use App\Domain\ModelGateway\Entity\ValueObject\VideoGenerationType;
use App\Domain\ModelGateway\Entity\ValueObject\VideoOperationStatus;
use JsonException;

class VideoQueueOperationEntity
{
    public function __construct(
        protected string $id,
        protected string $endpoint,
        protected string $model,
        protected string $modelVersion,
        protected string $providerModelId,
        protected string $providerCode,
        protected string $providerName,
        protected string $organizationCode,
        protected string $userId,
        protected VideoOperationStatus $status,
        protected int $seq,
        protected ?int $projectId = null,
        protected ?string $topicId = null,
        protected ?string $taskId = null,
        protected ?string $sourceId = null,
        protected ?string $videoId = null,
        protected ?string $fileDir = null,
        protected ?string $fileName = null,
        protected ?int $type = null,
        protected ?string $fileUrl = null,
        protected array $rawRequest = [],
        protected array $providerPayload = [],
        protected array $output = [],
        protected array $acceptedParams = [],
        protected array $ignoredParams = [],
        protected ?string $providerTaskId = null,
        protected ?string $videoUrl = null,
        protected ?string $errorCode = null,
        protected ?string $errorMessage = null,
        protected ?array $providerResult = null,
        protected ?string $createdAt = null,
        protected ?string $startedAt = null,
        protected ?string $finishedAt = null,
        protected ?string $heartbeatAt = null,
        protected ?string $canceledAt = null,
        protected string $auditProviderName = '',
    ) {
    }

    public static function fromStorageArray(array $data): self
    {
        return new self(
            id: (string) ($data['id'] ?? ''),
            endpoint: (string) ($data['endpoint'] ?? ''),
            model: (string) ($data['model'] ?? ''),
            modelVersion: (string) ($data['model_version'] ?? ''),
            providerModelId: (string) ($data['provider_model_id'] ?? ''),
            providerCode: (string) ($data['provider_code'] ?? ''),
            providerName: (string) ($data['provider_name'] ?? ''),
            auditProviderName: (string) ($data['audit_provider_name'] ?? ''),
            organizationCode: (string) ($data['organization_code'] ?? ''),
            userId: (string) ($data['user_id'] ?? ''),
            status: VideoOperationStatus::fromStorage((string) ($data['status'] ?? VideoOperationStatus::QUEUED->value)),
            seq: (int) ($data['seq'] ?? 0),
            projectId: isset($data['project_id']) && is_numeric($data['project_id']) ? (int) $data['project_id'] : null,
            topicId: self::nullableString($data['topic_id'] ?? null),
            taskId: self::nullableString($data['task_id'] ?? null),
            sourceId: self::nullableString($data['source_id'] ?? null),
            videoId: self::nullableString($data['video_id'] ?? null),
            fileDir: self::nullableString($data['file_dir'] ?? null),
            fileName: self::nullableString($data['file_name'] ?? null),
            type: isset($data['type']) && is_numeric($data['type']) ? (int) $data['type'] : null,
            fileUrl: self::nullableString($data['file_url'] ?? null),
            rawRequest: self::decodeJsonField($data['raw_request'] ?? []),
            providerPayload: self::decodeJsonField($data['provider_payload'] ?? []),
            output: self::decodeJsonField($data['output'] ?? []),
            acceptedParams: self::decodeJsonField($data['accepted_params'] ?? []),
            ignoredParams: self::decodeJsonField($data['ignored_params'] ?? []),
            providerTaskId: self::nullableString($data['provider_task_id'] ?? $data['upstream_task_id'] ?? null),
            videoUrl: self::nullableString($data['video_url'] ?? null),
            errorCode: self::nullableString($data['error_code'] ?? null),
            errorMessage: self::nullableString($data['error_message'] ?? null),
            providerResult: self::decodeJsonField($data['provider_result'] ?? null, true),
            createdAt: self::nullableString($data['created_at'] ?? null),
            startedAt: self::nullableString($data['started_at'] ?? null),
            finishedAt: self::nullableString($data['finished_at'] ?? null),
            heartbeatAt: self::nullableString($data['heartbeat_at'] ?? null),
            canceledAt: self::nullableString($data['canceled_at'] ?? null),
        );
    }

    public function toStorageArray(): array
    {
        return [
            'id' => $this->id,
            'endpoint' => $this->endpoint,
            'model' => $this->model,
            'model_version' => $this->modelVersion,
            'provider_model_id' => $this->providerModelId,
            'provider_code' => $this->providerCode,
            'provider_name' => $this->providerName,
            'audit_provider_name' => $this->auditProviderName,
            'organization_code' => $this->organizationCode,
            'user_id' => $this->userId,
            'project_id' => $this->projectId === null ? '' : (string) $this->projectId,
            'topic_id' => $this->topicId ?? '',
            'task_id' => $this->taskId ?? '',
            'source_id' => $this->sourceId ?? '',
            'video_id' => $this->videoId ?? '',
            'file_dir' => $this->fileDir ?? '',
            'file_name' => $this->fileName ?? '',
            'type' => $this->type === null ? '' : (string) $this->type,
            'file_url' => $this->fileUrl ?? '',
            'status' => $this->status->value,
            'seq' => (string) $this->seq,
            'raw_request' => self::encodeJsonField($this->rawRequest),
            'provider_payload' => self::encodeJsonField($this->providerPayload),
            'output' => self::encodeJsonField($this->output),
            'accepted_params' => self::encodeJsonField($this->acceptedParams),
            'ignored_params' => self::encodeJsonField($this->ignoredParams),
            'provider_task_id' => $this->providerTaskId ?? '',
            'video_url' => $this->videoUrl ?? '',
            'error_code' => $this->errorCode ?? '',
            'error_message' => $this->errorMessage ?? '',
            'provider_result' => self::encodeJsonField($this->providerResult ?? []),
            'created_at' => $this->createdAt ?? '',
            'started_at' => $this->startedAt ?? '',
            'finished_at' => $this->finishedAt ?? '',
            'heartbeat_at' => $this->heartbeatAt ?? '',
            'canceled_at' => $this->canceledAt ?? '',
        ];
    }

    public function getName(): string
    {
        return 'operations/' . $this->id;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getEndpoint(): string
    {
        return $this->endpoint;
    }

    public function getModel(): string
    {
        return $this->model;
    }

    public function getModelVersion(): string
    {
        return $this->modelVersion;
    }

    public function getProviderModelId(): string
    {
        return $this->providerModelId;
    }

    public function getProviderCode(): string
    {
        return $this->providerCode;
    }

    public function getProviderName(): string
    {
        return $this->providerName;
    }

    public function getAuditProviderName(): string
    {
        return $this->auditProviderName;
    }

    public function setAuditProviderName(string $auditProviderName): void
    {
        $this->auditProviderName = $auditProviderName;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getProjectId(): ?int
    {
        return $this->projectId;
    }

    public function setProjectId(?int $projectId): void
    {
        $this->projectId = $projectId;
    }

    public function getTopicId(): ?string
    {
        return $this->topicId;
    }

    public function setTopicId(?string $topicId): void
    {
        $this->topicId = $topicId;
    }

    public function getTaskId(): ?string
    {
        return $this->taskId;
    }

    public function setTaskId(?string $taskId): void
    {
        $this->taskId = $taskId;
    }

    public function getSourceId(): ?string
    {
        return $this->sourceId;
    }

    public function setSourceId(?string $sourceId): void
    {
        $this->sourceId = $sourceId;
    }

    public function getVideoId(): ?string
    {
        return $this->videoId;
    }

    public function setVideoId(?string $videoId): void
    {
        $this->videoId = $videoId;
    }

    public function getFileDir(): ?string
    {
        return $this->fileDir;
    }

    public function setFileDir(?string $fileDir): void
    {
        $this->fileDir = $fileDir;
    }

    public function getFileName(): ?string
    {
        return $this->fileName;
    }

    public function setFileName(?string $fileName): void
    {
        $this->fileName = $fileName;
    }

    public function getType(): VideoGenerationType
    {
        return VideoGenerationType::make($this->type);
    }

    public function setType(int|VideoGenerationType $type): void
    {
        if ($type instanceof VideoGenerationType) {
            $type = $type->value;
        }

        $this->type = $type;
    }

    public function getFileUrl(): ?string
    {
        return $this->fileUrl;
    }

    public function setFileUrl(?string $fileUrl): void
    {
        $this->fileUrl = $fileUrl;
    }

    public function getStatus(): VideoOperationStatus
    {
        return $this->status;
    }

    public function setStatus(VideoOperationStatus $status): void
    {
        $this->status = $status;
    }

    public function getSeq(): int
    {
        return $this->seq;
    }

    public function setSeq(int $seq): void
    {
        $this->seq = $seq;
    }

    public function getRawRequest(): array
    {
        return $this->rawRequest;
    }

    public function setRawRequest(array $rawRequest): void
    {
        $this->rawRequest = $rawRequest;
    }

    public function getProviderPayload(): array
    {
        return $this->providerPayload;
    }

    public function setProviderPayload(array $providerPayload): void
    {
        $this->providerPayload = $providerPayload;
    }

    public function getOutput(): array
    {
        return $this->output;
    }

    public function setOutput(array $output): void
    {
        $this->output = $output;
    }

    public function getAcceptedParams(): array
    {
        return $this->acceptedParams;
    }

    public function setAcceptedParams(array $acceptedParams): void
    {
        $this->acceptedParams = $acceptedParams;
    }

    public function getIgnoredParams(): array
    {
        return $this->ignoredParams;
    }

    public function setIgnoredParams(array $ignoredParams): void
    {
        $this->ignoredParams = $ignoredParams;
    }

    public function setProviderTaskId(?string $providerTaskId): void
    {
        $this->providerTaskId = $providerTaskId;
    }

    public function getProviderTaskId(): ?string
    {
        return $this->providerTaskId;
    }

    public function setVideoUrl(?string $videoUrl): void
    {
        $this->videoUrl = $videoUrl;
    }

    public function getErrorCode(): ?string
    {
        return $this->errorCode;
    }

    public function setErrorCode(?string $errorCode): void
    {
        $this->errorCode = $errorCode;
    }

    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }

    public function setErrorMessage(?string $errorMessage): void
    {
        $this->errorMessage = $errorMessage;
    }

    public function getProviderResult(): ?array
    {
        return $this->providerResult;
    }

    public function setProviderResult(?array $providerResult): void
    {
        $this->providerResult = $providerResult;
    }

    public function getCreatedAt(): ?string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getStartedAt(): ?string
    {
        return $this->startedAt;
    }

    public function setStartedAt(?string $startedAt): void
    {
        $this->startedAt = $startedAt;
    }

    public function getFinishedAt(): ?string
    {
        return $this->finishedAt;
    }

    public function setFinishedAt(?string $finishedAt): void
    {
        $this->finishedAt = $finishedAt;
    }

    public function getHeartbeatAt(): ?string
    {
        return $this->heartbeatAt;
    }

    public function setHeartbeatAt(?string $heartbeatAt): void
    {
        $this->heartbeatAt = $heartbeatAt;
    }

    public function setCanceledAt(?string $canceledAt): void
    {
        $this->canceledAt = $canceledAt;
    }

    public function getCanceledAt(): ?string
    {
        return $this->canceledAt;
    }

    private static function nullableString(mixed $value): ?string
    {
        $value = is_string($value) ? trim($value) : $value;
        if ($value === null || $value === '') {
            return null;
        }
        return (string) $value;
    }

    private static function decodeJsonField(mixed $value, bool $nullable = false): ?array
    {
        if (is_array($value)) {
            return $value;
        }

        if (! is_string($value) || trim($value) === '') {
            return $nullable ? null : [];
        }

        try {
            $decoded = json_decode($value, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return $nullable ? null : [];
        }

        if (! is_array($decoded)) {
            return $nullable ? null : [];
        }

        return $decoded;
    }

    private static function encodeJsonField(array $value): string
    {
        try {
            return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (JsonException) {
            return '[]';
        }
    }
}
