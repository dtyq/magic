<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\Assembler;

use App\Domain\Permission\Entity\ResourceVisibilityEntity;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\PrincipalType;
use App\Domain\Permission\Entity\ValueObject\ResourceVisibility\VisibilityConfig;
use App\Interfaces\Permission\DTO\ResourceVisibilityDTO;

/**
 * 资源可见性装配器.
 */
class ResourceVisibilityAssembler
{
    /**
     * 从DTO创建实体数组.
     *
     * @return array<ResourceVisibilityEntity>
     */
    public static function createEntitiesFromDTO(ResourceVisibilityDTO $dto, string $organizationCode, string $currentUserId): array
    {
        $entities = [];
        foreach ($dto->getTargets() as $target) {
            $entity = new ResourceVisibilityEntity();
            $entity->setOrganizationCode($organizationCode);
            $entity->setPrincipalType(PrincipalType::make($target->getPrincipalType()));
            $entity->setPrincipalId($target->getPrincipalId());
            $entity->setCreator($currentUserId);
            $entity->setModifier($currentUserId);

            $entities[] = $entity;
        }
        return $entities;
    }

    /**
     * 从实体数组创建DTO.
     *
     * @param array<ResourceVisibilityEntity> $entities
     */
    public static function createDTOFromEntities(array $entities, int $resourceType, string $resourceCode): ResourceVisibilityDTO
    {
        $dto = new ResourceVisibilityDTO();
        $dto->setResourceType($resourceType);
        $dto->setResourceCode($resourceCode);

        $targets = [];
        foreach ($entities as $entity) {
            $targets[] = [
                'principal_type' => $entity->getPrincipalType()->value,
                'principal_id' => $entity->getPrincipalId(),
            ];
        }
        $dto->setTargets($targets);

        return $dto;
    }

    /**
     * 从请求参数创建VisibilityConfig值对象.
     *
     * @param array $visibilityConfigData 可见性配置数据
     */
    public static function createVisibilityConfigFromRequest(array $visibilityConfigData): VisibilityConfig
    {
        return new VisibilityConfig($visibilityConfigData);
    }
}
