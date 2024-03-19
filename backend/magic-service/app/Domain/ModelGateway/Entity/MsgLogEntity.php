<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity;

use App\Infrastructure\Core\AbstractEntity;
use DateTime;

class MsgLogEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected float $useAmount;

    protected int $useToken;

    protected string $model;

    protected string $userId;

    protected string $appCode;

    protected string $organizationCode;

    protected string $businessId = '';

    protected string $sourceId = '';

    protected string $userName = '';

    protected string $accessTokenId = '';

    protected string $providerId = '';

    protected string $providerModelId = '';

    protected int $promptTokens = 0;

    protected int $completionTokens = 0;

    protected int $cacheWriteTokens = 0;

    protected int $cacheReadTokens = 0;

    protected DateTime $createdAt;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        $this->id = $id ? (int) $id : null;
    }

    public function getUseAmount(): float
    {
        return $this->useAmount;
    }

    public function setUseAmount(float $useAmount): void
    {
        $this->useAmount = $useAmount;
    }

    public function getUseToken(): int
    {
        return $this->useToken;
    }

    public function setUseToken(int $useToken): void
    {
        $this->useToken = $useToken;
    }

    public function getBusinessId(): string
    {
        return $this->businessId;
    }

    public function setBusinessId(string $businessId): void
    {
        $this->businessId = $businessId;
    }

    public function getModel(): string
    {
        return $this->model;
    }

    public function setModel(string $model): void
    {
        $this->model = $model;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getAppCode(): string
    {
        return $this->appCode;
    }

    public function setAppCode(string $appCode): void
    {
        $this->appCode = $appCode;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getSourceId(): string
    {
        return $this->sourceId;
    }

    public function setSourceId(string $sourceId): void
    {
        $this->sourceId = $sourceId;
    }

    public function getUserName(): string
    {
        return $this->userName;
    }

    public function setUserName(string $userName): void
    {
        $this->userName = $userName;
    }

    public function getAccessTokenId(): string
    {
        return $this->accessTokenId;
    }

    public function setAccessTokenId(int|string $accessTokenId): void
    {
        $this->accessTokenId = (string) $accessTokenId;
    }

    public function getProviderId(): string
    {
        return $this->providerId;
    }

    public function setProviderId(int|string $providerId): void
    {
        $this->providerId = (string) $providerId;
    }

    public function getProviderModelId(): string
    {
        return $this->providerModelId;
    }

    public function setProviderModelId(int|string $providerModelId): void
    {
        $this->providerModelId = (string) $providerModelId;
    }

    public function getPromptTokens(): int
    {
        return $this->promptTokens;
    }

    public function setPromptTokens(int $promptTokens): void
    {
        $this->promptTokens = $promptTokens;
    }

    public function getCompletionTokens(): int
    {
        return $this->completionTokens;
    }

    public function setCompletionTokens(int $completionTokens): void
    {
        $this->completionTokens = $completionTokens;
    }

    public function getCacheWriteTokens(): int
    {
        return $this->cacheWriteTokens;
    }

    public function setCacheWriteTokens(int $cacheWriteTokens): void
    {
        $this->cacheWriteTokens = $cacheWriteTokens;
    }

    public function getCacheReadTokens(): int
    {
        return $this->cacheReadTokens;
    }

    public function setCacheReadTokens(int $cacheReadTokens): void
    {
        $this->cacheReadTokens = $cacheReadTokens;
    }
}
