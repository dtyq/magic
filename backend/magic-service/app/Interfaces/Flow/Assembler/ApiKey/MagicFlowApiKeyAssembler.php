<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\Assembler\ApiKey;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Flow\Entity\MagicFlowApiKeyEntity;
use App\Domain\Flow\Entity\ValueObject\ApiKeyType;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Flow\DTO\ApiKey\MagicFlowApiKeyDTO;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use App\Interfaces\Kernel\DTO\PageDTO;

class MagicFlowApiKeyAssembler
{
    public static function createFlowApiKeyDTOByMixed(mixed $data): ?MagicFlowApiKeyDTO
    {
        if ($data instanceof MagicFlowApiKeyDTO) {
            return $data;
        }
        if (is_array($data)) {
            return new MagicFlowApiKeyDTO($data);
        }
        return null;
    }

    public static function createDO(MagicFlowApiKeyDTO $apiKeyDTO): MagicFlowApiKeyEntity
    {
        $entity = new MagicFlowApiKeyEntity();
        $entity->setCode($apiKeyDTO->getId() ?? '');
        $entity->setFlowCode($apiKeyDTO->getFlowCode());
        $entity->setType(ApiKeyType::from($apiKeyDTO->getType()));
        $entity->setName($apiKeyDTO->getName());
        $entity->setDescription($apiKeyDTO->getDescription());
        $entity->setConversationId($apiKeyDTO->getConversationId());
        $entity->setEnabled($apiKeyDTO->isEnabled());
        return $entity;
    }

    /**
     * @param array<string, MagicUserEntity> $users
     */
    public static function createDTO(MagicFlowApiKeyEntity $magicFlowApiKeyEntity, array $users = []): MagicFlowApiKeyDTO
    {
        $DTO = new MagicFlowApiKeyDTO($magicFlowApiKeyEntity->toArray());
        $DTO->setId($magicFlowApiKeyEntity->getCode());
        $DTO->setCreator($magicFlowApiKeyEntity->getCreator());
        $DTO->setCreatedAt($magicFlowApiKeyEntity->getCreatedAt());
        $DTO->setModifier($magicFlowApiKeyEntity->getModifier());
        $DTO->setUpdatedAt($magicFlowApiKeyEntity->getUpdatedAt());
        $DTO->setCreatorInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$magicFlowApiKeyEntity->getCreator()] ?? null, $magicFlowApiKeyEntity->getCreatedAt()));
        $DTO->setModifierInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$magicFlowApiKeyEntity->getModifier()] ?? null, $magicFlowApiKeyEntity->getUpdatedAt()));
        return $DTO;
    }

    /**
     * @param MagicFlowApiKeyEntity[] $list
     */
    public static function createPageListDTO(int $total, array $list, Page $page, array $users = []): PageDTO
    {
        $list = array_map(fn (MagicFlowApiKeyEntity $entity) => self::createDTO($entity, $users), $list);
        return new PageDTO($page->getPage(), $total, $list);
    }
}
