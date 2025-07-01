<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Persistence;

use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderConfigQuery;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Factory\ProviderConfigFactory;
use App\Domain\Provider\Repository\Facade\ProviderConfigRepositoryInterface;
use App\Domain\Provider\Repository\Persistence\Model\ProviderConfigModel;
use App\Infrastructure\Core\ValueObject\Page;

class ProviderConfigRepository extends ProviderAbstractRepository implements ProviderConfigRepositoryInterface
{
    public function getById(ProviderDataIsolation $dataIsolation, int $id, bool $checkProviderEnabled = true): ?ProviderConfigEntity
    {
        $builder = $this->createBuilder($dataIsolation, ProviderConfigModel::query());

        $builder->where('id', $id);
        if ($checkProviderEnabled) {
            $builder->where('status', Status::Enabled->value);
        }

        /** @var null|ProviderConfigModel $model */
        $model = $builder->first();

        if (! $model) {
            return null;
        }

        return ProviderConfigFactory::createEntity($model);
    }

    /**
     * @param array<int> $ids
     * @return array<int, ProviderConfigEntity>
     */
    public function getByIds(ProviderDataIsolation $dataIsolation, array $ids): array
    {
        $builder = $this->createBuilder($dataIsolation, ProviderConfigModel::query());
        $ids = array_values(array_unique($ids));

        /** @var array<ProviderConfigModel> $models */
        $models = $builder->whereIn('id', $ids)->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[$model->id] = ProviderConfigFactory::createEntity($model);
        }

        return $entities;
    }

    public function getByProviderId(ProviderDataIsolation $dataIsolation, int $providerId): ?ProviderConfigEntity
    {
        $builder = $this->createBuilder($dataIsolation, ProviderConfigModel::query());

        /** @var null|ProviderConfigModel $model */
        $model = $builder->where('service_provider_id', $providerId)->first();

        if (! $model) {
            return null;
        }

        return ProviderConfigFactory::createEntity($model);
    }

    /**
     * @return array{total: int, list: array<ProviderConfigEntity>}
     */
    public function queries(ProviderDataIsolation $dataIsolation, ProviderConfigQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, ProviderConfigModel::query());

        if ($query->getStatus()) {
            $builder->where('status', $query->getStatus()->value);
        }
        if (! is_null($query->getIds())) {
            $builder->whereIn('id', $query->getIds());
        }

        $result = $this->getByPage($builder, $page, $query);

        $list = [];
        /** @var ProviderConfigModel $model */
        foreach ($result['list'] as $model) {
            $list[] = ProviderConfigFactory::createEntity($model);
        }

        return [
            'total' => $result['total'],
            'list' => $list,
        ];
    }
}
