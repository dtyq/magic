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

    public function getCategory(): ?Category
    {
        return $this->category;
    }

    public function setCategory(?Category $category): void
    {
        $this->category = $category;
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

    public function getModelType(): ?ModelType
    {
        return $this->modelType;
    }

    public function setModelType(?ModelType $modelType): void
    {
        $this->modelType = $modelType;
    }
}
