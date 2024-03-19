<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Persistence;

use App\Domain\Flow\Entity\MagicFlowDraftEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFLowDraftQuery;
use App\Domain\Flow\Factory\MagicFlowDraftFactory;
use App\Domain\Flow\Repository\Facade\MagicFlowDraftRepositoryInterface;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowDraftModel;
use App\Infrastructure\Core\ValueObject\Page;

class MagicFlowDraftRepository extends MagicFlowAbstractRepository implements MagicFlowDraftRepositoryInterface
{
    public function save(FlowDataIsolation $dataIsolation, MagicFlowDraftEntity $magicFlowDraftEntity): MagicFlowDraftEntity
    {
        if (! $magicFlowDraftEntity->getId()) {
            $magicFlowDraftModel = new MagicFlowDraftModel();
        } else {
            $builder = $this->createBuilder($dataIsolation, MagicFlowDraftModel::query());
            $magicFlowDraftModel = $builder->where('id', $magicFlowDraftEntity->getId())->first();
        }

        $magicFlowDraftModel->fill($this->getAttributes($magicFlowDraftEntity));
        $magicFlowDraftModel->save();

        $magicFlowDraftEntity->setId($magicFlowDraftModel->id);

        return $magicFlowDraftEntity;
    }

    public function getByCode(FlowDataIsolation $dataIsolation, string $code): ?MagicFlowDraftEntity
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowDraftModel::query());
        /** @var null|MagicFlowDraftModel $draftModel */
        $draftModel = $builder->where('code', $code)->first();
        if (! $draftModel) {
            return null;
        }
        return MagicFlowDraftFactory::modelToEntity($draftModel);
    }

    public function getByFlowCodeAndCode(FlowDataIsolation $dataIsolation, string $flowCode, string $code): ?MagicFlowDraftEntity
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowDraftModel::query());
        /** @var null|MagicFlowDraftModel $draftModel */
        $draftModel = $builder->where('flow_code', $flowCode)->where('code', $code)->first();
        if (! $draftModel) {
            return null;
        }
        return MagicFlowDraftFactory::modelToEntity($draftModel);
    }

    public function queries(FlowDataIsolation $dataIsolation, MagicFLowDraftQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowDraftModel::query());
        if ($query->flowCode) {
            $builder->where('flow_code', $query->flowCode);
        }

        $data = $this->getByPage($builder, $page, $query);
        if (! empty($data['list'])) {
            $list = [];
            foreach ($data['list'] as $draftModel) {
                $list[] = MagicFlowDraftFactory::modelToEntity($draftModel);
            }
            $data['list'] = $list;
        }

        return $data;
    }

    public function remove(FlowDataIsolation $dataIsolation, MagicFlowDraftEntity $magicFlowDraftEntity): void
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowDraftModel::query());
        $builder->where('code', $magicFlowDraftEntity->getCode())->delete();
    }

    public function clearEarlyRecords(FlowDataIsolation $dataIsolation, string $flowCode): void
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowDraftModel::query());
        $builder->where('flow_code', $flowCode)->orderBy('id', 'asc');

        $count = $builder->count();

        if ($count > MagicFlowDraftEntity::MAX_RECORD) {
            $builder->offset(MagicFlowDraftEntity::MAX_RECORD)->take($count - MagicFlowDraftEntity::MAX_RECORD)->delete();
        }
    }
}
