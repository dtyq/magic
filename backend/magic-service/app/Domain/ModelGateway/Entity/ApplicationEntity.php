<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity;

use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;

class ApplicationEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $organizationCode;

    protected string $code;

    protected string $name;

    protected string $description = '';

    protected string $icon = '';

    protected string $creator;

    protected DateTime $createdAt;

    protected string $modifier;

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
        if (empty($this->code)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'code']);
        }
        if (empty($this->name)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'name']);
        }
        if (empty($this->creator)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'creator']);
        }
        if (empty($this->createdAt)) {
            $this->createdAt = new DateTime();
        }
        $this->modifier = $this->creator;
        $this->updatedAt = $this->createdAt;
        $this->id = null;
    }

    public function prepareForModification(ApplicationEntity $LLMApplicationEntity): void
    {
        if (isset($this->name)) {
            $LLMApplicationEntity->setName($this->name);
        }
        if (isset($this->description)) {
            $LLMApplicationEntity->setDescription($this->description);
        }
        if (isset($this->icon)) {
            $LLMApplicationEntity->setIcon($this->icon);
        }
        if (empty($this->creator)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => 'creator']);
        }
        if (empty($this->createdAt)) {
            $this->createdAt = new DateTime();
        }

        $LLMApplicationEntity->setModifier($this->creator);
        $LLMApplicationEntity->setUpdatedAt($this->createdAt);
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

    public function getCode(): string
    {
        return $this->code;
    }

    public function setCode(string $code): void
    {
        $this->code = $code;
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

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(string $icon): void
    {
        $this->icon = $icon;
    }

    public function getCreator(): string
    {
        return $this->creator;
    }

    public function setCreator(string $creator): void
    {
        $this->creator = $creator;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(mixed $createdAt): void
    {
        $this->createdAt = $this->createDatetime($createdAt);
    }

    public function getModifier(): string
    {
        return $this->modifier;
    }

    public function setModifier(string $modifier): void
    {
        $this->modifier = $modifier;
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
