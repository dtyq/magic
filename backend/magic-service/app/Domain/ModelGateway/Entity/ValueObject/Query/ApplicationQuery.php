<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject\Query;

use App\Infrastructure\Core\ValueObject\Query;

class ApplicationQuery extends Query
{
    private ?string $creator = null;

    public function getCreator(): ?string
    {
        return $this->creator;
    }

    public function setCreator(?string $creator): void
    {
        $this->creator = $creator;
    }
}
