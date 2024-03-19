<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\Entity;

use App\Infrastructure\Core\AbstractEntity;
use DateTime;

/**
 * 管理员操作日志实体.
 */
class AdminOperationLogEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected ?string $organizationCode = null;

    protected ?string $userId = null;

    protected ?string $userName = null;

    // 资源和操作信息
    protected ?string $resourceCode = null;

    protected ?string $resourceLabel = null;

    protected ?string $operationCode = null;

    protected ?string $operationLabel = null;

    protected ?string $operationDescription = null;

    // 客户端信息
    protected ?string $ip = null;

    protected ?string $requestUrl = null;

    protected ?string $requestBody = null;

    // 时间戳
    protected ?DateTime $createdAt = null;

    protected ?DateTime $updatedAt = null;

    /**
     * 操作日志只增不改，始终返回 true.
     */
    public function shouldCreate(): bool
    {
        return true;
    }

    /**
     * 为创建准备实体.
     */
    public function prepareForCreation(): void
    {
        if (empty($this->createdAt)) {
            $this->createdAt = new DateTime();
        }
        if (empty($this->updatedAt)) {
            $this->updatedAt = new DateTime();
        }
        $this->id = null;
    }

    // Getters and Setters

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getOrganizationCode(): ?string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(?string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getUserId(): ?string
    {
        return $this->userId;
    }

    public function setUserId(?string $userId): void
    {
        $this->userId = $userId;
    }

    public function getUserName(): ?string
    {
        return $this->userName;
    }

    public function setUserName(?string $userName): void
    {
        $this->userName = $userName;
    }

    public function getResourceCode(): ?string
    {
        return $this->resourceCode;
    }

    public function setResourceCode(?string $resourceCode): void
    {
        $this->resourceCode = $resourceCode;
    }

    public function getResourceLabel(): ?string
    {
        return $this->resourceLabel;
    }

    public function setResourceLabel(?string $resourceLabel): void
    {
        $this->resourceLabel = $resourceLabel;
    }

    public function getOperationCode(): ?string
    {
        return $this->operationCode;
    }

    public function setOperationCode(?string $operationCode): void
    {
        $this->operationCode = $operationCode;
    }

    public function getOperationLabel(): ?string
    {
        return $this->operationLabel;
    }

    public function setOperationLabel(?string $operationLabel): void
    {
        $this->operationLabel = $operationLabel;
    }

    public function getOperationDescription(): ?string
    {
        return $this->operationDescription;
    }

    public function setOperationDescription(?string $operationDescription): void
    {
        $this->operationDescription = $operationDescription;
    }

    public function getIp(): ?string
    {
        return $this->ip;
    }

    public function setIp(?string $ip): void
    {
        $this->ip = $ip;
    }

    public function getRequestUrl(): ?string
    {
        return $this->requestUrl;
    }

    public function setRequestUrl(?string $requestUrl): void
    {
        $this->requestUrl = $requestUrl;
    }

    public function getRequestBody(): ?string
    {
        return $this->requestBody;
    }

    public function setRequestBody(?string $requestBody): void
    {
        $this->requestBody = $requestBody;
    }

    public function getCreatedAt(): ?DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(?DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): ?DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(?DateTime $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }
}
