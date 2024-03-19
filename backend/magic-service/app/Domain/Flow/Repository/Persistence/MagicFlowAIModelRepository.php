<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Persistence;

use App\Domain\Flow\Entity\MagicFlowAIModelEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowAIModelQuery;
use App\Domain\Flow\Factory\MagicFlowAIModelFactory;
use App\Domain\Flow\Repository\Facade\MagicFlowAIModelRepositoryInterface;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowAIModelModel;
use App\Infrastructure\Core\ValueObject\Page;

class MagicFlowAIModelRepository extends MagicFlowAbstractRepository implements MagicFlowAIModelRepositoryInterface
{
    public function save(FlowDataIsolation $dataIsolation, MagicFlowAIModelEntity $magicFlowAIModelEntity): MagicFlowAIModelEntity
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowAIModelModel::query());
        $model = $builder->where('name', $magicFlowAIModelEntity->getName())->first();
        if (! $model) {
            $model = new MagicFlowAIModelModel();
        }
        $model->fill($this->getAttributes($magicFlowAIModelEntity));
        $model->save();
        $magicFlowAIModelEntity->setId($model->id);
        return $magicFlowAIModelEntity;
    }

    public function getByName(FlowDataIsolation $dataIsolation, string $name): ?MagicFlowAIModelEntity
    {
        if (empty($name)) {
            return null;
        }
        $builder = $this->createBuilder($dataIsolation, MagicFlowAIModelModel::query());
        /** @var null|MagicFlowAIModelModel $model */
        $model = $builder->where('name', $name)->first();
        if (! $model) {
            return null;
        }
        return MagicFlowAIModelFactory::modelToEntity($model);
    }

    public function queries(FlowDataIsolation $dataIsolation, MagicFlowAIModelQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowAIModelModel::query());

        if ($query->getEnabled() !== null) {
            $builder->where('enabled', $query->getEnabled());
        }
        if ($query->getDisplay() !== null) {
            $builder->where('display', $query->getDisplay());
        }
        if ($query->getSupportEmbedding() !== null) {
            $builder->where('support_embedding', $query->getSupportEmbedding());
        }

        $data = $this->getByPage($builder, $page, $query);

        if (! empty($data['list'])) {
            $list = [];
            foreach ($data['list'] as $value) {
                $list[] = MagicFlowAIModelFactory::modelToEntity($value);
            }
            $data['list'] = $list;
        }

        return $data;
    }
}
