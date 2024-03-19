<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox;

class SandboxStruct
{
    public function __construct(
        private ?string $type = null,
        private array $options = [],
        private ?string $sandboxId = null,
    ) {
    }

    public function getType(): ?string
    {
        return $this->type;
    }

    public function setType(?string $type): self
    {
        $this->type = $type;
        return $this;
    }

    public function getOptions(): array
    {
        return $this->options;
    }

    public function setOptions(array $options): self
    {
        $this->options = $options;
        return $this;
    }

    public function getSandboxId(): ?string
    {
        return $this->sandboxId;
    }

    public function setSandboxId(?string $sandboxId): self
    {
        $this->sandboxId = $sandboxId;
        return $this;
    }

    public function toArray(): array
    {
        return [
            'type' => $this->type,
            'options' => $this->options,
            'sandbox_id' => $this->sandboxId,
        ];
    }
}
