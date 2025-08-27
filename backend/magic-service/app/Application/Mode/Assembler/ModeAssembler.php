<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Assembler;

use App\Application\Mode\DTO\AdminModeAggregateDTO;
use App\Application\Mode\DTO\AdminModeDTO;
use App\Application\Mode\DTO\AdminModeGroupDTO;
use App\Application\Mode\DTO\ModeAggregateDTO;
use App\Application\Mode\DTO\ModeGroupAggregateDTO;
use App\Application\Mode\DTO\ModeGroupModelDTO;
use App\Application\Mode\DTO\ModeGroupRelationDTO;
use App\Domain\Mode\Entity\ModeAggregate;
use App\Domain\Mode\Entity\ModeEntity;
use App\Domain\Mode\Entity\ModeGroupAggregate;
use App\Domain\Mode\Entity\ModeGroupEntity;
use App\Domain\Mode\Entity\ModeGroupRelationEntity;
use App\Interfaces\Mode\DTO\Request\CreateModeGroupRequest;
use App\Interfaces\Mode\DTO\Request\CreateModeRequest;
use App\Interfaces\Mode\DTO\Request\UpdateModeGroupRequest;
use App\Interfaces\Mode\DTO\Request\UpdateModeRequest;

class ModeAssembler
{
    /**
     * 实体转换为管理后台DTO (包含完整的i18n字段).
     */
    public static function modeToAdminDTO(ModeEntity $entity): AdminModeDTO
    {
        $data = $entity->toArray();
        return new AdminModeDTO($data);
    }

    /**
     * 实体转换为详情DTO.
     */
    public static function entityToDetailDTO(ModeEntity $entity): AdminModeDTO
    {
        return new AdminModeDTO($entity->toArray());
    }

    /**
     * 分组实体转换为DTO (前台用，根据当前语言返回name).
     */
    public static function groupEntityToDTO(ModeGroupEntity $entity): AdminModeGroupDTO
    {
        $data = $entity->toArray();
        // 将 nameI18n 转换为当前语言的 name
        $data['name'] = $entity->getZHName();
        // 移除 nameI18n 字段，前台不需要
        unset($data['nameI18n']);

        return new AdminModeGroupDTO($data);
    }

    /**
     * 分组实体转换为管理后台DTO (包含完整的i18n字段).
     */
    public static function groupEntityToAdminDTO(ModeGroupEntity $entity): AdminModeGroupDTO
    {
        $data = $entity->toArray();
        return new AdminModeGroupDTO($data);
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
    public static function aggregateToDTO(ModeAggregate $aggregate, array $providerModels = []): AdminModeAggregateDTO
    {
        $dto = new AdminModeAggregateDTO();
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
     * 实体数组转换为管理后台DTO数组.
     */
    public static function entitiesToAdminDTOs(array $entities): array
    {
        return array_map(fn ($entity) => self::modeToAdminDTO($entity), $entities);
    }

    /**
     * 分组实体数组转换为管理后台DTO数组.
     */
    public static function groupEntitiesToAdminDTOs(array $entities): array
    {
        return array_map(fn ($entity) => self::groupEntityToAdminDTO($entity), $entities);
    }

    /**
     * 关联实体数组转换为DTO数组.
     */
    public static function relationEntitiesToDTOs(array $entities): array
    {
        return array_map(fn ($entity) => self::relationEntityToDTO($entity), $entities);
    }

    public static function modelDTOToEntity(AdminModeDTO $modeDTO)
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

        $relations = [];
        foreach ($dto->getModelIds() as $index => $modelId) {
            $relation = new ModeGroupRelationEntity();
            $relation->setModeId($group->getModeId());
            $relation->setGroupId($group->getId());
            $relation->setModelId($modelId);
            $relation->setSort($index);
            $relation->setOrganizationCode($group->getOrganizationCode());
            $relations[] = $relation;
        }

        return new ModeGroupAggregate($group, $relations);
    }

    /**
     * ModeGroupDTO转换为ModeGroupEntity实体.
     */
    public static function groupDTOToEntity(AdminModeGroupDTO $dto): ModeGroupEntity
    {
        return new ModeGroupEntity($dto->toArray());
    }

    /**
     * CreateModeRequest转换为ModeEntity.
     */
    public static function createModeRequestToEntity(CreateModeRequest $request): ModeEntity
    {
        return new ModeEntity($request->all());
    }

    /**
     * UpdateModeRequest转换为ModeEntity.
     */
    public static function updateModeRequestToEntity(UpdateModeRequest $request): ModeEntity
    {
        return new ModeEntity($request->all());
    }

    /**
     * CreateModeGroupRequest转换为ModeGroupEntity.
     */
    public static function createModeGroupRequestToEntity(CreateModeGroupRequest $request): ModeGroupEntity
    {
        return new ModeGroupEntity($request->all());
    }

    /**
     * UpdateModeGroupRequest转换为ModeGroupEntity.
     */
    public static function updateModeGroupRequestToEntity(UpdateModeGroupRequest $request, string $groupId): ModeGroupEntity
    {
        $entity = new ModeGroupEntity($request->all());
        $entity->setId($groupId);
        return $entity;
    }
}
