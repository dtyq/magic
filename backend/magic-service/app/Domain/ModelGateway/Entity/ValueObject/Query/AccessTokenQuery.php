<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\ValueObject\Query;

use App\Infrastructure\Core\ValueObject\Query;

class AccessTokenQuery extends Query
{
    public ?string $creator = null;

    public ?string $type = null;

    public function getType(): ?string
    {
        return $this->type;
    }

    public function setType(?string $type): void
    {
        $this->type = $type;
    }

    public function getCreator(): ?string
    {
        return $this->creator;
    }

    public function setCreator(?string $creator): void
    {
        $this->creator = $creator;
    }
}
