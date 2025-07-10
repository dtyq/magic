<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity\ValueObject\ServiceConfig;

use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\AbstractValueObject;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class EnvConfig extends AbstractValueObject
{
    protected string $key = '';

    protected string $value = '';

    public static function create(string $key, string $value): EnvConfig
    {
        $instance = new self();
        $instance->setKey($key);
        $instance->setValue($value);
        return $instance;
    }

    public function getKey(): string
    {
        return $this->key;
    }

    public function setKey(string $key): void
    {
        $this->key = $key;
    }

    public function getValue(): string
    {
        return $this->value;
    }

    public function setValue(string $value): void
    {
        $this->value = $value;
    }

    public function validate(): void
    {
        // If value is provided, key must be provided
        if (! empty($this->value) && empty($this->key)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'mcp.fields.env']);
        }
    }

    public static function fromArray(array $array): self
    {
        $instance = new self();
        $instance->setKey($array['key'] ?? '');
        $instance->setValue($array['value'] ?? '');
        return $instance;
    }

    public function toArray(): array
    {
        return [
            'key' => $this->key,
            'value' => $this->value,
        ];
    }
}
