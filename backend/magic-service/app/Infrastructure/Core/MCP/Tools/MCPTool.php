<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\MCP\Tools;

use App\Infrastructure\Core\MCP\Exception\InvalidParamsException;
use Closure;
use stdClass;

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
            'inputSchema' => $this->normalizeJsonSchema($this->jsonSchema),
        ];
    }

    public function call(array $arguments = []): mixed
    {
        if ($this->callback === null) {
            throw new InvalidParamsException('Callback is not set.');
        }

        return call_user_func($this->getCallback(), $arguments);
    }

    /**
     * Normalize JSON schema by converting null properties to stdClass objects
     * This ensures MCP compatibility as MCP doesn't allow null values for properties.
     */
    private function normalizeJsonSchema(array $schema): array
    {
        $normalized = [];

        foreach ($schema as $key => $value) {
            if ($key === 'properties' && ($value === null || (is_array($value) && empty($value)))) {
                // Convert null properties or empty array to empty stdClass (serializes as {} in JSON)
                $normalized[$key] = new stdClass();
            } elseif (is_array($value)) {
                // Recursively normalize nested arrays
                $normalized[$key] = $this->normalizeJsonSchema($value);
            } else {
                $normalized[$key] = $value;
            }
        }

        return $normalized;
    }
}
