<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\Structure;

use App\Domain\Flow\Entity\ValueObject\NodeInput;

readonly class OptionTool
{
    public function __construct(
        private string $toolId,
        private string $toolSetId = '',
        private bool $async = false,
        private ?NodeInput $customSystemInput = null,
    ) {
    }

    public function getToolSetId(): string
    {
        return $this->toolSetId;
    }

    public function getToolId(): string
    {
        return $this->toolId;
    }

    public function isAsync(): bool
    {
        return $this->async;
    }

    public function getCustomSystemInput(): ?NodeInput
    {
        return $this->customSystemInput;
    }

    public function toArray(): array
    {
        return [
            'tool_id' => $this->toolId,
            'tool_set_id' => $this->toolSetId,
            'async' => $this->async,
            'custom_system_input' => $this->customSystemInput?->toArray(),
        ];
    }
}
