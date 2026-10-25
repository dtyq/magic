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
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Locker\LockerInterface;

readonly class MagicUserSettingDomainService
{
    public function __construct(
        private MagicUserSettingRepositoryInterface $magicUserSettingRepository,
        private LockerInterface $locker,
    ) {
    }

    public function get(DataIsolation $dataIsolation, string $key): ?MagicUserSettingEntity
    {
        return $this->magicUserSettingRepository->get($dataIsolation, $key);
    }

    /**
     * Get a global setting.
     */
    public function getGlobal(string $key): ?MagicUserSettingEntity
    {
        return $this->magicUserSettingRepository->getGlobal($key);
    }

    /**
     * Save a global setting.
     */
    public function saveGlobal(MagicUserSettingEntity $savingEntity): MagicUserSettingEntity
    {
        return $this->magicUserSettingRepository->saveGlobal($savingEntity);
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
        $savingEntity->setMagicId($dataIsolation->getCurrentMagicId());
        $savingEntity->setUserId($dataIsolation->getCurrentUserId());

        $lockName = sprintf('user_setting:save:%s:%s', $savingEntity->getUserId(), $savingEntity->getKey());
        $lockOwner = uniqid('user_setting_', true);

        if (! $this->locker->mutexLock($lockName, $lockOwner, 10)) {
            ExceptionBuilder::throw(GenericErrorCode::TooManyRequests);
        }

        try {
            $existingEntity = $this->magicUserSettingRepository->get($dataIsolation, $savingEntity->getKey());
            if ($existingEntity) {
                $savingEntity->prepareForModification($existingEntity);
                $entity = $savingEntity;
            } else {
                $entity = clone $savingEntity;
                $entity->prepareForCreation();
            }

            return $this->magicUserSettingRepository->save($dataIsolation, $entity);
        } finally {
            $this->locker->release($lockName, $lockOwner);
        }
    }

    /**
     * Save a user setting by magicId (cross organization).
     */
    public function saveByMagicId(string $magicId, MagicUserSettingEntity $magicUserSettingEntity): MagicUserSettingEntity
    {
        // Fetch the existing record to keep the entity complete
        $existingEntity = $this->magicUserSettingRepository->getByMagicId($magicId, $magicUserSettingEntity->getKey());

        if ($existingEntity) {
            $magicUserSettingEntity->prepareForModification($existingEntity);
        } else {
            $magicUserSettingEntity->prepareForCreation();
        }

        return $this->magicUserSettingRepository->saveByMagicId($magicId, $magicUserSettingEntity);
    }

    /**
     * Get an organization-level setting by key (user_id and magic_id are NULL).
     */
    public function getByOrganizationCode(string $organizationCode, string $key): ?MagicUserSettingEntity
    {
        return $this->magicUserSettingRepository->getByOrganizationCode($organizationCode, $key);
    }

    /**
     * Save an organization-level setting (user_id and magic_id are NULL).
     *
     * The caller owns the transaction boundary: take the mutex lock before
     * reading the current value if a read-modify-write cycle is required.
     */
    public function saveByOrganizationCode(string $organizationCode, MagicUserSettingEntity $savingEntity): MagicUserSettingEntity
    {
        $existingEntity = $this->magicUserSettingRepository->getByOrganizationCode(
            $organizationCode,
            $savingEntity->getKey()
        );

        // Keep the modifier supplied by the application layer. The entity's
        // generic modification helper preserves the original creator.
        $modifier = $savingEntity->getModifier();
        if ($existingEntity) {
            $savingEntity->prepareForModification($existingEntity);
            $savingEntity->setModifier($modifier);
        } else {
            $savingEntity->prepareForCreation();
        }

        return $this->magicUserSettingRepository->saveByOrganizationCode($organizationCode, $savingEntity);
    }

    /**
     * Get user settings by magicId (cross organization).
     */
    public function getByMagicId(string $magicId, string $key): ?MagicUserSettingEntity
    {
        return $this->magicUserSettingRepository->getByMagicId($magicId, $key);
    }
}
