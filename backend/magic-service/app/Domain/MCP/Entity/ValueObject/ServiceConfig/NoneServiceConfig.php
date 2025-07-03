<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity\ValueObject\ServiceConfig;

class NoneServiceConfig extends AbstractServiceConfig
{
    public function toArray(): array
    {
        return [];
    }

    public static function fromArray(array $array): self
    {
        return new self();
    }

    public function validate(): void
    {
        // No validation required for NoneServiceConfig
    }

    public function getRequireFields(): array
    {
        return [];
    }

    public function replaceRequiredFields(array $fieldValues): self
    {
        // No fields to replace, return current instance
        return $this;
    }
}
