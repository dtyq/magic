<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Persistence;

use App\Domain\Flow\Entity\MagicFlowVersionEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowVersionQuery;
use App\Domain\Flow\Factory\MagicFlowVersionFactory;
use App\Domain\Flow\Repository\Facade\MagicFlowVersionRepositoryInterface;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowVersionModel;
use App\Infrastructure\Core\ValueObject\Page;

class MagicFlowVersionRepository extends MagicFlowAbstractRepository implements MagicFlowVersionRepositoryInterface
{
    public function create(FlowDataIsolation $dataIsolation, MagicFlowVersionEntity $magicFlowVersionEntity): MagicFlowVersionEntity
    {
        $model = new MagicFlowVersionModel();

        $model->fill($this->getAttributes($magicFlowVersionEntity));
        $model->save();

        $magicFlowVersionEntity->setId($model->id);
        return $magicFlowVersionEntity;
    }

    public function getByCode(FlowDataIsolation $dataIsolation, string $code): ?MagicFlowVersionEntity
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowVersionModel::query());
        /** @var null|MagicFlowVersionModel $model */
        $model = $builder->where('code', $code)->first();
        if (! $model) {
            return null;
        }
        return MagicFlowVersionFactory::modelToEntity($model);
    }

    public function getByFlowCodeAndCode(FlowDataIsolation $dataIsolation, string $flowCode, string $code): ?MagicFlowVersionEntity
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowVersionModel::query());
        /** @var null|MagicFlowVersionModel $model */
        $model = $builder->where('flow_code', $flowCode)->where('code', $code)->first();
        if (! $model) {
            return null;
        }
        return MagicFlowVersionFactory::modelToEntity($model);
    }

    public function queries(FlowDataIsolation $dataIsolation, MagicFLowVersionQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowVersionModel::query());
        if ($query->flowCode) {
            $builder->where('flow_code', $query->flowCode);
        }
        $data = $this->getByPage($builder, $page, $query);
        if (! empty($data['list'])) {
            $list = [];
            foreach ($data['list'] as $model) {
                $list[] = MagicFlowVersionFactory::modelToEntity($model);
            }
            $data['list'] = $list;
        }

        return $data;
    }

    public function getLastVersion(FlowDataIsolation $dataIsolation, string $flowCode): ?MagicFlowVersionEntity
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowVersionModel::query());
        /** @var null|MagicFlowVersionModel $model */
        $model = $builder->where('flow_code', $flowCode)->orderByDesc('id')->first();
        if (! $model) {
            return null;
        }
        return MagicFlowVersionFactory::modelToEntity($model);
    }

    public function existVersion(FlowDataIsolation $dataIsolation, string $flowCode): bool
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowVersionModel::query());
        return $builder->where('flow_code', $flowCode)->exists();
    }

    public function getByCodes(FlowDataIsolation $dataIsolation, array $versionCodes): array
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowVersionModel::query());
        /** @var array<MagicFlowVersionModel> $models */
        $models = $builder->whereIn('code', $versionCodes)->get();
        if (empty($models)) {
            return [];
        }
        $list = [];
        foreach ($models as $model) {
            $list[] = MagicFlowVersionFactory::modelToEntity($model);
        }
        return $list;
    }
}
