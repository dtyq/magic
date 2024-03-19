<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Persistence;

use App\Domain\Flow\Entity\MagicFlowTriggerTestcaseEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowTriggerTestcaseQuery;
use App\Domain\Flow\Factory\MagicFlowTriggerTestcaseFactory;
use App\Domain\Flow\Repository\Facade\MagicFlowTriggerTestcaseRepositoryInterface;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowTriggerTestcaseModel;
use App\Infrastructure\Core\ValueObject\Page;

class MagicFlowTriggerTestcaseRepository extends MagicFlowAbstractRepository implements MagicFlowTriggerTestcaseRepositoryInterface
{
    public function save(FlowDataIsolation $dataIsolation, MagicFlowTriggerTestcaseEntity $magicFlowTriggerTestcaseEntity): MagicFlowTriggerTestcaseEntity
    {
        if (! $magicFlowTriggerTestcaseEntity->getId()) {
            $magicFlowTriggerTestcaseModel = new MagicFlowTriggerTestcaseModel();
        } else {
            $builder = $this->createBuilder($dataIsolation, MagicFlowTriggerTestcaseModel::query());
            /** @var MagicFlowTriggerTestcaseModel $magicFlowTriggerTestcaseModel */
            $magicFlowTriggerTestcaseModel = $builder->where('id', $magicFlowTriggerTestcaseEntity->getId())->first();
        }

        $magicFlowTriggerTestcaseModel->fill($this->getAttributes($magicFlowTriggerTestcaseEntity));
        $magicFlowTriggerTestcaseModel->save();

        $magicFlowTriggerTestcaseEntity->setId($magicFlowTriggerTestcaseModel->id);

        return $magicFlowTriggerTestcaseEntity;
    }

    public function getByCode(FlowDataIsolation $dataIsolation, string $code): ?MagicFlowTriggerTestcaseEntity
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowTriggerTestcaseModel::query());
        /** @var null|MagicFlowTriggerTestcaseModel $model */
        $model = $builder->where('code', $code)->first();
        if (! $model) {
            return null;
        }
        return MagicFlowTriggerTestcaseFactory::modelToEntity($model);
    }

    public function getByFlowCodeAndCode(FlowDataIsolation $dataIsolation, string $flowCode, string $code): ?MagicFlowTriggerTestcaseEntity
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowTriggerTestcaseModel::query());
        /** @var null|MagicFlowTriggerTestcaseModel $model */
        $model = $builder->where('flow_code', $flowCode)->where('code', $code)->first();
        if (! $model) {
            return null;
        }
        return MagicFlowTriggerTestcaseFactory::modelToEntity($model);
    }

    public function queries(FlowDataIsolation $dataIsolation, MagicFLowTriggerTestcaseQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowTriggerTestcaseModel::query());
        if ($query->flowCode) {
            $builder->where('flow_code', $query->flowCode);
        }
        $data = $this->getByPage($builder, $page, $query);
        if (! empty($data['list'])) {
            $list = [];
            foreach ($data['list'] as $model) {
                $list[] = MagicFlowTriggerTestcaseFactory::modelToEntity($model);
            }
            $data['list'] = $list;
        }

        return $data;
    }

    public function remove(FlowDataIsolation $dataIsolation, MagicFlowTriggerTestcaseEntity $magicFlowTriggerTestcaseEntity): void
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowTriggerTestcaseModel::query());
        $builder->where('code', $magicFlowTriggerTestcaseEntity->getCode())->delete();
    }
}
