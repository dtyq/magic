<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Event;

use App\Domain\ImageGenerate\ValueObject\ImageGenerateSourceEnum;
use App\Infrastructure\Core\AbstractEvent;
use DateTime;

class VideoGeneratedEvent extends AbstractEvent
{
    protected string $organizationCode;

    protected string $userId;

    protected string $model;

    protected int $durationSeconds = 0;

    protected ?string $resolution = null;

    protected ?string $size = null;

    protected ?int $width = null;

    protected ?int $height = null;

    protected ?string $topicId = null;

    protected ?string $taskId = null;

    protected ?int $projectId = null;

    protected DateTime $createdAt;

    protected ?string $sourceId = null;

    protected ImageGenerateSourceEnum $sourceType;

    protected string $providerModelId = '';

    protected ?string $originalModelId = null;

    /** Provider 任务结果 usage 中的 completion_tokens，用于按 token 计费/审计；无则保持 null */
    protected ?int $completionTokens = null;

    /** Provider 任务结果 usage 中的 total_tokens；可与 completion 一并用于拆分 prompt/output */
    protected ?int $totalTokens = null;

    protected array $businessParams = [];

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

    public function getModel(): string
    {
        return $this->model;
    }

    public function setModel(string $model): void
    {
        $this->model = $model;
    }

    public function getDurationSeconds(): int
    {
        return $this->durationSeconds;
    }

    public function setDurationSeconds(int $durationSeconds): void
    {
        $this->durationSeconds = max(0, $durationSeconds);
    }

    public function getResolution(): ?string
    {
        return $this->resolution;
    }

    public function setResolution(?string $resolution): void
    {
        $this->resolution = $resolution;
    }

    public function getSize(): ?string
    {
        return $this->size;
    }

    public function setSize(?string $size): void
    {
        $this->size = $size;
    }

    public function getWidth(): ?int
    {
        return $this->width;
    }

    public function setWidth(?int $width): void
    {
        $this->width = $width;
    }

    public function getHeight(): ?int
    {
        return $this->height;
    }

    public function setHeight(?int $height): void
    {
        $this->height = $height;
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

    public function getProjectId(): ?int
    {
        return $this->projectId;
    }

    public function setProjectId(?int $projectId): void
    {
        $this->projectId = $projectId;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getSourceId(): ?string
    {
        return $this->sourceId;
    }

    public function setSourceId(?string $sourceId): void
    {
        $this->sourceId = $sourceId;
    }

    public function getSourceType(): ImageGenerateSourceEnum
    {
        return $this->sourceType;
    }

    public function setSourceType(ImageGenerateSourceEnum $sourceType): void
    {
        $this->sourceType = $sourceType;
    }

    public function getProviderModelId(): string
    {
        return $this->providerModelId;
    }

    public function setProviderModelId(string $providerModelId): void
    {
        $this->providerModelId = $providerModelId;
    }

    public function getOriginalModelId(): ?string
    {
        return $this->originalModelId;
    }

    public function setOriginalModelId(?string $originalModelId): void
    {
        $this->originalModelId = $originalModelId;
    }

    public function getCompletionTokens(): ?int
    {
        return $this->completionTokens;
    }

    public function setCompletionTokens(?int $completionTokens): void
    {
        $this->completionTokens = $completionTokens !== null && $completionTokens > 0 ? $completionTokens : null;
    }

    public function getTotalTokens(): ?int
    {
        return $this->totalTokens;
    }

    public function setTotalTokens(?int $totalTokens): void
    {
        $this->totalTokens = $totalTokens !== null && $totalTokens > 0 ? $totalTokens : null;
    }

    public function getBusinessParams(): array
    {
        return $this->businessParams;
    }

    public function setBusinessParams(array $businessParams): void
    {
        $this->businessParams = $businessParams;
    }
}
