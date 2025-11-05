<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity;

use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\AiAbilityConfig;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Infrastructure\Core\AbstractEntity;

/**
 * AI 能力实体.
 */
class AiAbilityEntity extends AbstractEntity
{
    protected AiAbilityCode $code;

    protected string $name;

    protected string $description;

    protected string $icon;

    protected int $sortOrder;

    protected Status $status;

    protected AiAbilityConfig $config;

    public function getCode(): AiAbilityCode
    {
        return $this->code;
    }

    public function setCode(null|AiAbilityCode|string $code): void
    {
        if ($code === null || $code === '') {
            $this->code = AiAbilityCode::Ocr;
        } elseif ($code instanceof AiAbilityCode) {
            $this->code = $code;
        } else {
            $this->code = AiAbilityCode::from($code);
        }
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(null|int|string $name): void
    {
        if ($name === null) {
            $this->name = '';
        } else {
            $this->name = (string) $name;
        }
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(null|int|string $description): void
    {
        if ($description === null) {
            $this->description = '';
        } else {
            $this->description = (string) $description;
        }
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(null|int|string $icon): void
    {
        if ($icon === null) {
            $this->icon = '';
        } else {
            $this->icon = (string) $icon;
        }
    }

    public function getSortOrder(): int
    {
        return $this->sortOrder;
    }

    public function setSortOrder(null|int|string $sortOrder): void
    {
        if ($sortOrder === null) {
            $this->sortOrder = 0;
        } else {
            $this->sortOrder = (int) $sortOrder;
        }
    }

    public function getStatus(): Status
    {
        return $this->status;
    }

    public function setStatus(null|bool|int|Status|string $status): void
    {
        if ($status === null || $status === '') {
            $this->status = Status::Enabled;
        } elseif ($status instanceof Status) {
            $this->status = $status;
        } elseif (is_bool($status)) {
            $this->status = $status ? Status::Enabled : Status::Disabled;
        } else {
            $this->status = Status::from((int) $status);
        }
    }

    public function getConfig(): AiAbilityConfig
    {
        return $this->config;
    }

    public function setConfig(AiAbilityConfig|array|string $config): void
    {
        if ($config instanceof AiAbilityConfig) {
            $this->config = $config;
        } elseif (is_string($config)) {
            $configArray = json_decode($config, true) ?: [];
            $this->config = new AiAbilityConfig($configArray);
        } else {
            $this->config = new AiAbilityConfig($config);
        }
    }

    /**
     * 判断能力是否启用.
     */
    public function isEnabled(): bool
    {
        return $this->status->isEnabled();
    }
}
