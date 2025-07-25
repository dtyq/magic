<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelAdmin\Service\Filter;

interface PackageFilterInterface
{
    public function getCurrentPackage(string $organizationCode): ?string;
}
