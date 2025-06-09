<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\Entity\ValueObject;

enum EnvironmentEnum: string
{
    case Test = 'test';
    case Pre = 'pre';
    case Production = 'production';
    case Unknown = 'unknown';

    public function isProduction(): bool
    {
        return $this === self::Production;
    }
}
