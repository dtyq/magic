<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\MCP\Entity\ValueObject\ServiceConfig;

interface ServiceConfigInterface
{
    /**
     * Convert the service config to array.
     */
    public function toArray(): array;

    /**
     * Create service config from array.
     */
    public static function fromArray(array $array): ServiceConfigInterface;

    /**
     * Validate the service configuration.
     */
    public function validate(): void;
}
