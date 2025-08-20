<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\DTO;

use App\Domain\Provider\DTO\Item\ProviderConfigItem;
use App\Infrastructure\Core\AbstractDTO;

class CreateProviderConfigRequest extends AbstractDTO
{
    protected string $alias;

    protected ProviderConfigItem $config;

    protected string $serviceProviderId;

    protected int $status;

    protected array $translate;

    protected int $sort = 0;

    public function getAlias(): string
    {
        return $this->alias;
    }

    public function setAlias(string $alias): void
    {
        $this->alias = $alias;
    }

    public function getConfig(): ProviderConfigItem
    {
        return $this->config;
    }

    public function setConfig(array|ProviderConfigItem $config): void
    {
        $this->config = $config instanceof ProviderConfigItem ? $config : new ProviderConfigItem($config);
    }

    public function getServiceProviderId(): string
    {
        return $this->serviceProviderId;
    }

    public function setServiceProviderId(string $serviceProviderId): void
    {
        $this->serviceProviderId = $serviceProviderId;
    }

    public function getStatus(): int
    {
        return $this->status;
    }

    public function setStatus(int $status): void
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
