<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Mode\Entity\ValueQuery;

class ModeQuery
{
    protected string $sortDirection = 'desc';

    protected bool $excludeDefault = false;

    public function __construct(string $sortDirection = 'desc', bool $excludeDefault = false)
    {
        $this->sortDirection = $sortDirection;
        $this->excludeDefault = $excludeDefault;
    }

    public function getSortDirection(): string
    {
        return $this->sortDirection;
    }

    public function setSortDirection(string $sortDirection): self
    {
        $this->sortDirection = $sortDirection;
        return $this;
    }

    public function isExcludeDefault(): bool
    {
        return $this->excludeDefault;
    }

    public function setExcludeDefault(bool $excludeDefault): self
    {
        $this->excludeDefault = $excludeDefault;
        return $this;
    }
}
