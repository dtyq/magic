<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity;

use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
use App\Domain\ModelGateway\Entity\ValueObject\Amount;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use DateTime;

class AccessTokenEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $organizationCode;

    protected AccessTokenType $type;

    protected string $accessToken;

    protected string $relationId;

    protected string $name;

    protected string $description = '';

    protected array $models;

    protected array $ipLimit = [];

    protected ?DateTime $expireTime = null;

    protected float $totalAmount = 0;

    protected float $useAmount = 0;

    protected int $rpm = 0;

    protected string $creator;

    protected string $modifier;

    protected DateTime $createdAt;

    protected DateTime $updatedAt;

    public function shouldCreate(): bool
    {
        return empty($this->id);
    }

    public function prepareForCreation(): void
    {
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'organization_code']);
        }
        if (empty($this->type)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'type']);
        }
        if (empty($this->relationId)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'relation_id']);
        }
        if (empty($this->name)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'name']);
        }
        if (empty($this->models)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'models']);
        }
        if (empty($this->creator)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'creator']);
        }
        if (empty($this->createdAt)) {
            $this->createdAt = new DateTime();
        }
        $this->accessToken = IdGenerator::getUniqueId32();

        $this->modifier = $this->creator;
        $this->updatedAt = $this->createdAt;
        $this->id = null;
    }

    public function prepareForModification(AccessTokenEntity $accessTokenEntity): void
    {
        $accessTokenEntity->setName($this->name);
        $accessTokenEntity->setDescription($this->description);
        $accessTokenEntity->setModels($this->models);
        $accessTokenEntity->setIpLimit($this->ipLimit);
        $accessTokenEntity->setExpireTime($this->expireTime);
        $accessTokenEntity->setTotalAmount($this->totalAmount);
        $accessTokenEntity->setRpm($this->rpm);

        if (empty($this->creator)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'creator']);
        }
        if (empty($this->createdAt)) {
            $this->createdAt = new DateTime();
        }

        $accessTokenEntity->setModifier($this->creator);
        $accessTokenEntity->setUpdatedAt($this->createdAt);
    }

    public function checkModel(string $model): void
    {
        if (in_array('all', $this->models)) {
            return;
        }
        if (! in_array($model, $this->models)) {
            ExceptionBuilder::throw(MagicApiErrorCode::MODEL_NOT_SUPPORT);
        }
    }

    public function checkIps(array $ips): void
    {
        if (empty($this->ipLimit)) {
            return;
        }
        if (! empty($ips)) {
            foreach ($ips as $ip) {
                // 只要有一个符合就行
                if (in_array($ip, $this->ipLimit, true)) {
                    return;
                }
            }
        }

        ExceptionBuilder::throw(MagicApiErrorCode::TOKEN_IP_NOT_IN_WHITE_LIST);
    }

    public function checkExpiredTime(DateTime $now): void
    {
        if ($this->expireTime && $this->expireTime->getTimestamp() < $now->getTimestamp()) {
            ExceptionBuilder::throw(MagicApiErrorCode::TOKEN_EXPIRED);
        }
    }

    public function checkRpm(): void
    {
        if ($this->rpm <= 0) {
            return;
        }

        ExceptionBuilder::throw(MagicApiErrorCode::RATE_LIMIT);
    }

    public function checkAmount(): void
    {
        if (! Amount::isEnough($this->totalAmount, $this->useAmount)) {
            ExceptionBuilder::throw(MagicApiErrorCode::TOKEN_QUOTA_NOT_ENOUGH);
        }
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        $this->id = $id ? (int) $id : null;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getType(): AccessTokenType
    {
        return $this->type;
    }

    public function setType(AccessTokenType $type): void
    {
        $this->type = $type;
    }

    public function getAccessToken(): string
    {
        return $this->accessToken;
    }

    public function setAccessToken(string $accessToken): void
    {
        $this->accessToken = $accessToken;
    }

    public function getRelationId(): string
    {
        return $this->relationId;
    }

    public function setRelationId(string $relationId): void
    {
        $this->relationId = $relationId;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(string $description): void
    {
        $this->description = $description;
    }

    public function getModels(): array
    {
        return $this->models;
    }

    public function setModels(array $models): void
    {
        $this->models = $models;
    }

    public function getIpLimit(): array
    {
        return $this->ipLimit;
    }

    public function setIpLimit(array $ipLimit): void
    {
        $this->ipLimit = $ipLimit;
    }

    public function getExpireTime(): ?DateTime
    {
        return $this->expireTime;
    }

    public function setExpireTime(mixed $expireTime): void
    {
        $this->expireTime = $this->createDatetime($expireTime);
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

    public function getCreator(): string
    {
        return $this->creator;
    }

    public function setCreator(string $creator): void
    {
        $this->creator = $creator;
    }

    public function getModifier(): string
    {
        return $this->modifier;
    }

    public function setModifier(string $modifier): void
    {
        $this->modifier = $modifier;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(mixed $createdAt): void
    {
        $this->createdAt = $this->createDatetime($createdAt);
    }

    public function getUpdatedAt(): DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(mixed $updatedAt): void
    {
        $this->updatedAt = $this->createDatetime($updatedAt);
    }
}
