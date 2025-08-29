<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Repository\Persistence;

use App\Infrastructure\Core\ValueObject\Page;
use Dtyq\SuperMagic\Domain\Agent\Entity\SuperMagicAgentEntity;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\Query\SuperMagicAgentQuery;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Factory\SuperMagicAgentFactory;
use Dtyq\SuperMagic\Domain\Agent\Repository\Facade\SuperMagicAgentRepositoryInterface;
use Dtyq\SuperMagic\Domain\Agent\Repository\Persistence\Model\SuperMagicAgentModel;

class SuperMagicAgentRepository extends SuperMagicAbstractRepository implements SuperMagicAgentRepositoryInterface
{
    public function getByCode(SuperMagicAgentDataIsolation $dataIsolation, string $code): ?SuperMagicAgentEntity
    {
        $builder = $this->createBuilder($dataIsolation, SuperMagicAgentModel::query());

        /** @var null|SuperMagicAgentModel $model */
        $model = $builder->where('code', $code)->first();

        if (! $model) {
            return null;
        }

        return SuperMagicAgentFactory::createEntity($model);
    }

    public function queries(SuperMagicAgentDataIsolation $dataIsolation, SuperMagicAgentQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, SuperMagicAgentModel::query());

        if (! is_null($query->getCodes())) {
            if (empty($query->getCodes())) {
                return ['total' => 0, 'list' => []];
            }
            $builder->whereIn('code', $query->getCodes());
        }

        if ($query->getCreatorId() !== null) {
            $builder->where('creator', $query->getCreatorId());
        }

        if ($query->getName()) {
            $builder->where('name', 'like', '%' . $query->getName() . '%');
        }

        if ($query->getEnabled() !== null) {
            $builder->where('enabled', $query->getEnabled());
        }

        $result = $this->getByPage($builder, $page, $query);

        $list = [];

        /** @var SuperMagicAgentModel $model */
        foreach ($result['list'] as $model) {
            $entity = SuperMagicAgentFactory::createEntity($model);
            $list[] = $entity;
        }
        $result['list'] = $list;

        return $result;
    }

    public function save(SuperMagicAgentDataIsolation $dataIsolation, SuperMagicAgentEntity $entity): SuperMagicAgentEntity
    {
        if (! $entity->getId()) {
            $model = new SuperMagicAgentModel();
        } else {
            $builder = $this->createBuilder($dataIsolation, SuperMagicAgentModel::query());
            $model = $builder->where('id', $entity->getId())->first();
        }

        $model->fill($this->getAttributes($entity));
        $model->save();

        $entity->setId($model->id);
        return $entity;
    }

    public function delete(SuperMagicAgentDataIsolation $dataIsolation, string $code): bool
    {
        $builder = $this->createBuilder($dataIsolation, SuperMagicAgentModel::query());
        return $builder->where('code', $code)->delete() > 0;
    }

    public function countByCreator(SuperMagicAgentDataIsolation $dataIsolation, string $creator): int
    {
        $builder = $this->createBuilder($dataIsolation, SuperMagicAgentModel::query());
        return $builder->where('creator', $creator)->count();
    }
}
