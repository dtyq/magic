<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\Query;

class MagicFlowToolSetQuery extends Query
{
    public ?bool $withToolsSimpleInfo = null;

    public string $name = '';

    public ?array $codes = null;

    public ?bool $enabled = null;

    public function getWithToolsSimpleInfo(): ?bool
    {
        return $this->withToolsSimpleInfo;
    }

    public function setWithToolsSimpleInfo(?bool $withToolsSimpleInfo): void
    {
        $this->withToolsSimpleInfo = $withToolsSimpleInfo;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getCodes(): ?array
    {
        return $this->codes;
    }

    public function setCodes(?array $codes): void
    {
        $this->codes = $codes;
    }

    public function getEnabled(): ?bool
    {
        return $this->enabled;
    }

    public function setEnabled(?bool $enabled): void
    {
        $this->enabled = $enabled;
    }
}
