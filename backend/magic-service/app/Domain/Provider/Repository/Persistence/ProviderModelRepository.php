<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Persistence;

use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderModelQuery;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Factory\ProviderModelFactory;
use App\Domain\Provider\Repository\Facade\ProviderModelRepositoryInterface;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelModel;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Core\ValueObject\Page;

class ProviderModelRepository extends AbstractRepository implements ProviderModelRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    public function getById(ProviderDataIsolation $dataIsolation, int $id): ?ProviderModelEntity
    {
        $builder = $this->createBuilder($dataIsolation, ProviderModelModel::query());

        /** @var null|ProviderModelModel $model */
        $model = $builder->where('id', $id)->first();

        if (! $model) {
            return null;
        }

        return ProviderModelFactory::modelToEntity($model);
    }

    /**
     * 通过ID或ModelID查询模型，拆分为两次查询以有效利用索引.
     */
    public function getByIdOrModelId(ProviderDataIsolation $dataIsolation, string $id): ?ProviderModelEntity
    {
        // 先尝试按数字ID查询（如果$id是数字）
        if (is_numeric($id)) {
            $builder = $this->createBuilder($dataIsolation, ProviderModelModel::query());
            /** @var null|ProviderModelModel $model */
            $model = $builder->where('id', (int) $id)
                ->where('status', Status::Enabled->value)
                ->first();

            if ($model) {
                return ProviderModelFactory::modelToEntity($model);
            }
        }

        // 如果按ID没找到，再按model_id查询
        $builder = $this->createBuilder($dataIsolation, ProviderModelModel::query());
        /** @var null|ProviderModelModel $model */
        $model = $builder->where('model_id', $id)
            ->where('status', Status::Enabled->value)
            ->first();

        if (! $model) {
            return null;
        }

        return ProviderModelFactory::modelToEntity($model);
    }

    /**
     * @param array<int> $ids
     * @return array<int, ProviderModelEntity> 返回以id为key的实体对象数组
     */
    public function getByIds(ProviderDataIsolation $dataIsolation, array $ids): array
    {
        $builder = $this->createBuilder($dataIsolation, ProviderModelModel::query());

        /** @var array<ProviderModelModel> $models */
        $models = $builder->whereIn('id', $ids)->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[$model->id] = ProviderModelFactory::modelToEntity($model);
        }

        return $entities;
    }

    /**
     * @return array{total: int, list: array<ProviderModelEntity>}
     */
    public function queries(ProviderDataIsolation $dataIsolation, ProviderModelQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, ProviderModelModel::query());

        if ($query->getStatus()) {
            $builder->where('status', $query->getStatus()->value);
        }
        if ($query->getCategory()) {
            $builder->where('category', $query->getCategory()->value);
        }
        if ($query->getModelType()) {
            $builder->where('model_type', $query->getModelType()->value);
        }

        $result = $this->getByPage($builder, $page, $query);

        $list = [];
        /** @var ProviderModelModel $model */
        foreach ($result['list'] as $model) {
            $list[] = ProviderModelFactory::modelToEntity($model);
        }

        return [
            'total' => $result['total'],
            'list' => $list,
        ];
    }
}
