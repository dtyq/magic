<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Mapper;

class ModelFilter
{
    protected ?string $originModel = null;

    protected array $availableModelIds = [];

    public function __construct(
        protected bool $checkModelEnabled = true,
        protected bool $checkProviderEnabled = true,
        protected bool $checkVisiblePackage = true,
    ) {
    }

    public function isCheckModelEnabled(): bool
    {
        return $this->checkModelEnabled;
    }

    public function setCheckModelEnabled(bool $checkModelEnabled): void
    {
        $this->checkModelEnabled = $checkModelEnabled;
    }

    public function isCheckProviderEnabled(): bool
    {
        return $this->checkProviderEnabled;
    }

    public function setCheckProviderEnabled(bool $checkProviderEnabled): void
    {
        $this->checkProviderEnabled = $checkProviderEnabled;
    }

    public function getOriginModel(): ?string
    {
        return $this->originModel;
    }

    public function isCheckVisiblePackage(): bool
    {
        return $this->checkVisiblePackage;
    }

    public function setCheckVisiblePackage(bool $checkVisiblePackage): void
    {
        $this->checkVisiblePackage = $checkVisiblePackage;
    }

    public function setOriginModel(?string $originModel): void
    {
        $this->originModel = $originModel;
    }

    public function getAvailableModelIds(): array
    {
        return $this->availableModelIds;
    }

    public function setAvailableModelIds(array $availableModelIds): void
    {
        $this->availableModelIds = $availableModelIds;
    }
}
