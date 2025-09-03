<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\Trait;

use App\Domain\Chat\DTO\Message\Options\EditMessageOptions;

trait EditMessageOptionsTrait
{
    protected EditMessageOptions $editMessageOptions;

    public function getEditMessageOptions(): ?EditMessageOptions
    {
        return $this->editMessageOptions ?? null;
    }

    public function setEditMessageOptions(null|array|EditMessageOptions $editMessageOptions): static
    {
        if (is_null($editMessageOptions)) {
            return $this;
        }
        if (is_array($editMessageOptions)) {
            $this->editMessageOptions = new EditMessageOptions($editMessageOptions);
        } elseif ($editMessageOptions instanceof EditMessageOptions) {
            $this->editMessageOptions = $editMessageOptions;
        }
        return $this;
    }
}
