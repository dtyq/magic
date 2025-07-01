<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Service;

use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\Query\MagicUserSettingQuery;
use App\Domain\Contact\Repository\Facade\MagicUserSettingRepositoryInterface;
use App\Infrastructure\Core\ValueObject\Page;

readonly class MagicUserSettingDomainService
{
    public function __construct(
        private MagicUserSettingRepositoryInterface $magicUserSettingRepository
    ) {
    }

    public function get(DataIsolation $dataIsolation, string $key): ?MagicUserSettingEntity
    {
        return $this->magicUserSettingRepository->get($dataIsolation, $key);
    }

    /**
     * @return array{total: int, list: array<MagicUserSettingEntity>}
     */
    public function queries(DataIsolation $dataIsolation, MagicUserSettingQuery $query, Page $page): array
    {
        return $this->magicUserSettingRepository->queries($dataIsolation, $query, $page);
    }

    public function save(DataIsolation $dataIsolation, MagicUserSettingEntity $savingEntity): MagicUserSettingEntity
    {
        $savingEntity->setCreator($dataIsolation->getCurrentUserId());
        $savingEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $savingEntity->setUserId($dataIsolation->getCurrentUserId());

        $existingEntity = $this->magicUserSettingRepository->get($dataIsolation, $savingEntity->getKey());
        if ($existingEntity) {
            $savingEntity->prepareForModification($existingEntity);
            $entity = $savingEntity;
        } else {
            $entity = clone $savingEntity;
            $entity->prepareForCreation();
        }

        return $this->magicUserSettingRepository->save($dataIsolation, $entity);
    }
}
