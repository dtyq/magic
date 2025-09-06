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
     * 获取全局配置.
     */
    public function getGlobal(string $key): ?MagicUserSettingEntity
    {
        return $this->magicUserSettingRepository->getGlobal($key);
    }

    /**
     * 保存全局配置.
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

    /**
     * 通过 magicId 保存用户设置（跨组织）.
     */
    public function saveByMagicId(string $magicId, MagicUserSettingEntity $magicUserSettingEntity): MagicUserSettingEntity
    {
        // 获取现有记录以保持实体完整性
        $existingEntity = $this->magicUserSettingRepository->getByMagicId($magicId, $magicUserSettingEntity->getKey());

        if ($existingEntity) {
            $magicUserSettingEntity->prepareForModification($existingEntity);
        } else {
            $magicUserSettingEntity->prepareForCreation();
        }

        return $this->magicUserSettingRepository->saveByMagicId($magicId, $magicUserSettingEntity);
    }

    /**
     * 通过 magicId 获取用户设置（跨组织）.
     */
    public function getByMagicId(string $magicId, string $key): ?MagicUserSettingEntity
    {
        return $this->magicUserSettingRepository->getByMagicId($magicId, $key);
    }
}
