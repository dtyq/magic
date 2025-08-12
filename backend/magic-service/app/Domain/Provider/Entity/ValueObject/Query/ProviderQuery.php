<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject\Query;

use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderType;
use App\Domain\Provider\Entity\ValueObject\Status;

class ProviderQuery extends Query
{
    protected ?Category $category = null;

    protected ?Status $status = null;

    protected ?ProviderCode $providerCode = null;

    protected ?ProviderType $providerType = null;

    public function getCategory(): ?Category
    {
        return $this->category;
    }

    public function setCategory(?Category $category): self
    {
        $this->category = $category;
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

    public function getProviderCode(): ?ProviderCode
    {
        return $this->providerCode;
    }

    public function setProviderCode(?ProviderCode $providerCode): self
    {
        $this->providerCode = $providerCode;
        return $this;
    }

    public function getProviderType(): ?ProviderType
    {
        return $this->providerType;
    }

    public function setProviderType(?ProviderType $providerType): self
    {
        $this->providerType = $providerType;
        return $this;
    }
}
