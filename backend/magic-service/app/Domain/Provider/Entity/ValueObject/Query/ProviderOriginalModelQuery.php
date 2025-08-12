<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Entity\ValueObject\Query;

use App\Domain\Provider\Entity\ValueObject\ProviderOriginalModelType;

class ProviderOriginalModelQuery extends Query
{
    protected ?array $ids = null;

    protected ?string $modelId = null;

    protected ?ProviderOriginalModelType $type = null;

    public function getIds(): ?array
    {
        return $this->ids;
    }

    public function setIds(?array $ids): self
    {
        $this->ids = $ids;
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

    public function getType(): ?ProviderOriginalModelType
    {
        return $this->type;
    }

    public function setType(?ProviderOriginalModelType $type): self
    {
        $this->type = $type;
        return $this;
    }
}
