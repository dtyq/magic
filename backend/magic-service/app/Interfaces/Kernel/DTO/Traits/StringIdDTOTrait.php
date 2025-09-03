<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Kernel\DTO\Traits;

trait StringIdDTOTrait
{
    public ?string $id = null;

    public function getId(): ?string
    {
        return $this->id;
    }

    public function setId(null|int|string $id): static
    {
        $this->id = is_null($id) ? $id : (string) $id;
        return $this;
    }
}
