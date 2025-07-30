<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\Assembler\AIModel;

use App\Domain\Flow\Entity\MagicFlowAIModelEntity;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Flow\DTO\AIModel\MagicFlowAIModelDTO;
use App\Interfaces\Flow\DTO\MagicFlowEnabledAIModelDTO;
use App\Interfaces\Kernel\Assembler\FileAssembler;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use App\Interfaces\Kernel\DTO\PageDTO;

class MagicFlowAIModelAssembler
{
    public static function createFlowAIModelDTOByMixed(mixed $data): ?MagicFlowAIModelDTO
    {
        if ($data instanceof MagicFlowAIModelDTO) {
            return $data;
        }
        if (is_array($data)) {
            return new MagicFlowAIModelDTO($data);
        }
        return null;
    }

    public static function createDO(MagicFlowAIModelDTO $dto): MagicFlowAIModelEntity
    {
        $entity = new MagicFlowAIModelEntity();
        $entity->setName($dto->getName());
        $entity->setLabel($dto->getLabel());
        $entity->setTags($dto->getTags());
        $entity->setModelName($dto->getModelName());
        $entity->setDefaultConfigs($dto->getDefaultConfigs());
        $entity->setEnabled($dto->isEnabled());
        $entity->setImplementation($dto->getImplementation());
        $entity->setImplementationConfig($dto->getImplementationConfig());
        $entity->setSupportEmbedding($dto->isSupportEmbedding());
        $entity->setVectorSize($dto->getVectorSize());
        $entity->setIcon(FileAssembler::formatPath($dto->getIcon()));
        $entity->setDisplay($dto->isDisplay());
        $entity->setMaxTokens($dto->getMaxTokens());
        $entity->setSupportMultiModal($dto->isSupportMultiModal());
        return $entity;
    }

    public static function createDTO(MagicFlowAIModelEntity $magicFlowAIModelEntity, array $users = []): MagicFlowAIModelDTO
    {
        $dto = new MagicFlowAIModelDTO($magicFlowAIModelEntity->toArray());
        $dto->setId($magicFlowAIModelEntity->getId());

        $dto->setCreator($magicFlowAIModelEntity->getCreatedUid());
        $dto->setCreatedAt($magicFlowAIModelEntity->getCreatedAt());
        $dto->setModifier($magicFlowAIModelEntity->getUpdatedUid());
        $dto->setUpdatedAt($magicFlowAIModelEntity->getUpdatedAt());
        $dto->setCreatorInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$magicFlowAIModelEntity->getCreatedUid()] ?? null, $magicFlowAIModelEntity->getCreatedAt()));
        $dto->setModifierInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$magicFlowAIModelEntity->getUpdatedUid()] ?? null, $magicFlowAIModelEntity->getUpdatedAt()));
        return $dto;
    }

    /**
     * @param MagicFlowAIModelEntity[] $list
     */
    public static function createPageListDTO(int $total, array $list, Page $page): PageDTO
    {
        $list = array_map(fn (MagicFlowAIModelEntity $entity) => self::createDTO($entity), $list);
        return new PageDTO($page->getPage(), $total, $list);
    }

    public static function createEnabledDTO(MagicFlowAIModelEntity $magicFlowAIModelEntity): MagicFlowEnabledAIModelDTO
    {
        $dto = new MagicFlowEnabledAIModelDTO($magicFlowAIModelEntity->toArray());
        $dto->setValue($magicFlowAIModelEntity->getName());
        $dto->setIcon($magicFlowAIModelEntity->getIcon());
        $dto->setVision($magicFlowAIModelEntity->isSupportMultiModal());
        $dto->setConfigs($magicFlowAIModelEntity->getDefaultConfigs());
        return $dto;
    }

    public static function createEnabledListDTO(array $list): array
    {
        $list = array_map(fn (MagicFlowAIModelEntity $entity) => self::createEnabledDTO($entity), $list);
        return [
            'models' => $list,
        ];
    }
}
