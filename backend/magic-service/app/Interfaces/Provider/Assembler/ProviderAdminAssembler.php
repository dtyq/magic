<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\Assembler;

use App\Domain\Provider\DTO\ProviderConfigModelsDTO;
use App\Domain\Provider\DTO\ProviderModelDetailDTO;
use App\Domain\Provider\DTO\ProviderOriginalModelDTO;
use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ProviderEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ProviderOriginalModelEntity;
use App\Interfaces\Provider\DTO\CreateProviderConfigRequest;
use App\Interfaces\Provider\DTO\UpdateProviderConfigRequest;

class ProviderAdminAssembler
{
    public static function createRequestToEntity(CreateProviderConfigRequest $request, string $organizationCode): ProviderConfigEntity
    {
        $entity = new ProviderConfigEntity($request->toArray());
        $entity->setOrganizationCode($organizationCode);
        return $entity;
    }

    /**
     * 实体转换为配置 DTO.
     */
    public static function entityToModelsDTO(ProviderConfigEntity $entity): ProviderConfigModelsDTO
    {
        return new ProviderConfigModelsDTO($entity->toArray());
    }

    public static function updateRequestToEntity(UpdateProviderConfigRequest $request, string $organizationCode): ProviderConfigEntity
    {
        $entity = new ProviderConfigEntity($request->toArray());
        $entity->setOrganizationCode($organizationCode);
        return $entity;
    }

    /**
     * 模型实体转换为 DTO.
     */
    public static function modelEntityToDTO(ProviderModelEntity $entity): ProviderModelDetailDTO
    {
        return new ProviderModelDetailDTO($entity->toArray());
    }

    /**
     * 原始模型实体转换为 DTO.
     */
    public static function originalModelEntityToDTO(ProviderOriginalModelEntity $entity): ProviderOriginalModelDTO
    {
        return new ProviderOriginalModelDTO($entity->toArray());
    }

    /**
     * 批量原始模型实体转换为 DTO.
     *
     * @param array<ProviderOriginalModelEntity> $entities
     * @return array<ProviderOriginalModelDTO>
     */
    public static function originalModelEntitiesToDTOs(array $entities): array
    {
        if (empty($entities)) {
            return [];
        }

        $dtos = [];
        foreach ($entities as $entity) {
            $dtos[] = self::originalModelEntityToDTO($entity);
        }

        return $dtos;
    }

    public static function getProviderModelsDTO(
        ProviderEntity $provider,
        ProviderConfigEntity $providerConfig,
        array $models
    ): ProviderConfigModelsDTO {
        $dto = new ProviderConfigModelsDTO();

        // 从 Provider 填充基础信息
        $dto->setId($providerConfig->getId());
        $dto->setProviderCode($provider->getProviderCode());
        $dto->setName($provider->getName());
        $dto->setProviderType($provider->getProviderType());
        $dto->setDescription($provider->getDescription());
        $dto->setIcon($provider->getIcon());
        $dto->setCategory($provider->getCategory());
        $dto->setStatus($providerConfig->getStatus());
        $dto->setIsModelsEnable($provider->getIsModelsEnable());
        $dto->setTranslate(array_merge($provider->getTranslate(), $providerConfig->getTranslate()));
        $dto->setCreatedAt($provider->getCreatedAt()->format('Y-m-d H:i:s'));

        // 从 ProviderConfig 填充配置信息
        $dto->setAlias($providerConfig->getAlias());
        $dto->setServiceProviderId($providerConfig->getServiceProviderId());
        $dto->setConfig($providerConfig->getConfig());
        $dto->setSort($providerConfig->getSort());

        // 转换模型 Entity 为 DTO
        $modelDTOs = [];
        foreach ($models as $model) {
            if ($model instanceof ProviderModelEntity) {
                $modelDTOs[] = self::modelEntityToDTO($model);
            }
        }
        $dto->setModels($modelDTOs);

        return $dto;
    }
}
