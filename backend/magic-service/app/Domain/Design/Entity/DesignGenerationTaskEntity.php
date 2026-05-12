<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Entity;

use App\Domain\Design\Entity\ValueObject\DesignGenerationAssetType;
use App\Domain\Design\Entity\ValueObject\DesignGenerationStatus;
use App\Domain\Design\Entity\ValueObject\DesignGenerationType;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;

class DesignGenerationTaskEntity extends AbstractEntity
{
    private const string FIELD_ORGANIZATION_CODE = 'organization_code';

    private const string FIELD_USER_ID = 'user_id';

    private const string FIELD_PROJECT_ID = 'project_id';

    private const string FIELD_GENERATION_ID = 'generation_id';

    private const string FIELD_MODEL_ID = 'model_id';

    private const string FIELD_PROMPT = 'prompt';

    private const string FIELD_FILE_DIR = 'file_dir';

    private const string PROVIDER_KEY_OPERATION_ID = 'operation_id';

    private const string PROVIDER_KEY_DEADLINE_AT = 'deadline_at';

    private const string PROVIDER_KEY_LAST_POLLED_AT = 'last_polled_at';

    private const string PROVIDER_KEY_FIRST_POLL_STATUS = 'first_poll_status';

    private const string PROVIDER_KEY_FIRST_POLL_NEXT_RETRY_AT = 'first_poll_next_retry_at';

    private const string PROVIDER_KEY_FIRST_POLL_ATTEMPTS = 'first_poll_attempts';

    private const string FIRST_POLL_STATUS_PENDING = 'pending';

    private const string INPUT_KEY_REFERENCE_IMAGES = 'reference_images';

    private const string INPUT_KEY_REFERENCE_VIDEOS = 'reference_videos';

    private const string INPUT_KEY_REFERENCE_AUDIOS = 'reference_audios';

    private const string INPUT_KEY_MASK = 'mask';

    private const string INPUT_KEY_FRAMES = 'frames';

    private const string FIELD_URI = 'uri';

    private const string OUTPUT_KEY_FILE_DIR_ID = 'file_dir_id';

    private const string OUTPUT_KEY_ARCHIVE_SKIPPED_REASON = 'archive_skipped_reason';

    protected ?int $id = null;

    protected string $organizationCode = '';

    protected string $userId = '';

    protected int $projectId = 0;

    protected string $generationId = '';

    protected DesignGenerationAssetType $assetType;

    protected DesignGenerationType $generationType;

    protected string $modelId = '';

    protected string $prompt = '';

    protected string $fileDir = '';

    protected string $fileName = '';

    protected array $inputPayload = [];

    protected array $requestPayload = [];

    protected array $providerPayload = [];

    protected array $outputPayload = [];

    protected DesignGenerationStatus $status;

    protected ?string $errorMessage = null;

    protected DateTime $createdAt;

    protected DateTime $updatedAt;

    private ?string $fileId = null;

    private ?string $fileUrl = null;

    private ?string $posterFileId = null;

    private ?string $posterUrl = null;

    public function prepareForCreate(): void
    {
        foreach ([
            self::FIELD_ORGANIZATION_CODE => $this->organizationCode,
            self::FIELD_USER_ID => $this->userId,
            self::FIELD_PROJECT_ID => $this->projectId,
            self::FIELD_GENERATION_ID => $this->generationId,
            self::FIELD_MODEL_ID => $this->modelId,
            self::FIELD_PROMPT => $this->prompt,
            self::FIELD_FILE_DIR => $this->fileDir,
        ] as $label => $value) {
            if ($value === '' || $value === 0) {
                ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.empty', ['label' => $label]);
            }
        }

        $this->id = null;
        $this->status = DesignGenerationStatus::PENDING;
        $this->errorMessage = null;
        $this->createdAt = new DateTime();
        $this->updatedAt = new DateTime();
    }

    public function isFinal(): bool
    {
        return $this->status->isFinal();
    }

    public function canSubmit(): bool
    {
        return $this->status === DesignGenerationStatus::PENDING;
    }

    public function canPoll(): bool
    {
        return ! $this->isFinal() && $this->hasOperationId();
    }

    public function hasOperationId(): bool
    {
        return $this->getOperationId() !== '';
    }

    public function getOperationId(): string
    {
        return trim((string) ($this->providerPayload[self::PROVIDER_KEY_OPERATION_ID] ?? ''));
    }

    public function getPollDeadlineAt(): ?string
    {
        $deadlineAt = $this->providerPayload[self::PROVIDER_KEY_DEADLINE_AT] ?? null;
        return is_string($deadlineAt) && $deadlineAt !== '' ? $deadlineAt : null;
    }

    public function getLastPolledAt(): ?string
    {
        $lastPolledAt = $this->providerPayload[self::PROVIDER_KEY_LAST_POLLED_AT] ?? null;
        return is_string($lastPolledAt) && $lastPolledAt !== '' ? $lastPolledAt : null;
    }

    public function getFirstPollStatus(): string
    {
        return trim((string) ($this->providerPayload[self::PROVIDER_KEY_FIRST_POLL_STATUS] ?? self::FIRST_POLL_STATUS_PENDING));
    }

    public function getFirstPollNextRetryAt(): ?string
    {
        $nextRetryAt = $this->providerPayload[self::PROVIDER_KEY_FIRST_POLL_NEXT_RETRY_AT] ?? null;
        return is_string($nextRetryAt) && $nextRetryAt !== '' ? $nextRetryAt : null;
    }

    public function getFirstPollAttempts(): int
    {
        return (int) ($this->providerPayload[self::PROVIDER_KEY_FIRST_POLL_ATTEMPTS] ?? 0);
    }

    public function getReferenceImages(): array
    {
        $referenceImages = $this->inputPayload[self::INPUT_KEY_REFERENCE_IMAGES] ?? [];
        return is_array($referenceImages) ? $referenceImages : [];
    }

    public function getMask(): ?string
    {
        $mask = $this->inputPayload[self::INPUT_KEY_MASK] ?? null;
        if (! is_array($mask)) {
            return null;
        }

        $uri = trim((string) ($mask[self::FIELD_URI] ?? ''));
        return $uri === '' ? null : $uri;
    }

    public function getFrames(): array
    {
        $frames = $this->inputPayload[self::INPUT_KEY_FRAMES] ?? [];
        return is_array($frames) ? $frames : [];
    }

    public function getReferenceVideos(): array
    {
        $referenceVideos = $this->inputPayload[self::INPUT_KEY_REFERENCE_VIDEOS] ?? [];
        return is_array($referenceVideos) ? $referenceVideos : [];
    }

    public function getReferenceAudios(): array
    {
        $referenceAudios = $this->inputPayload[self::INPUT_KEY_REFERENCE_AUDIOS] ?? [];
        return is_array($referenceAudios) ? $referenceAudios : [];
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        if (is_string($id)) {
            $id = (int) $id;
        }
        $this->id = $id;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function setProjectId(int $projectId): void
    {
        $this->projectId = $projectId;
    }

    public function getGenerationId(): string
    {
        return $this->generationId;
    }

    public function setGenerationId(string $generationId): void
    {
        $this->generationId = $generationId;
    }

    public function getAssetType(): DesignGenerationAssetType
    {
        return $this->assetType;
    }

    public function setAssetType(DesignGenerationAssetType|string $assetType): void
    {
        $this->assetType = is_string($assetType) ? DesignGenerationAssetType::from($assetType) : $assetType;
    }

    public function getGenerationType(): DesignGenerationType
    {
        return $this->generationType;
    }

    public function setGenerationType(DesignGenerationType|string $generationType): void
    {
        $this->generationType = is_string($generationType) ? DesignGenerationType::from($generationType) : $generationType;
    }

    public function getModelId(): string
    {
        return $this->modelId;
    }

    public function setModelId(string $modelId): void
    {
        $this->modelId = $modelId;
    }

    public function getPrompt(): string
    {
        return $this->prompt;
    }

    public function setPrompt(string $prompt): void
    {
        $this->prompt = $prompt;
    }

    public function getFileDir(): string
    {
        return $this->fileDir;
    }

    public function setFileDir(string $fileDir): void
    {
        $this->fileDir = $fileDir;
    }

    public function getFileName(): string
    {
        return $this->fileName;
    }

    public function setFileName(string $fileName): void
    {
        $this->fileName = $fileName;
    }

    public function getInputPayload(): array
    {
        return $this->inputPayload;
    }

    public function setInputPayload(array $inputPayload): void
    {
        $this->inputPayload = $inputPayload;
    }

    public function getRequestPayload(): array
    {
        return $this->requestPayload;
    }

    public function setRequestPayload(array $requestPayload): void
    {
        $this->requestPayload = $requestPayload;
    }

    public function getProviderPayload(): array
    {
        return $this->providerPayload;
    }

    public function setProviderPayload(array $providerPayload): void
    {
        $this->providerPayload = $providerPayload;
    }

    public function getOutputPayload(): array
    {
        return $this->outputPayload;
    }

    public function setOutputPayload(array $outputPayload): void
    {
        $this->outputPayload = $outputPayload;
    }

    /**
     * 获取创建视频任务时记录的输出目录 ID，用于目录改名或移动后的归档定位。
     */
    public function getOutputDirectoryFileId(): ?int
    {
        $fileDirId = $this->outputPayload[self::OUTPUT_KEY_FILE_DIR_ID] ?? null;
        if (! is_numeric($fileDirId)) {
            return null;
        }

        $fileDirId = (int) $fileDirId;
        return $fileDirId > 0 ? $fileDirId : null;
    }

    /**
     * 记录输出目录 ID；传入空值或非法值时移除该快照。
     */
    public function setOutputDirectoryFileId(?int $fileDirId): void
    {
        if ($fileDirId !== null && $fileDirId > 0) {
            $this->outputPayload[self::OUTPUT_KEY_FILE_DIR_ID] = $fileDirId;
            return;
        }

        unset($this->outputPayload[self::OUTPUT_KEY_FILE_DIR_ID]);
    }

    /**
     * 记录归档跳过原因，便于排查已完成但未写入项目文件的任务。
     */
    public function setArchiveSkippedReason(string $reason): void
    {
        $this->outputPayload[self::OUTPUT_KEY_ARCHIVE_SKIPPED_REASON] = $reason;
    }

    public function getStatus(): DesignGenerationStatus
    {
        return $this->status;
    }

    public function setStatus(DesignGenerationStatus|string $status): void
    {
        $this->status = is_string($status) ? DesignGenerationStatus::from($status) : $status;
    }

    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }

    public function setErrorMessage(?string $errorMessage): void
    {
        $this->errorMessage = $errorMessage;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(DateTime $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    public function getFileId(): ?string
    {
        return $this->fileId;
    }

    public function setFileId(null|int|string $fileId): void
    {
        if (is_int($fileId)) {
            $fileId = (string) $fileId;
        }
        $this->fileId = $fileId;
    }

    public function getFileUrl(): ?string
    {
        return $this->fileUrl;
    }

    public function setFileUrl(?string $fileUrl): void
    {
        $this->fileUrl = $fileUrl;
    }

    public function getPosterFileId(): ?string
    {
        return $this->posterFileId;
    }

    public function setPosterFileId(null|int|string $posterFileId): void
    {
        if (is_int($posterFileId)) {
            $posterFileId = (string) $posterFileId;
        }
        $this->posterFileId = $posterFileId;
    }

    public function getPosterUrl(): ?string
    {
        return $this->posterUrl;
    }

    public function setPosterUrl(?string $posterUrl): void
    {
        $this->posterUrl = $posterUrl;
    }
}
