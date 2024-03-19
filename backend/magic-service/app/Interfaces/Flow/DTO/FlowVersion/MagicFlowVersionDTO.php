<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\DTO\FlowVersion;

use App\Interfaces\Flow\Assembler\Flow\MagicFlowAssembler;
use App\Interfaces\Flow\DTO\AbstractFlowDTO;
use App\Interfaces\Flow\DTO\Flow\MagicFlowDTO;

class MagicFlowVersionDTO extends AbstractFlowDTO
{
    public string $name = '';

    public string $description = '';

    public string $flowCode;

    public ?MagicFlowDTO $magicFlow;

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

    public function getMagicFLow(): ?MagicFlowDTO
    {
        return $this->magicFlow;
    }

    public function setMagicFLow(mixed $magicFlow): void
    {
        $this->magicFlow = MagicFlowAssembler::createMagicFlowDTOByMixed($magicFlow);
    }
}
