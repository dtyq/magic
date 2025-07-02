<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity\ValueObject\ServiceConfig;

use App\ErrorCode\MCPErrorCode;
use App\Infrastructure\Core\AbstractValueObject;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

class HeaderConfig extends AbstractValueObject
{
    protected string $key;

    protected string $value;

    protected string $mapperSystemInput = '';

    public function setKey(string $key): void
    {
        $this->key = $key;
    }

    public function setValue(string $value): void
    {
        $this->value = $value;
    }

    public function setMapperSystemInput(string $mapperSystemInput): void
    {
        $this->mapperSystemInput = $mapperSystemInput;
    }

    public function getKey(): string
    {
        return $this->key;
    }

    public function getValue(): string
    {
        return $this->value;
    }

    public function getMapperSystemInput(): string
    {
        return $this->mapperSystemInput;
    }

    public function validate(): void
    {
        $key = trim($this->key);
        $value = trim($this->value);

        // Skip if both key and value are empty (header not configured)
        if (empty($key) && empty($value)) {
            return;
        }

        // If key is empty but value is not, this is invalid
        if (empty($key)) {
            ExceptionBuilder::throw(MCPErrorCode::ValidateFailed, 'common.empty', ['label' => 'Header Key']);
        }

        // If key is provided, value can be empty (some headers don't need values)
    }

    public function toArray(): array
    {
        return [
            'key' => $this->key,
            'value' => $this->value,
            'mapper_system_input' => $this->mapperSystemInput,
        ];
    }

    public static function fromArray(array $array): self
    {
        $instance = new self();
        $instance->setKey($array['key'] ?? '');
        $instance->setValue($array['value'] ?? '');
        $instance->setMapperSystemInput($array['mapper_system_input'] ?? '');
        return $instance;
    }
}
