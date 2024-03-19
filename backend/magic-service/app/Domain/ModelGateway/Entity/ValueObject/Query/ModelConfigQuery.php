<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject\Query;

use App\Infrastructure\Core\ValueObject\Query;

class ModelConfigQuery extends Query
{
    protected ?bool $enabled = null;

    public function getEnabled(): ?bool
    {
        return $this->enabled;
    }

    public function setEnabled(?bool $enabled): void
    {
        $this->enabled = $enabled;
    }
}
