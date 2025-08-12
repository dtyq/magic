<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject\Query;

use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\Status;

class ProviderModelFindQuery extends Query
{
    protected ?int $providerConfigId = null;

    protected ?int $modelParentId = null;

    protected ?bool $isOffice = null;

    protected ?Status $status = null;

    protected ?Category $category = null;

    protected ?ModelType $modelType = null;

    protected ?string $modelId = null;

    public function getProviderConfigId(): ?int
    {
        return $this->providerConfigId;
    }

    public function setProviderConfigId(?int $providerConfigId): self
    {
        $this->providerConfigId = $providerConfigId;
        return $this;
    }

    public function getModelParentId(): ?int
    {
        return $this->modelParentId;
    }

    public function setModelParentId(?int $modelParentId): self
    {
        $this->modelParentId = $modelParentId;
        return $this;
    }

    public function getIsOffice(): ?bool
    {
        return $this->isOffice;
    }

    public function setIsOffice(?bool $isOffice): self
    {
        $this->isOffice = $isOffice;
        return $this;
    }

    public function getStatus(): ?Status
    {
        return $this->status;
    }

    public function setStatus(?Status $status): self
    {
        $this->status = $status;
        return $this;
    }

    public function getCategory(): ?Category
    {
        return $this->category;
    }

    public function setCategory(?Category $category): self
    {
        $this->category = $category;
        return $this;
    }

    public function getModelType(): ?ModelType
    {
        return $this->modelType;
    }

    public function setModelType(?ModelType $modelType): self
    {
        $this->modelType = $modelType;
        return $this;
    }

    public function getModelId(): ?string
    {
        return $this->modelId;
    }

    public function setModelId(?string $modelId): self
    {
        $this->modelId = $modelId;
        return $this;
    }
}
