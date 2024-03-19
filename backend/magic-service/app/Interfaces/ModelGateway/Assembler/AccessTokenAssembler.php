<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Assembler;

use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\ModelGateway\Entity\AccessTokenEntity;
use App\Domain\ModelGateway\Entity\ValueObject\AccessTokenType;
use App\Infrastructure\Core\PageDTO;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Kernel\Assembler\OperatorAssembler;
use App\Interfaces\ModelGateway\DTO\AccessTokenDTO;

class AccessTokenAssembler
{
    public static function createDO(AccessTokenDTO $DTO): AccessTokenEntity
    {
        $type = AccessTokenType::from($DTO->getType());
        $DO = new AccessTokenEntity();
        $DO->setId($DTO->getId());
        $DO->setType($type);
        $DO->setRelationId($DTO->getRelationId() ?? '');
        $DO->setName($DTO->getName() ?? '');
        $DO->setDescription($DTO->getDescription() ?? '');
        $DO->setModels($DTO->getModels() ?? []);
        $DO->setIpLimit($DTO->getIpLimit() ?? []);
        $DO->setExpireTime($DTO->getExpireTime());
        $DO->setTotalAmount($DTO->getTotalAmount());
        $DO->setRpm($DTO->getRpm() ?? 0);
        return $DO;
    }

    /**
     * @param array<string, MagicUserEntity> $users
     */
    public static function createDTO(AccessTokenEntity $DO, array $users = []): AccessTokenDTO
    {
        $DTO = new AccessTokenDTO();
        $DTO->setId($DO->getId());
        $DTO->setType($DO->getType()->value);
        $DTO->setAccessToken($DO->getAccessToken());
        $DTO->setRelationId($DO->getRelationId());
        $DTO->setName($DO->getName());
        $DTO->setDescription($DO->getDescription());
        $DTO->setModels($DO->getModels());
        $DTO->setIpLimit($DO->getIpLimit());
        $DTO->setExpireTime($DO->getExpireTime());
        $DTO->setTotalAmount($DO->getTotalAmount());
        $DTO->setUseAmount($DO->getUseAmount());
        $DTO->setRpm($DO->getRpm());
        $DTO->setCreator($DO->getCreator());
        $DTO->setModifier($DO->getModifier());
        $DTO->setCreatedAt($DO->getCreatedAt());
        $DTO->setUpdatedAt($DO->getUpdatedAt());
        $DTO->setCreatorInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$DO->getCreator()] ?? null, $DO->getCreatedAt()));
        $DTO->setModifierInfo(OperatorAssembler::createOperatorDTOByUserEntity($users[$DO->getModifier()] ?? null, $DO->getUpdatedAt()));
        return $DTO;
    }

    /**
     * @param array{total: int, list: AccessTokenEntity[], users: array<string, MagicUserEntity>} $data
     */
    public static function createPageDTO(array $data, Page $page): PageDTO
    {
        $pageDTO = new PageDTO();
        $pageDTO->setPage($page->getPage());
        $pageDTO->setTotal($data['total']);
        $pageDTO->setList(array_map(fn (AccessTokenEntity $DO) => self::createDTO($DO, $data['users']), $data['list']));
        return $pageDTO;
    }
}
