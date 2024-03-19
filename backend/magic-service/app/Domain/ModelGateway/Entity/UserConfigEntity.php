<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity;

use App\Infrastructure\Core\AbstractEntity;
use DateTime;

class UserConfigEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $userId;

    /**
     * 个人版为空.
     */
    protected string $appCode = '';

    /**
     * 个人版为空.
     */
    protected string $organizationCode = '';

    protected float $totalAmount = 0;

    protected float $useAmount = 0;

    protected int $rpm = 0;

    protected DateTime $createdAt;

    protected DateTime $updatedAt;

    public function checkRpm(): void
    {
        //        if ($this->rpm <= 0) {
        //            return;
        //        }
        //
        //        ExceptionBuilder::throw(MagicApiErrorCode::RATE_LIMIT);
    }

    public function checkAmount(): void
    {
        //        if (! Amount::isEnough($this->totalAmount, $this->useAmount)) {
        //            ExceptionBuilder::throw(MagicApiErrorCode::TOKEN_QUOTA_NOT_ENOUGH);
        //        }
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
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

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getTotalAmount(): float
    {
        return $this->totalAmount;
    }

    public function setTotalAmount(float $totalAmount): void
    {
        $this->totalAmount = $totalAmount;
    }

    public function getUseAmount(): float
    {
        return $this->useAmount;
    }

    public function setUseAmount(float $useAmount): void
    {
        $this->useAmount = $useAmount;
    }

    public function getRpm(): int
    {
        return $this->rpm;
    }

    public function setRpm(int $rpm): void
    {
        $this->rpm = $rpm;
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
}
