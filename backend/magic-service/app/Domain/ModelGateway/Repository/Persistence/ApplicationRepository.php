<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository\Persistence;

use App\Domain\ModelGateway\Entity\ApplicationEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Entity\ValueObject\Query\ApplicationQuery;
use App\Domain\ModelGateway\Factory\ApplicationFactory;
use App\Domain\ModelGateway\Repository\Facade\ApplicationRepositoryInterface;
use App\Domain\ModelGateway\Repository\Persistence\Model\ApplicationModel;
use App\Infrastructure\Core\ValueObject\Page;

class ApplicationRepository extends AbstractRepository implements ApplicationRepositoryInterface
{
    public function save(LLMDataIsolation $dataIsolation, ApplicationEntity $LLMApplicationEntity): ApplicationEntity
    {
        if ($LLMApplicationEntity->getId()) {
            $builder = $this->createBuilder($dataIsolation, ApplicationModel::query());
            /** @var ApplicationModel $model */
            $model = $builder->where('id', $LLMApplicationEntity->getId())->first();
        } else {
            $model = new ApplicationModel();
        }
        $model->fill($this->getAttributes($LLMApplicationEntity));
        $model->save();

        $LLMApplicationEntity->setId($model->id);
        return $LLMApplicationEntity;
    }

    public function queries(LLMDataIsolation $dataIsolation, ApplicationQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, ApplicationModel::query());

        if (! is_null($query->getCreator())) {
            $builder->where('created_uid', $query->getCreator());
        }

        $data = $this->getByPage($builder, $page, $query);
        if (! empty($data['list'])) {
            $list = [];
            foreach ($data['list'] as $model) {
                $list[] = ApplicationFactory::modelToEntity($model);
            }
            $data['list'] = $list;
        }
        return $data;
    }

    public function getById(LLMDataIsolation $dataIsolation, int $id): ?ApplicationEntity
    {
        $builder = $this->createBuilder($dataIsolation, ApplicationModel::query());
        /** @var null|ApplicationModel $model */
        $model = $builder->where('id', $id)->first();
        return $model ? ApplicationFactory::modelToEntity($model) : null;
    }

    public function destroy(LLMDataIsolation $dataIsolation, ApplicationEntity $LLMApplicationEntity): void
    {
        $builder = $this->createBuilder($dataIsolation, ApplicationModel::query());
        $builder->where('id', $LLMApplicationEntity->getId())->delete();
    }

    public function getByCode(LLMDataIsolation $dataIsolation, string $code): ?ApplicationEntity
    {
        $builder = $this->createBuilder($dataIsolation, ApplicationModel::query());
        /** @var null|ApplicationModel $model */
        $model = $builder->where('code', $code)->first();
        return $model ? ApplicationFactory::modelToEntity($model) : null;
    }
}
