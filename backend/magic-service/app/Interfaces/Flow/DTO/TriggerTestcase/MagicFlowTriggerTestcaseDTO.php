<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\DTO\TriggerTestcase;

use App\Interfaces\Flow\DTO\AbstractFlowDTO;

class MagicFlowTriggerTestcaseDTO extends AbstractFlowDTO
{
    public string $name = '';

    public string $description = '';

    public string $flowCode;

    public array $caseConfig = [];

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(?string $name): void
    {
        $this->name = $name ?? '';
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function setDescription(?string $description): void
    {
        $this->description = $description ?? '';
    }

    public function getFlowCode(): string
    {
        return $this->flowCode;
    }

    public function setFlowCode(?string $flowCode): void
    {
        $this->flowCode = $flowCode ?? '';
    }

    public function getCaseConfig(): array
    {
        return $this->caseConfig;
    }

    public function setCaseConfig(?array $caseConfig): void
    {
        $this->caseConfig = $caseConfig ?? [];
    }
}
