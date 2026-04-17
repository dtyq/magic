<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Policy;

use App\Domain\Provider\DTO\ProviderConfigModelsDTO;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;

interface ProviderControlPolicyInterface
{
    /**
     * @param ProviderConfigModelsDTO[] $serviceProviders
     * @return ProviderConfigModelsDTO[]
     */
    public function filterSelectableProviders(string $organizationCode, ?Category $category, array $serviceProviders): array;

    public function prepareProviderConfigForSave(
        string $organizationCode,
        ProviderCode $providerCode,
        Category $category,
        array $config,
    ): array;
}
