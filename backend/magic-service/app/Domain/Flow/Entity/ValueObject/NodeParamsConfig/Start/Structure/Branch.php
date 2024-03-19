<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\Start\Structure;

use App\Domain\Flow\Entity\ValueObject\NodeInput;
use App\Domain\Flow\Entity\ValueObject\NodeOutput;

readonly class Branch
{
    public function __construct(
        private string $branchId,
        private TriggerType $triggerType,
        private array $nextNodes = [],
        private array $config = [],
        private ?NodeInput $input = null,
        private ?NodeOutput $output = null,
        private ?NodeOutput $systemOutput = null,
        private ?NodeOutput $customSystemOutput = null,
    ) {
    }

    public function toArray(): array
    {
        return [
            'branch_id' => $this->branchId,
            'trigger_type' => $this->triggerType->value,
            'next_nodes' => $this->nextNodes,
            'config' => $this->config,
            'input' => $this->input?->toArray(),
            'output' => $this->output?->toArray(),
            'system_output' => $this->systemOutput?->toArray(),
            'custom_system_output' => $this->customSystemOutput?->toArray(),
        ];
    }

    public function getBranchId(): string
    {
        return $this->branchId;
    }

    public function getTriggerType(): TriggerType
    {
        return $this->triggerType;
    }

    public function getNextNodes(): array
    {
        return $this->nextNodes;
    }

    public function getConfig(): array
    {
        return $this->config;
    }

    public function getInput(): ?NodeInput
    {
        return $this->input;
    }

    public function getOutput(): ?NodeOutput
    {
        return $this->output;
    }

    public function getSystemOutput(): ?NodeOutput
    {
        return $this->systemOutput;
    }

    public function getCustomSystemOutput(): ?NodeOutput
    {
        return $this->customSystemOutput;
    }
}
