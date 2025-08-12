<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\Assembler;

use App\Domain\Provider\Entity\ProviderModelEntity;

class ProviderModelAssembler extends AbstractProviderAssembler
{
    public static function toEntity(array $model): ProviderModelEntity
    {
        return self::createEntityFromArray(ProviderModelEntity::class, $model);
    }

    /**
     * @return ProviderModelEntity[]
     */
    public static function toEntities(array $models): array
    {
        return self::batchToEntities(ProviderModelEntity::class, $models);
    }

    /**
     * @param $modelEntities ProviderModelEntity[]
     */
    public static function toArrays(array $modelEntities): array
    {
        return self::batchToArrays($modelEntities);
    }
}
