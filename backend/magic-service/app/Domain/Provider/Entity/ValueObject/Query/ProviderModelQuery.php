<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject\Query;

use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\Status;

class ProviderModelQuery extends Query
{
    protected ?Status $status = null;

    protected ?Category $category = null;

    protected ?ModelType $modelType = null;

    protected ?bool $superMagicDisplay = null;

    protected ?array $providerConfigIds = null;

    protected bool $isOffice = false;

    protected bool $isModelIdFilter = false;

    public function getSuperMagicDisplay(): ?bool
    {
        return $this->superMagicDisplay;
    }

    public function setSuperMagicDisplay(?bool $superMagicDisplay): void
    {
        $this->superMagicDisplay = $superMagicDisplay;
    }

    public function getProviderConfigIds(): ?array
    {
        return $this->providerConfigIds;
    }

    public function setProviderConfigIds(?array $providerConfigIds): void
    {
        $this->providerConfigIds = $providerConfigIds;
    }

    public function getCategory(): ?Category
    {
        return $this->category;
    }

    public function setCategory(null|Category|string $category): void
    {
        if (is_null($category)) {
            return;
        }
        $this->category = $category instanceof Category ? $category : Category::from($category);
    }

    public function getStatus(): ?Status
    {
        return $this->status;
    }

    public function setStatus(null|int|Status $status): self
    {
        if (is_null($status)) {
            return $this;
        }
        $this->status = $status instanceof Status ? $status : Status::from($status);
        return $this;
    }

    public function getModelType(): ?ModelType
    {
        return $this->modelType;
    }

    public function setModelType(?ModelType $modelType): void
    {
        $this->modelType = $modelType;
    }

    public function isOffice(): bool
    {
        return $this->isOffice;
    }

    public function setIsOffice(bool $isOffice): void
    {
        $this->isOffice = $isOffice;
    }

    public function isModelIdFilter(): bool
    {
        return $this->isModelIdFilter;
    }

    public function setIsModelIdFilter(bool $isModelIdFilter): void
    {
        $this->isModelIdFilter = $isModelIdFilter;
    }
}
