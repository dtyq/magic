<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\OrganizationEnvironment\Assembler;

use App\Domain\OrganizationEnvironment\Entity\OrganizationEntity;
use App\Interfaces\OrganizationEnvironment\DTO\OrganizationCreatorResponseDTO;
use App\Interfaces\OrganizationEnvironment\DTO\OrganizationListResponseDTO;
use App\Interfaces\OrganizationEnvironment\DTO\OrganizationResponseDTO;

class OrganizationAssembler
{
    /**
     * @param OrganizationEntity[] $entities
     */
    public static function assembleList(array $entities, array $creatorMap = []): OrganizationListResponseDTO
    {
        $list = [];
        foreach ($entities as $entity) {
            $creatorId = $entity->getCreatorId();
            /** @var null|OrganizationCreatorResponseDTO $creator */
            $creator = $creatorMap[$creatorId] ?? null;
            if ($creator === null && $creatorId !== null && $creatorId !== '') {
                $creator = new OrganizationCreatorResponseDTO();
                $creator->setUserId($creatorId);
            }
            $list[] = self::assembleItem($entity, $creator);
        }
        $dto = new OrganizationListResponseDTO();
        $dto->setList($list);
        return $dto;
    }

    public static function assembleItem(OrganizationEntity $entity, ?OrganizationCreatorResponseDTO $creator = null): OrganizationResponseDTO
    {
        $dto = new OrganizationResponseDTO();
        $dto->setId($entity->getId());
        $dto->setMagicOrganizationCode($entity->getMagicOrganizationCode());
        $dto->setName($entity->getName());
        $dto->setStatus($entity->getStatus());
        $dto->setType($entity->getType());
        $dto->setSeats($entity->getSeats());
        $dto->setSyncType($entity->getSyncType());
        $dto->setSyncStatus($entity->getSyncStatus()?->value);
        $dto->setSyncTime($entity->getSyncTime()?->format('Y-m-d H:i:s') ?? '');
        $dto->setCreatedAt($entity->getCreatedAt()?->format('Y-m-d H:i:s') ?? '');
        $dto->setCreatorId($entity->getCreatorId());
        if ($creator !== null) {
            $dto->setCreator($creator);
        }
        return $dto;
    }
}
