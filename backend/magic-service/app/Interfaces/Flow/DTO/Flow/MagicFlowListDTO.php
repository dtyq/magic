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

class MagicFlowListDTO extends AbstractFlowDTO
{
    /**
     * 流程名称（助理名称）.
     */
    public string $name = '';

    /**
     * 流程描述 （助理描述）.
     */
    public string $description = '';

    /**
     * 流程图标（助理头像）.
     */
    public string $icon = '';

    public int $type = 0;

    public string $toolSetId = '';

    public bool $enabled;

    public ?NodeInputDTO $input = null;

    public ?NodeOutputDTO $output = null;

    public ?NodeInputDTO $customSystemInput = null;

    public int $userOperation = 0;

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

    public function getToolSetId(): string
    {
        return $this->toolSetId;
    }

    public function setToolSetId(?string $toolSetId): void
    {
        $this->toolSetId = $toolSetId ?? '';
    }

    public function getUserOperation(): int
    {
        return $this->userOperation;
    }

    public function setUserOperation(?int $userOperation): void
    {
        $this->userOperation = $userOperation ?? 0;
    }

    public function getCustomSystemInput(): ?NodeInputDTO
    {
        return $this->customSystemInput;
    }

    public function setCustomSystemInput(mixed $customSystemInput): void
    {
        $this->customSystemInput = MagicFlowNodeAssembler::createNodeInputDTOByMixed($customSystemInput);
    }
}
