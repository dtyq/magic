<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Event;

use App\Domain\ImageGenerate\ValueObject\ImageGenerateSourceEnum;
use App\Infrastructure\Core\AbstractEvent;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use DateTime;

class ImageOperationCompletedEvent extends AbstractEvent
{
    public const string OPERATION_REMOVE_BACKGROUND = 'image_remove_background';

    public const string OPERATION_ERASER = 'image_eraser';

    public const string OPERATION_EXPAND = 'image_expand';

    protected ?string $eventId = null;

    protected string $organizationCode;

    protected string $userId;

    protected string $operationType;

    protected string $provider = '';

    protected int $imageCount = 1;

    protected ?string $originalModelId = null;

    protected ?string $callTime = null;

    protected ?int $responseTime = null;

    protected ?string $topicId = null;

    protected ?string $taskId = null;

    protected ?int $accessTokenId = null;

    protected ?string $accessTokenName = null;

    protected ?string $sourceId = null;

    protected DateTime $createdAt;

    protected ImageGenerateSourceEnum $sourceType;

    protected array $businessParams = [];

    /**
     * @var array<int, array{url: string}>
     */
    protected array $generatedImages = [];

    public function __construct(?string $eventId = null)
    {
        $this->eventId = $eventId ?: (string) IdGenerator::getSnowId();
    }

    public function getEventId(): string
    {
        return $this->eventId ??= (string) ($this->businessParams['event_id'] ?? IdGenerator::getSnowId());
    }

    /**
     * @return array<int, array{url: string}>
     */
    public function getGeneratedImages(): array
    {
        return $this->generatedImages;
    }

    public function setGeneratedImages(array $generatedImages): void
    {
        $this->generatedImages = [];
        foreach ($generatedImages as $image) {
            $url = is_string($image) ? $image : ($image['url'] ?? '');
            if (! is_string($url) || $url === '' || str_starts_with($url, 'data:')) {
                continue;
            }

            $this->generatedImages[] = ['url' => $url];
        }
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

    public function getOperationType(): string
    {
        return $this->operationType;
    }

    public function setOperationType(string $operationType): void
    {
        $this->operationType = $operationType;
    }

    public function getProvider(): string
    {
        return $this->provider;
    }

    public function setProvider(string $provider): void
    {
        $this->provider = $provider;
    }

    public function getImageCount(): int
    {
        return $this->imageCount;
    }

    public function setImageCount(int $imageCount): void
    {
        $this->imageCount = $imageCount;
    }

    public function getOriginalModelId(): ?string
    {
        return $this->originalModelId;
    }

    public function setOriginalModelId(?string $originalModelId): void
    {
        $this->originalModelId = $originalModelId;
    }

    public function getCallTime(): ?string
    {
        return $this->callTime;
    }

    public function setCallTime(?string $callTime): void
    {
        $this->callTime = $callTime;
    }

    public function getResponseTime(): ?int
    {
        return $this->responseTime;
    }

    public function setResponseTime(?int $responseTime): void
    {
        $this->responseTime = $responseTime;
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

    public function getAccessTokenId(): ?int
    {
        return $this->accessTokenId;
    }

    public function setAccessTokenId(?int $accessTokenId): void
    {
        $this->accessTokenId = $accessTokenId;
    }

    public function getAccessTokenName(): ?string
    {
        return $this->accessTokenName;
    }

    public function setAccessTokenName(?string $accessTokenName): void
    {
        $this->accessTokenName = $accessTokenName;
    }

    public function getSourceId(): ?string
    {
        return $this->sourceId;
    }

    public function setSourceId(?string $sourceId): void
    {
        $this->sourceId = $sourceId;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getSourceType(): ImageGenerateSourceEnum
    {
        return $this->sourceType;
    }

    public function setSourceType(ImageGenerateSourceEnum $sourceType): void
    {
        $this->sourceType = $sourceType;
    }

    public function getBusinessParams(): array
    {
        return $this->businessParams;
    }

    public function setBusinessParams(array $businessParams): void
    {
        $this->businessParams = $businessParams;
        if (! empty($businessParams['event_id'])) {
            $this->eventId = (string) $businessParams['event_id'];
        }
    }
}
