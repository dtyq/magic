<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Assembler;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\ModelGateway\Entity\ApplicationEntity;
use App\Infrastructure\Core\PageDTO;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Kernel\Assembler\FileAssembler;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use App\Interfaces\ModelGateway\DTO\ApplicationDTO;
use Dtyq\CloudFile\Kernel\Struct\FileLink;

class ApplicationAssembler
{
    public static function createDO(ApplicationDTO $DTO): ApplicationEntity
    {
        $DO = new ApplicationEntity();
        $DO->setId($DTO->getId());
        ! empty($DTO->getCode()) && $DO->setCode($DTO->getCode());
        ! is_null($DTO->getName()) && $DO->setName($DTO->getName());
        ! is_null($DTO->getDescription()) && $DO->setDescription($DTO->getDescription());
        ! is_null($DTO->getIcon()) && $DO->setIcon(FileAssembler::formatPath($DTO->getIcon()));
        return $DO;
    }

    /**
     * @param array<string, MagicUserEntity> $users
     * @param array<string, FileLink> $icons
     */
    public static function createDTO(ApplicationEntity $DO, array $users = [], array $icons = []): ApplicationDTO
    {
        $DTO = new ApplicationDTO();
        $DTO->setId($DO->getId());
        $DTO->setCode($DO->getCode());
        $DTO->setName($DO->getName());
        $DTO->setDescription($DO->getDescription());
        $DTO->setCreator($DO->getCreator());
        $DTO->setCreatedAt($DO->getCreatedAt());
        $DTO->setModifier($DO->getModifier());
        $DTO->setUpdatedAt($DO->getUpdatedAt());

        $DTO->setIcon(FileAssembler::getUrl($icons[$DO->getIcon()] ?? null));
        $DTO->setCreatorInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$DO->getCreator()] ?? null, $DO->getCreatedAt()));
        $DTO->setModifierInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$DO->getModifier()] ?? null, $DO->getUpdatedAt()));
        return $DTO;
    }

    /**
     * @param array{total: int, list: ApplicationEntity[], users: array<string, MagicUserEntity>, icons: array<string, FileLink>} $data
     */
    public static function createPageDTO(array $data, Page $page): PageDTO
    {
        $pageDTO = new PageDTO();
        $pageDTO->setPage($page->getPage());
        $pageDTO->setTotal($data['total']);
        $pageDTO->setList(array_map(fn (ApplicationEntity $DO) => self::createDTO($DO, $data['users'], $data['icons']), $data['list']));

        return $pageDTO;
    }
}
