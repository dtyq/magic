<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service\ModelFilter;

use App\Infrastructure\Core\DataIsolation\BaseDataIsolation;

interface PackageFilterInterface
{
    public function getCurrentPackage(string $organizationCode): ?string;

    /**
     * @return array{id: string, info: array}
     */
    public function getCurrentSubscription(BaseDataIsolation $dataIsolation): array;

    public function isPaidSubscription(string $organizationCode): bool;

    public function filterPaidOrganizations(array $organizationCodes): array;
}
