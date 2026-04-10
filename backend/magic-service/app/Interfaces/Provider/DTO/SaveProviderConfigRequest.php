<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\DTO;

use App\Infrastructure\Core\AbstractDTO;

class SaveProviderConfigRequest extends AbstractDTO
{
    protected string $id = '';

    protected string $alias;

    protected array $config = [];

    protected ?string $serviceProviderId = null;

    protected ?int $status = null;

    protected array $translate;

    protected int $sort = 0;

    public function getId(): string
    {
        return $this->id;
    }

    public function setId(null|int|string $id): void
    {
        $this->id = $id === null ? '' : (string) $id;
    }

    public function getAlias(): string
    {
        return $this->alias;
    }

    public function setAlias(string $alias): void
    {
        $this->alias = $alias;
    }

    public function getConfig(): array
    {
        return $this->config;
    }

    public function setConfig(array $config): void
    {
        $this->config = $config;
    }

    public function getServiceProviderId(): ?string
    {
        return $this->serviceProviderId;
    }

    public function setServiceProviderId(?string $serviceProviderId): void
    {
        $this->serviceProviderId = $serviceProviderId;
    }

    public function getStatus(): ?int
    {
        return $this->status;
    }

    public function setStatus(?int $status): void
    {
        $this->status = $status;
    }

    public function getTranslate(): array
    {
        return $this->translate;
    }

    public function setTranslate(array $translate): void
    {
        $this->translate = $translate;
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
}
