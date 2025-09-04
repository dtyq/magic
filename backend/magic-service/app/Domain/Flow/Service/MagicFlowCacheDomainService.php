<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Service;

use App\Domain\Flow\Entity\MagicFlowCacheEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Repository\Facade\MagicFlowCacheRepositoryInterface;

/**
 * Flow缓存领域服务
 */
class MagicFlowCacheDomainService extends AbstractDomainService
{
    public function __construct(
        private readonly MagicFlowCacheRepositoryInterface $magicFlowCacheRepository,
    ) {
    }

    public function saveCache(FlowDataIsolation $dataIsolation, MagicFlowCacheEntity $entity): MagicFlowCacheEntity
    {
        $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $existingEntity = $this->magicFlowCacheRepository->findByPrefixAndKey($dataIsolation, $entity->getCachePrefix(), $entity->getCacheKey());

        if ($existingEntity) {
            $existingEntity->refresh($entity->getCacheValue(), $entity->getTtlSeconds());
            $existingEntity->setModifier($dataIsolation->getCurrentUserId());
            return $this->magicFlowCacheRepository->save($dataIsolation, $existingEntity);
        }
        $entity->setCreator($dataIsolation->getCurrentUserId());
        $entity->setModifier($dataIsolation->getCurrentUserId());
        $entity->prepareForCreation();
        return $this->magicFlowCacheRepository->save($dataIsolation, $entity);
    }

    public function getCache(FlowDataIsolation $dataIsolation, string $cachePrefix, string $cacheKey): ?MagicFlowCacheEntity
    {
        $entity = $this->magicFlowCacheRepository->findByPrefixAndKey($dataIsolation, $cachePrefix, $cacheKey);

        if ($entity && $entity->isExpired()) {
            $this->magicFlowCacheRepository->delete($dataIsolation, $entity);
            return null;
        }

        return $entity;
    }

    public function deleteCache(FlowDataIsolation $dataIsolation, string $cachePrefix, string $cacheKey): bool
    {
        return $this->magicFlowCacheRepository->deleteByPrefixAndKey($dataIsolation, $cachePrefix, $cacheKey);
    }
}
