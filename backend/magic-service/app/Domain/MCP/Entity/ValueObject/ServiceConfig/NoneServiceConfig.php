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

    public static function fromArray(array $array): ServiceConfigInterface
    {
        return new self();
    }

    public function validate(): void
    {
        // No validation required for NoneServiceConfig
    }
}
