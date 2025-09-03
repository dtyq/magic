<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\DTO;

use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\Kernel\DTO\Traits\OperatorDTOTrait;

class AccessTokenDTO extends AbstractDTO
{
    use OperatorDTOTrait;

    public ?string $id = null;

    public ?string $type = null;

    public ?string $accessToken = null;

    public ?string $relationId = null;

    public ?string $name = null;

    public ?string $description = null;

    public ?array $models = null;

    public ?array $ipLimit = null;

    public ?string $expireTime = null;

    public ?float $totalAmount = null;

    public ?float $useAmount = null;

    public ?int $rpm = null;

    public function setId(null|int|string $id): void
    {
        $this->id = $id ? (string) $id : null;
    }

    public function setType(?string $type): void
    {
        $this->type = $type;
    }

    public function setAccessToken(?string $accessToken): void
    {
        $this->accessToken = $accessToken;
    }

    public function getExpireTime(): ?string
    {
        return $this->expireTime;
    }

    public function setRelationId(?string $relationId): void
    {
        $this->relationId = $relationId;
    }

    public function setName(?string $name): void
    {
        $this->name = $name;
    }

    public function setDescription(?string $description): void
    {
        $this->description = $description;
    }

    public function setModels(?array $models): void
    {
        $this->models = $models;
    }

    public function setIpLimit(?array $ipLimit): void
    {
        $this->ipLimit = $ipLimit;
    }

    public function setExpireTime(mixed $expireTime): void
    {
        $this->expireTime = $this->createDateTimeString($expireTime);
    }

    public function setTotalAmount(?float $totalAmount): void
    {
        $this->totalAmount = $totalAmount;
    }

    public function setUseAmount(?float $useAmount): void
    {
        $this->useAmount = $useAmount;
    }

    public function setRpm(?int $rpm): void
    {
        $this->rpm = $rpm;
    }

    public function getId(): ?string
    {
        return $this->id;
    }

    public function getType(): ?string
    {
        return $this->type;
    }

    public function getAccessToken(): ?string
    {
        return $this->accessToken;
    }

    public function getRelationId(): ?string
    {
        return $this->relationId;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function getDescription(): ?string
    {
        return $this->description;
    }

    public function getModels(): ?array
    {
        return $this->models;
    }

    public function getIpLimit(): ?array
    {
        return $this->ipLimit;
    }

    public function getTotalAmount(): ?float
    {
        return $this->totalAmount;
    }

    public function getUseAmount(): ?float
    {
        return $this->useAmount;
    }

    public function getRpm(): ?int
    {
        return $this->rpm;
    }
}
