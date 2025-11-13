<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity;

use App\Domain\Provider\DTO\AiAbilityConfig;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Infrastructure\Core\AbstractEntity;

/**
 * AI 能力实体.
 */
class AiAbilityEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected AiAbilityCode $code;

    protected string $organizationCode = '';

    protected array $name = [];

    protected array $description = [];

    protected string $icon;

    protected int $sortOrder;

    protected Status $status;

    protected AiAbilityConfig $config;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        if (is_numeric($id)) {
            $this->id = (int) $id;
        } else {
            $this->id = null;
        }
    }

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

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getName(): array
    {
        return $this->name;
    }

    public function setName(array|string $name): void
    {
        if (is_string($name)) {
            // 如果是字符串，尝试解析JSON
            $decoded = json_decode($name, true);
            $this->name = is_array($decoded) ? $decoded : [];
        } else {
            $this->name = $name;
        }
    }

    /**
     * 获取当前语言的名称.
     */
    public function getLocalizedName(?string $locale = null): string
    {
        $locale = $locale ?? config('translation.locale', 'zh_CN');
        return $this->name[$locale] ?? $this->name['zh_CN'] ?? $this->name['en_US'] ?? '';
    }

    public function getDescription(): array
    {
        return $this->description;
    }

    public function setDescription(array|string $description): void
    {
        if (is_string($description)) {
            // 如果是字符串，尝试解析JSON
            $decoded = json_decode($description, true);
            $this->description = is_array($decoded) ? $decoded : [];
        } else {
            $this->description = $description;
        }
    }

    /**
     * 获取当前语言的描述.
     */
    public function getLocalizedDescription(?string $locale = null): string
    {
        $locale = $locale ?? config('translation.locale', 'zh_CN');
        return $this->description[$locale] ?? $this->description['zh_CN'] ?? $this->description['en_US'] ?? '';
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
