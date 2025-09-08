<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Persistence;

use App\Domain\Flow\Entity\MagicFlowCacheEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Factory\MagicFlowCacheFactory;
use App\Domain\Flow\Repository\Facade\MagicFlowCacheRepositoryInterface;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowCacheModel;

class MagicFlowCacheRepository extends MagicFlowAbstractRepository implements MagicFlowCacheRepositoryInterface
{
    public function save(FlowDataIsolation $dataIsolation, MagicFlowCacheEntity $entity): MagicFlowCacheEntity
    {
        if ($entity->shouldCreate()) {
            $entity->prepareForCreation();
            $model = new MagicFlowCacheModel();
        } else {
            /** @var MagicFlowCacheModel $model */
            $model = MagicFlowCacheModel::find($entity->getId());
        }

        $model->fill($this->getAttributes($entity));
        $model->save();

        $entity->setId($model->id);

        return $entity;
    }

    public function findByPrefixAndKey(FlowDataIsolation $dataIsolation, string $cachePrefix, string $cacheKey): ?MagicFlowCacheEntity
    {
        $cacheHash = $this->generateCacheHash($cachePrefix, $cacheKey);

        $builder = $this->createBuilder($dataIsolation, MagicFlowCacheModel::query());
        /** @var null|MagicFlowCacheModel $model */
        $model = $builder->where('cache_hash', $cacheHash)->first();

        if (! $model) {
            return null;
        }

        return MagicFlowCacheFactory::modelToEntity($model);
    }

    public function deleteByPrefixAndKey(FlowDataIsolation $dataIsolation, string $cachePrefix, string $cacheKey): bool
    {
        $cacheHash = $this->generateCacheHash($cachePrefix, $cacheKey);

        $builder = $this->createBuilder($dataIsolation, MagicFlowCacheModel::query());
        $deleted = $builder->where('cache_hash', $cacheHash)->delete();

        return $deleted > 0;
    }

    public function delete(FlowDataIsolation $dataIsolation, MagicFlowCacheEntity $entity): bool
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowCacheModel::query());
        $deleted = $builder->where('id', $entity->getId())->delete();

        return $deleted > 0;
    }

    /**
     * Generate cache hash using the same algorithm as MagicFlowCacheEntity.
     *
     * @param string $cachePrefix Cache prefix
     * @param string $cacheKey Cache key
     * @return string MD5 hash of the cache key
     */
    private function generateCacheHash(string $cachePrefix, string $cacheKey): string
    {
        return md5($cachePrefix . '+' . $cacheKey);
    }
}
