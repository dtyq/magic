<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository\Persistence;

use App\Domain\ModelGateway\Entity\ModelConfigEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\Query\ModelConfigQuery;
use App\Domain\ModelGateway\Factory\ModelConfigFactory;
use App\Domain\ModelGateway\Repository\Facade\ModelConfigRepositoryInterface;
use App\Domain\ModelGateway\Repository\Persistence\Model\ModelConfigModel;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\DbConnection\Db;

class ModelConfigRepository extends AbstractRepository implements ModelConfigRepositoryInterface
{
    public function save(LLMDataIsolation $dataIsolation, ModelConfigEntity $modelConfigEntity): ModelConfigEntity
    {
        // 由于可能双写2张表，因此开事务。又由于不想生成代理类，因此使用 Db::transaction
        return Db::transaction(function () use ($dataIsolation, $modelConfigEntity) {
            $model = $this->createBuilder($dataIsolation, ModelConfigModel::query())->where('model', $modelConfigEntity->getModel())->first();
            if (! $model) {
                $model = new ModelConfigModel();
            }
            $attributes = $this->getAttributes($modelConfigEntity);
            // 无法被修改的字段
            unset($attributes['use_amount']);
            $model->fill($attributes);
            $model->save();
            $modelConfigEntity->setId($model->id);
            $modelConfigEntity->setCreatedAt($model->created_at);
            $modelConfigEntity->setUpdatedAt($model->updated_at);
            return $modelConfigEntity;
        });
    }

    public function getByModel(LLMDataIsolation $dataIsolation, string $model): ?ModelConfigEntity
    {
        /** @var null|ModelConfigModel $configModel */
        $configModel = $this->createBuilder($dataIsolation, ModelConfigModel::query())->where('model', $model)->first();
        return $configModel ? ModelConfigFactory::modelToEntity($configModel) : null;
    }

    /**
     * 根据ID获取模型配置.
     */
    public function getById(LLMDataIsolation $dataIsolation, string $id): ?ModelConfigEntity
    {
        /** @var null|ModelConfigModel $configModel */
        $configModel = $this->createBuilder($dataIsolation, ModelConfigModel::query())->where('id', $id)->first();
        return $configModel ? ModelConfigFactory::modelToEntity($configModel) : null;
    }

    /**
     * 根据endpoint或type获取模型配置.
     */
    public function getByEndpointOrType(LLMDataIsolation $dataIsolation, string $endpointOrType): ?ModelConfigEntity
    {
        /** @var null|ModelConfigModel $configModel */
        $configModel = $this->createBuilder($dataIsolation, ModelConfigModel::query())->where('model', $endpointOrType)
            ->orWhere('type', $endpointOrType)
            ->first();
        return $configModel ? ModelConfigFactory::modelToEntity($configModel) : null;
    }

    /**
     * @return array{total: int, list: ModelConfigEntity[]}
     */
    public function queries(LLMDataIsolation $dataIsolation, Page $page, ModelConfigQuery $modelConfigQuery): array
    {
        $builder = $this->createBuilder($dataIsolation, ModelConfigModel::query());
        if (! is_null($modelConfigQuery->getEnabled())) {
            $builder->where('enabled', $modelConfigQuery->getEnabled());
        }
        $data = $this->getByPage($builder, $page, $modelConfigQuery);
        if (! empty($data['list'])) {
            $list = [];
            foreach ($data['list'] as $model) {
                $list[] = ModelConfigFactory::modelToEntity($model);
            }
            $data['list'] = $list;
        }
        return $data;
    }

    public function incrementUseAmount(LLMDataIsolation $dataIsolation, ModelConfigEntity $modelConfigEntity, float $amount): void
    {
        $builder = $this->createBuilder($dataIsolation, ModelConfigModel::query());
        $builder->where('id', $modelConfigEntity->getId())->increment('use_amount', $amount);
    }

    public function getByModels(LLMDataIsolation $dataIsolation, array $models): array
    {
        $builder = $this->createBuilder($dataIsolation, ModelConfigModel::query());
        if (! in_array('all', $models)) {
            $builder = $builder->whereIn('model', $models);
        }
        $models = $builder->get();
        $list = [];
        foreach ($models as $model) {
            $list[] = ModelConfigFactory::modelToEntity($model);
        }
        return $list;
    }
}
