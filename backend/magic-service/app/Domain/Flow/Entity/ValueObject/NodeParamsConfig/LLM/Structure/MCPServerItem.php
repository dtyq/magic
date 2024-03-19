<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity\ValueObject\NodeParamsConfig\LLM\Structure;

use App\Domain\MCP\Entity\ValueObject\ServiceType;

class MCPServerItem
{
    public function __construct(
        protected string $id,
        protected string $name,
        protected string $description,
        protected ServiceType $type,
    ) {
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function getType(): ServiceType
    {
        return $this->type;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'type' => $this->type->value,
        ];
    }
}
