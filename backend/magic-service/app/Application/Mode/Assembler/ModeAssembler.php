<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Assembler;

use App\Application\Mode\DTO\ModeAggregateDTO;
use App\Application\Mode\DTO\ModeDTO;
use App\Application\Mode\DTO\ModeGroupAggregateDTO;
use App\Application\Mode\DTO\ModeGroupDTO;
use App\Application\Mode\DTO\ModeGroupModelDTO;
use App\Application\Mode\DTO\ModeGroupRelationDTO;
use App\Domain\Mode\Entity\ModeAggregate;
use App\Domain\Mode\Entity\ModeEntity;
use App\Domain\Mode\Entity\ModeGroupAggregate;
use App\Domain\Mode\Entity\ModeGroupEntity;
use App\Domain\Mode\Entity\ModeGroupRelationEntity;

class ModeAssembler
{
    /**
     * 实体转换为列表DTO.
     */
    public static function modeToDTO(ModeEntity $entity): ModeDTO
    {
        return new ModeDTO($entity->toArray());
    }

    /**
     * 实体转换为详情DTO.
     */
    public static function entityToDetailDTO(ModeEntity $entity): ModeDTO
    {
        return new ModeDTO($entity->toArray());
    }

    /**
     * 分组实体转换为DTO.
     */
    public static function groupEntityToDTO(ModeGroupEntity $entity): ModeGroupDTO
    {
        return new ModeGroupDTO($entity->toArray());
    }

    /**
     * 关联实体转换为DTO.
     */
    public static function relationEntityToDTO(ModeGroupRelationEntity $entity): ModeGroupRelationDTO
    {
        return new ModeGroupRelationDTO($entity->toArray());
    }

    /**
     * 聚合根转换为DTO.
     *
     * @param ModeAggregate $aggregate 模式聚合根
     * @param array $providerModels 可选的模型信息映射 [modelId => ProviderModelEntity]
     */
    public static function aggregateToDTO(ModeAggregate $aggregate, array $providerModels = []): ModeAggregateDTO
    {
        $dto = new ModeAggregateDTO();
        $dto->setMode(self::entityToDetailDTO($aggregate->getMode()));

        $groupAggregatesDTOs = array_map(
            fn ($groupAggregate) => self::groupAggregateToDTO($groupAggregate, $providerModels),
            $aggregate->getGroupAggregates()
        );

        $dto->setGroups($groupAggregatesDTOs);

        return $dto;
    }

    /**
     * 分组聚合根转换为DTO.
     *
     * @param ModeGroupAggregate $groupAggregate 分组聚合根
     * @param array $providerModels 可选的模型信息映射 [modelId => ProviderModelEntity]
     */
    public static function groupAggregateToDTO(ModeGroupAggregate $groupAggregate, array $providerModels = []): ModeGroupAggregateDTO
    {
        $dto = new ModeGroupAggregateDTO();
        $dto->setGroup(self::groupEntityToDTO($groupAggregate->getGroup()));

        $models = [];
        foreach ($groupAggregate->getRelations() as $relation) {
            $modelDTO = new ModeGroupModelDTO();
            $modelDTO->setId($relation->getId());
            $modelDTO->setGroupId($relation->getGroupId());
            $modelDTO->setModelId((string) $relation->getModelId());
            $modelDTO->setSort($relation->getSort());

            // 如果提供了模型信息，则填充模型名称和图标
            $modelId = (string) $relation->getModelId();
            if (isset($providerModels[$modelId])) {
                $providerModel = $providerModels[$modelId];
                $modelDTO->setModelName($providerModel->getName());
                $modelDTO->setModelIcon($providerModel->getIcon());
            }

            $models[] = $modelDTO;
        }

        $dto->setModels($models);

        return $dto;
    }

    /**
     * 实体数组转换为DTO数组.
     */
    public static function entitiesToDTOs(array $entities): array
    {
        return array_map(fn ($entity) => self::modeToDTO($entity), $entities);
    }

    /**
     * 分组实体数组转换为DTO数组.
     */
    public static function groupEntitiesToDTOs(array $entities): array
    {
        return array_map(fn ($entity) => self::groupEntityToDTO($entity), $entities);
    }

    /**
     * 关联实体数组转换为DTO数组.
     */
    public static function relationEntitiesToDTOs(array $entities): array
    {
        return array_map(fn ($entity) => self::relationEntityToDTO($entity), $entities);
    }

    /**
     * 分组配置转换为实体.
     */
    public static function groupConfigToEntity(array $config, string $modeId, string $organizationCode, string $creatorId): ModeGroupEntity
    {
        $entity = new ModeGroupEntity();
        $entity->setModeId($modeId);
        $entity->setName($config['name']);
        $entity->setIcon($config['icon'] ?? '');
        $entity->setColor($config['color'] ?? '');
        $entity->setDescription($config['description'] ?? '');
        $entity->setSort($config['sort'] ?? 0);
        $entity->setStatus($config['status'] ?? 1);
        $entity->setOrganizationCode($organizationCode);
        $entity->setCreatorId($creatorId);

        return $entity;
    }

    /**
     * 模型配置转换为关联实体.
     */
    public static function modelConfigToRelationEntity(array $config, string $modeId, string $groupId, string $organizationCode): ModeGroupRelationEntity
    {
        $entity = new ModeGroupRelationEntity();
        $entity->setModeId($modeId);
        $entity->setGroupId($groupId);
        $entity->setModelId((string) $config['model_id']);
        $entity->setSort($config['sort'] ?? 0);
        $entity->setOrganizationCode($organizationCode);

        return $entity;
    }

    public static function modelDTOToEntity(ModeDTO $modeDTO)
    {
        return new ModeEntity($modeDTO->toArray());
    }

    /**
     * ModeAggregateDTO转换为ModeAggregate实体.
     */
    public static function aggregateDTOToEntity(ModeAggregateDTO $dto): ModeAggregate
    {
        $mode = self::modelDTOToEntity($dto->getMode());

        $groupAggregates = array_map(
            fn ($groupAggregateDTO) => self::groupAggregateDTOToEntity($groupAggregateDTO),
            $dto->getGroups()
        );

        return new ModeAggregate($mode, $groupAggregates);
    }

    /**
     * ModeGroupAggregateDTO转换为ModeGroupAggregate实体.
     */
    public static function groupAggregateDTOToEntity(ModeGroupAggregateDTO $dto): ModeGroupAggregate
    {
        $group = self::groupDTOToEntity($dto->getGroup());

        // 从 modelIds 构建 ModeGroupRelationEntity 数组
        $relations = [];
        foreach ($dto->getModelIds() as $index => $modelId) {
            $relation = new ModeGroupRelationEntity();
            $relation->setModeId($group->getModeId()); // Entity的setter会处理类型转换
            $relation->setGroupId($group->getId()); // Entity的setter会处理类型转换
            $relation->setModelId($modelId); // Entity的setter会处理类型转换
            $relation->setSort($index);
            $relation->setOrganizationCode($group->getOrganizationCode());
            $relations[] = $relation;
        }

        return new ModeGroupAggregate($group, $relations);
    }

    /**
     * ModeGroupDTO转换为ModeGroupEntity实体.
     */
    public static function groupDTOToEntity(ModeGroupDTO $dto): ModeGroupEntity
    {
        return new ModeGroupEntity($dto->toArray());
    }
}
