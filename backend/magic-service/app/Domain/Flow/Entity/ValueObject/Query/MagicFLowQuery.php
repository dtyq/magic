<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\Query;

class MagicFLowQuery extends Query
{
    public int $type = 0;

    public string $toolSetId = '';

    public ?bool $enabled = null;

    public string $name = '';

    public ?array $codes = null;

    public ?array $toolSetIds = null;

    public function getType(): int
    {
        return $this->type;
    }

    public function setType(int $type): self
    {
        $this->type = $type;
        return $this;
    }

    public function getToolSetId(): string
    {
        return $this->toolSetId;
    }

    public function setToolSetId(string $toolSetId): self
    {
        $this->toolSetId = $toolSetId;
        return $this;
    }

    public function getEnabled(): ?bool
    {
        return $this->enabled;
    }

    public function setEnabled(?bool $enabled): self
    {
        $this->enabled = $enabled;
        return $this;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;
        return $this;
    }

    public function getCodes(): ?array
    {
        return $this->codes;
    }

    public function setCodes(?array $codes): self
    {
        $this->codes = $codes;
        return $this;
    }

    public function getToolSetIds(): ?array
    {
        return $this->toolSetIds;
    }

    public function setToolSetIds(?array $toolSetIds): self
    {
        $this->toolSetIds = $toolSetIds;
        return $this;
    }
}
