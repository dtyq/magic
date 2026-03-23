<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\ModelCall\Entity;

use App\Infrastructure\Core\AbstractEntity;
use DateTime;

class AuditLogEntity extends AbstractEntity
{
    protected ?string $id = null;

    protected array $userInfo = [];

    protected string $ip = '';

    protected string $type = '';

    protected string $productCode = '';

    protected string $status = '';

    protected string $ak = '';

    protected int $operationTime = 0;

    protected int $allLatency = 0;

    protected array $usage = [];

    protected ?array $detailInfo = null;

    protected ?DateTime $createdAt = null;

    protected ?DateTime $updatedAt = null;

    public function getId(): ?string
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        $this->id = $id ? (string) $id : null;
    }

    public function getUserInfo(): array
    {
        return $this->userInfo;
    }

    public function setUserInfo(array $userInfo): void
    {
        $this->userInfo = $userInfo;
    }

    public function getIp(): string
    {
        return $this->ip;
    }

    public function setIp(string $ip): void
    {
        $this->ip = $ip;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function setType(string $type): void
    {
        $this->type = $type;
    }

    public function getProductCode(): string
    {
        return $this->productCode;
    }

    public function setProductCode(string $productCode): void
    {
        $this->productCode = $productCode;
    }

    public function getStatus(): string
    {
        return $this->status;
    }

    public function setStatus(string $status): void
    {
        $this->status = $status;
    }

    public function getAk(): string
    {
        return $this->ak;
    }

    public function setAk(string $ak): void
    {
        $this->ak = $ak;
    }

    public function getOperationTime(): int
    {
        return $this->operationTime;
    }

    public function setOperationTime(int $operationTime): void
    {
        $this->operationTime = $operationTime;
    }

    public function getAllLatency(): int
    {
        return $this->allLatency;
    }

    public function setAllLatency(int $allLatency): void
    {
        $this->allLatency = $allLatency;
    }

    public function getUsage(): array
    {
        return $this->usage;
    }

    public function setUsage(array $usage): void
    {
        $this->usage = $usage;
    }

    public function getDetailInfo(): ?array
    {
        return $this->detailInfo;
    }

    public function setDetailInfo(?array $detailInfo): void
    {
        $this->detailInfo = $detailInfo;
    }

    public function getCreatedAt(): ?DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(mixed $createdAt): void
    {
        $this->createdAt = $this->createDatetime($createdAt);
    }

    public function getUpdatedAt(): ?DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(mixed $updatedAt): void
    {
        $this->updatedAt = $this->createDatetime($updatedAt);
    }
}
