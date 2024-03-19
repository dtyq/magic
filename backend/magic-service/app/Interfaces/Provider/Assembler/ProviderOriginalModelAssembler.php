<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\Assembler;

use App\Domain\Provider\Entity\ProviderOriginalModelEntity;

class ProviderOriginalModelAssembler extends AbstractProviderAssembler
{
    /**
     * @return ProviderOriginalModelEntity[]
     */
    public static function toEntities(array $modelData): array
    {
        return self::batchToEntities(ProviderOriginalModelEntity::class, $modelData);
    }

    public static function toEntity(array $serviceProviderOriginalModels): ProviderOriginalModelEntity
    {
        return self::createEntityFromArray(ProviderOriginalModelEntity::class, $serviceProviderOriginalModels, false);
    }

    /**
     * @param $serviceProviderOriginalModelsEntities ProviderOriginalModelEntity[]
     */
    public static function toArrays(array $serviceProviderOriginalModelsEntities): array
    {
        return self::batchToArrays($serviceProviderOriginalModelsEntities);
    }
}
