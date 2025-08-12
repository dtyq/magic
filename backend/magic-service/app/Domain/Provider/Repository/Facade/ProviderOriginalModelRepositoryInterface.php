<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Facade;

use App\Domain\Provider\Entity\ProviderOriginalModelEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\ProviderOriginalModelType;

interface ProviderOriginalModelRepositoryInterface
{
    public function save(ProviderDataIsolation $dataIsolation, ProviderOriginalModelEntity $providerOriginalModelEntity): ProviderOriginalModelEntity;

    public function delete(ProviderDataIsolation $dataIsolation, string $id): void;

    /**
     * @return array<ProviderOriginalModelEntity>
     */
    public function list(ProviderDataIsolation $dataIsolation): array;

    public function exist(ProviderDataIsolation $dataIsolation, string $modelId, ProviderOriginalModelType $type): bool;
}
