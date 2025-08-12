<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\Assembler;

use App\Domain\Provider\DTO\ProviderConfigModelsDTO;
use App\Domain\Provider\Entity\ProviderEntity;

class ProviderAssembler extends AbstractProviderAssembler
{
    public static function toEntity(array $serviceProvider): ProviderEntity
    {
        return self::createEntityFromArray(ProviderEntity::class, $serviceProvider);
    }

    public static function toEntities(array $serviceProviders): array
    {
        return self::batchToEntities(ProviderEntity::class, $serviceProviders);
    }

    /**
     * @param $serviceProviderEntities ProviderEntity[]
     */
    public static function toArrays(array $serviceProviderEntities): array
    {
        return self::batchToArrays($serviceProviderEntities);
    }

    public static function toDTO(ProviderEntity $serviceProviderEntity, array $models): ProviderConfigModelsDTO
    {
        $serviceProviderDTO = new ProviderConfigModelsDTO($serviceProviderEntity->toArray());

        $serviceProviderDTO->setModels($models);
        return $serviceProviderDTO;
    }

    /**
     * @param $serviceProviderEntities ProviderEntity[]
     * @return ProviderConfigModelsDTO[]
     */
    public static function toDTOs(array $serviceProviderEntities): array
    {
        $serviceProviderDTOs = [];
        foreach ($serviceProviderEntities as $serviceProviderEntity) {
            $serviceProviderDTOs[] = self::toDTO($serviceProviderEntity, []);
        }
        return $serviceProviderDTOs;
    }
}
