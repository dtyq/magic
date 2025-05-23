<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Tools;

use App\Infrastructure\Core\MCP\Exception\InvalidParamsException;
use Closure;

readonly class MCPTool
{
    public function __construct(
        private string $name,
        private string $description,
        private array $jsonSchema,
        private ?Closure $callback = null,
    ) {
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getDescription(): string
    {
        return $this->description;
    }

    public function getJsonSchema(): array
    {
        return $this->jsonSchema;
    }

    public function getCallback(): ?Closure
    {
        return $this->callback;
    }

    public function toScheme(): array
    {
        return [
            'name' => $this->name,
            'description' => $this->description,
            'inputSchema' => $this->jsonSchema,
        ];
    }

    public function call(array $arguments = []): mixed
    {
        if ($this->callback === null) {
            throw new InvalidParamsException('Callback is not set.');
        }

        return call_user_func($this->getCallback(), $arguments);
    }
}
