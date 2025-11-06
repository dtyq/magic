<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Event;

use App\Domain\ImageGenerate\ValueObject\ImageGenerateSourceEnum;
use App\Infrastructure\Core\AbstractEvent;
use DateTime;

class ImageGeneratedEvent extends AbstractEvent
{
    protected string $organizationCode;

    protected string $userId;

    protected string $model;

    protected int $imageCount;

    protected ?string $topicId = null;

    protected ?string $taskId = null;

    protected DateTime $createdAt;

    protected ?string $sourceId = null;

    protected ImageGenerateSourceEnum $sourceType;

    /**
     * service_provider_models.id 模型ID.
     */
    protected string $providerModelId = '';

    /**
     * 访问令牌实体Id.
     */
    protected ?int $accessTokenId = null;

    /**
     * 访问令牌实体名称.
     */
    protected ?string $accessTokenName = null;

    /**
     * 当前配置版本，用于计价
     * service_provider_models_config_versions.id.
     */
    protected ?int $priceId = null;

    /**
     * 调用时间.
     */
    protected ?string $callTime = null;

    /**
     * 响应时间.
     */
    protected ?int $responseTime = null;

    public function getProviderModelId(): string
    {
        return $this->providerModelId;
    }

    public function setProviderModelId(string $providerModelId): void
    {
        $this->providerModelId = $providerModelId;
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

    public function getPriceId(): ?int
    {
        return $this->priceId;
    }

    public function setPriceId(?int $priceId): void
    {
        $this->priceId = $priceId;
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

    public function getImageCount(): int
    {
        return $this->imageCount;
    }

    public function setImageCount(int $imageCount): void
    {
        $this->imageCount = $imageCount;
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
}
