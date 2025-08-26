<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity;

use App\Domain\Provider\DTO\Item\ProviderConfigItem;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Infrastructure\Core\AbstractEntity;
use DateTime;
use Hyperf\Codec\Json;

class ProviderConfigEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected int $serviceProviderId;

    protected string $organizationCode;

    protected ?ProviderConfigItem $config = null;

    protected Status $status;

    protected string $alias = '';

    protected array $translate = [];

    protected DateTime $createdAt;

    protected DateTime $updatedAt;

    protected ?DateTime $deletedAt = null;

    protected int $sort = 0;

    private ?ProviderCode $providerCode = null;

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

    public function getServiceProviderId(): int
    {
        return $this->serviceProviderId;
    }

    public function setServiceProviderId(null|int|string $serviceProviderId): void
    {
        if (is_numeric($serviceProviderId)) {
            $this->serviceProviderId = (int) $serviceProviderId;
        } else {
            $this->serviceProviderId = 0;
        }
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(null|int|string $organizationCode): void
    {
        if ($organizationCode === null) {
            $this->organizationCode = '';
        } else {
            $this->organizationCode = (string) $organizationCode;
        }
    }

    public function getConfig(): ?ProviderConfigItem
    {
        return $this->config ?? null;
    }

    public function setConfig(null|array|ProviderConfigItem|string $config): void
    {
        if ($config === null) {
            $this->config = null;
        } elseif (is_string($config)) {
            $decoded = Json::decode($config);
            $this->config = new ProviderConfigItem(is_array($decoded) ? $decoded : []);
        } elseif ($config instanceof ProviderConfigItem) {
            $this->config = $config;
        } else {
            $this->config = new ProviderConfigItem($config);
        }
    }

    public function getStatus(): Status
    {
        return $this->status;
    }

    public function setStatus(null|int|Status|string $status): void
    {
        if ($status === null || $status === '') {
            $this->status = Status::Disabled;
        } elseif ($status instanceof Status) {
            $this->status = $status;
        } else {
            $this->status = Status::from((int) $status);
        }
    }

    public function getAlias(): string
    {
        return $this->alias;
    }

    /**
     * 获取本地化的服务商名称.
     */
    public function getLocalizedAlias(string $locale): string
    {
        $alias = $this->translate['alias'][$locale]
            ?? $this->translate['alias']['zh_CN']
            ?? $this->translate['alias']['en_US']
            ?? $this->alias;
        if ($alias) {
            $alias = $this->alias;
        }
        if (empty($alias)) {
            return $locale === 'zh_CN' ? '自定义服务商' : 'Custom Provider';
        }
        return $alias;
    }

    public function setAlias(null|int|string $alias): void
    {
        if ($alias === null) {
            $this->alias = '';
        } else {
            $this->alias = (string) $alias;
        }
    }

    public function getTranslate(): array
    {
        return $this->translate;
    }

    public function setTranslate(null|array|string $translate): void
    {
        if ($translate === null) {
            $this->translate = [];
        } elseif (is_string($translate)) {
            $decoded = Json::decode($translate);
            $this->translate = is_array($decoded) ? $decoded : [];
        } else {
            $this->translate = $translate;
        }
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(null|DateTime|string $createdAt): void
    {
        if ($createdAt === null) {
            $this->createdAt = new DateTime();
        } else {
            $this->createdAt = $createdAt instanceof DateTime ? $createdAt : new DateTime($createdAt);
        }
    }

    public function getUpdatedAt(): DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(null|DateTime|string $updatedAt): void
    {
        if ($updatedAt === null) {
            $this->updatedAt = new DateTime();
        } else {
            $this->updatedAt = $updatedAt instanceof DateTime ? $updatedAt : new DateTime($updatedAt);
        }
    }

    public function getDeletedAt(): ?DateTime
    {
        return $this->deletedAt;
    }

    public function setDeletedAt(null|DateTime|string $deletedAt): void
    {
        if ($deletedAt === null) {
            $this->deletedAt = null;
        } else {
            $this->deletedAt = $deletedAt instanceof DateTime ? $deletedAt : new DateTime($deletedAt);
        }
    }

    public function getProviderCode(): ?ProviderCode
    {
        return $this->providerCode;
    }

    public function setProviderCode(null|int|ProviderCode|string $providerCode): void
    {
        if ($providerCode === null || $providerCode === '') {
            $this->providerCode = null;
        } elseif ($providerCode instanceof ProviderCode) {
            $this->providerCode = $providerCode;
        } else {
            $this->providerCode = ProviderCode::from((string) $providerCode);
        }
    }

    public function getImplementation(): ?string
    {
        return $this->providerCode?->getImplementation();
    }

    public function getActualImplementationConfig(): array
    {
        if (! $this->config || ! $this->providerCode) {
            return [];
        }
        return $this->providerCode->getImplementationConfig($this->config);
    }

    public function isActive(): bool
    {
        return $this->getStatus()->isEnabled();
    }

    public function enable(): void
    {
        $this->status = Status::Enabled;
    }

    public function disable(): void
    {
        $this->status = Status::Disabled;
    }

    public function getSort(): int
    {
        return $this->sort;
    }

    public function setSort(null|int|string $sort): void
    {
        if ($sort === null) {
            $this->sort = 0;
        } else {
            $this->sort = (int) $sort;
        }
    }

    public function i18n(string $languages): void
    {
        if (isset($this->translate['alias'][$languages])) {
            $this->alias = $this->translate['alias'][$languages];
        }
    }
}
