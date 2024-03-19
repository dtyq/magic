<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\DTO\Flow;

use App\Interfaces\Flow\Assembler\Node\MagicFlowNodeAssembler;
use App\Interfaces\Flow\DTO\AbstractFlowDTO;
use App\Interfaces\Flow\DTO\Node\NodeInputDTO;
use App\Interfaces\Flow\DTO\Node\NodeOutputDTO;

class MagicFlowParamDTO extends AbstractFlowDTO
{
    public string $name = '';

    public string $description = '';

    public string $icon = '';

    public int $type = 0;

    public bool $enabled;

    public ?NodeInputDTO $input = null;

    public ?NodeOutputDTO $output = null;

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

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(?string $icon): void
    {
        $this->icon = $icon ?? '';
    }

    public function getType(): int
    {
        return $this->type;
    }

    public function setType(?int $type): void
    {
        $this->type = $type ?? 0;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(?bool $enabled): void
    {
        $this->enabled = $enabled ?? false;
    }

    public function getInput(): ?NodeInputDTO
    {
        return $this->input;
    }

    public function setInput(mixed $input): void
    {
        $this->input = MagicFlowNodeAssembler::createNodeInputDTOByMixed($input);
    }

    public function getOutput(): ?NodeOutputDTO
    {
        return $this->output;
    }

    public function setOutput(mixed $output): void
    {
        $this->output = MagicFlowNodeAssembler::createNodeOutputDTOByMixed($output);
    }
}
