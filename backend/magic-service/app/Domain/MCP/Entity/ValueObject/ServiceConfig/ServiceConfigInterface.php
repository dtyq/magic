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
    public static function fromArray(array $array): self;

    /**
     * Validate the service configuration.
     */
    public function validate(): void;

    /**
     * Get required fields that need to be replaced.
     */
    public function getRequireFields(): array;

    /**
     * Replace required fields with actual values.
     *
     * @param array<string, string> $fieldValues Array of field names and their values
     * @return self Modified current instance with replaced values
     */
    public function replaceRequiredFields(array $fieldValues): self;
}
