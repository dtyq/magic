<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Mode\Repository\Persistence;

use App\Domain\Mode\Entity\ModeDataIsolation;
use App\Domain\Mode\Entity\ModeGroupRelationEntity;
use App\Domain\Mode\Factory\ModeGroupRelationFactory;
use App\Domain\Mode\Repository\Facade\ModeGroupRelationRepositoryInterface;
use App\Domain\Mode\Repository\Persistence\Model\ModeGroupRelationModel;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;

class ModeGroupRelationRepository extends AbstractRepository implements ModeGroupRelationRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    public function findById(ModeDataIsolation $dataIsolation, int|string $id): ?ModeGroupRelationEntity
    {
        $builder = $this->createBuilder($dataIsolation, ModeGroupRelationModel::query());
        $model = $builder->where('id', $id)->first();

        return $model ? ModeGroupRelationFactory::modelToEntity($model) : null;
    }

    /**
     * @return ModeGroupRelationEntity[]
     */
    public function findByModeId(ModeDataIsolation $dataIsolation, int|string $modeId): array
    {
        $builder = $this->createBuilder($dataIsolation, ModeGroupRelationModel::query());
        $models = $builder->where('mode_id', $modeId)
            ->orderBy('sort', 'desc')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = ModeGroupRelationFactory::modelToEntity($model);
        }
        return $entities;
    }

    /**
     * @return ModeGroupRelationEntity[]
     */
    public function findByGroupId(ModeDataIsolation $dataIsolation, int|string $groupId): array
    {
        $builder = $this->createBuilder($dataIsolation, ModeGroupRelationModel::query());
        $models = $builder->where('group_id', $groupId)
            ->orderBy('sort', 'asc')
            ->orderBy('created_at', 'asc')
            ->get();

        return $models->map(function ($model) {
            /* @var ModeGroupRelationModel $model */
            return ModeGroupRelationFactory::modelToEntity($model);
        })->toArray();
    }

    public function save(ModeGroupRelationEntity $relationEntity): ModeGroupRelationEntity
    {
        $model = new ModeGroupRelationModel();
        $model->fill($this->getAttributes($relationEntity));
        $model->save();

        $relationEntity->setId((string) $model->id);
        $relationEntity->setCreatedAt($model->created_at?->toDateTimeString());
        $relationEntity->setUpdatedAt($model->updated_at?->toDateTimeString());

        return $relationEntity;
    }

    public function deleteByGroupId(ModeDataIsolation $dataIsolation, int|string $groupId): bool
    {
        $builder = $this->createBuilder($dataIsolation, ModeGroupRelationModel::query());
        return $builder->where('group_id', $groupId)->delete() >= 0;
    }

    public function deleteByModeId(ModeDataIsolation $dataIsolation, int|string $modeId): bool
    {
        $builder = $this->createBuilder($dataIsolation, ModeGroupRelationModel::query());
        return $builder->where('mode_id', $modeId)->delete() >= 0;
    }

    /**
     * @param $relationEntities ModeGroupRelationEntity[]
     */
    public function batchSave(ModeDataIsolation $dataIsolation, array $relationEntities)
    {
        $builder = $this->createBuilder($dataIsolation, ModeGroupRelationModel::query());
        $data = [];
        foreach ($relationEntities as $relationEntity) {
            $relationEntity->setId(IdGenerator::getSnowId());
            $data[] = $relationEntity->toArray();
        }
        $builder->insert($data);
    }

    /**
     * 根据多个模式ID批量获取关联关系.
     * @param int[]|string[] $modeIds
     * @return ModeGroupRelationEntity[]
     */
    public function findByModeIds(ModeDataIsolation $dataIsolation, array $modeIds): array
    {
        if (empty($modeIds)) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, ModeGroupRelationModel::query());
        $models = $builder->whereIn('mode_id', $modeIds)
            ->orderBy('mode_id', 'asc')
            ->orderBy('sort', 'desc')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = ModeGroupRelationFactory::modelToEntity($model);
        }
        return $entities;
    }
}
