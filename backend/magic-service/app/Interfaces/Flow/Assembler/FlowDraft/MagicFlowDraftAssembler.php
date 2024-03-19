<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\Assembler\FlowDraft;

use App\Domain\Flow\Entity\MagicFlowDraftEntity;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Flow\DTO\FlowDraft\MagicFlowDraftDTO;
use App\Interfaces\Flow\DTO\FlowDraft\MagicFlowDraftListDTO;
use App\Interfaces\Kernel\Assembler\FileAssembler;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use App\Interfaces\Kernel\DTO\PageDTO;

class MagicFlowDraftAssembler
{
    public static function createFlowDraftDTOByMixed(mixed $data): ?MagicFlowDraftDTO
    {
        if ($data instanceof MagicFlowDraftDTO) {
            return $data;
        }
        if (is_array($data)) {
            return new MagicFlowDraftDTO($data);
        }
        return null;
    }

    /**
     * @param array<MagicFlowDraftEntity> $list
     */
    public static function createPageListDTO(int $total, array $list, Page $page, array $users = []): PageDTO
    {
        $list = array_map(fn (MagicFlowDraftEntity $magicFlowDraftEntity) => self::createMagicFlowDraftListDTO($magicFlowDraftEntity, $users), $list);
        return new PageDTO($page->getPage(), $total, $list);
    }

    public static function createMagicFlowDraftDO(MagicFlowDraftDTO $magicFlowDraftDTO): MagicFlowDraftEntity
    {
        $magicFlowDraft = new MagicFlowDraftEntity();
        $magicFlowDraft->setFlowCode($magicFlowDraftDTO->getFlowCode());
        $magicFlowDraft->setCode((string) $magicFlowDraftDTO->getId());
        $magicFlowDraft->setName($magicFlowDraftDTO->getName());
        $magicFlowDraft->setDescription($magicFlowDraftDTO->getDescription());
        $magicFlowDraft->setMagicFlow($magicFlowDraftDTO->getMagicFLow());
        return $magicFlowDraft;
    }

    public static function createMagicFlowDraftDTO(MagicFlowDraftEntity $magicFlowDraft, array $users = [], array $icons = []): MagicFlowDraftDTO
    {
        $dto = new MagicFlowDraftDTO($magicFlowDraft->toArray());
        $dto->setId($magicFlowDraft->getCode());
        $dto->setCreatorInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$magicFlowDraft->getCreator()] ?? null, $magicFlowDraft->getCreatedAt()));
        $dto->setModifierInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$magicFlowDraft->getModifier()] ?? null, $magicFlowDraft->getUpdatedAt()));
        if (isset($dto->getMagicFLow()['icon'])) {
            $dto->getMagicFLow()['icon'] = FileAssembler::getUrl($icons[$magicFlowDraft->getMagicFlow()['icon']] ?? null);
        }
        return $dto;
    }

    protected static function createMagicFlowDraftListDTO(MagicFlowDraftEntity $magicFlowDraftEntity, array $users = []): MagicFlowDraftListDTO
    {
        $dto = new MagicFlowDraftListDTO($magicFlowDraftEntity->toArray());
        $dto->setId($magicFlowDraftEntity->getCode());
        $dto->setCreatorInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$magicFlowDraftEntity->getCreator()] ?? null, $magicFlowDraftEntity->getCreatedAt()));
        $dto->setModifierInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$magicFlowDraftEntity->getModifier()] ?? null, $magicFlowDraftEntity->getUpdatedAt()));
        return $dto;
    }
}
