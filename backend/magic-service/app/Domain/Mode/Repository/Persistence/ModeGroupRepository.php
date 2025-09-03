<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Mode\Repository\Persistence;

use App\Domain\Mode\Entity\ModeDataIsolation;
use App\Domain\Mode\Entity\ModeGroupEntity;
use App\Domain\Mode\Factory\ModeGroupFactory;
use App\Domain\Mode\Repository\Facade\ModeGroupRepositoryInterface;
use App\Domain\Mode\Repository\Persistence\Model\ModeGroupModel;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Codec\Json;
use InvalidArgumentException;

class ModeGroupRepository extends AbstractRepository implements ModeGroupRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    public function findById(ModeDataIsolation $dataIsolation, int|string $id): ?ModeGroupEntity
    {
        $builder = $this->createBuilder($dataIsolation, ModeGroupModel::query());
        $model = $builder->where('id', $id)->first();

        return $model ? ModeGroupFactory::modelToEntity($model) : null;
    }

    /**
     * @return ModeGroupEntity[]
     */
    public function findByModeId(ModeDataIsolation $dataIsolation, int|string $modeId): array
    {
        $builder = $this->createBuilder($dataIsolation, ModeGroupModel::query());
        $models = $builder->where('mode_id', $modeId)
            ->orderBy('sort', 'desc')
            ->orderBy('created_at', 'asc')
            ->get();

        $data = [];
        foreach ($models as $model) {
            $data[] = ModeGroupFactory::modelToEntity($model);
        }
        return $data;
    }

    public function save(ModeDataIsolation $dataIsolation, ModeGroupEntity $groupEntity): ModeGroupEntity
    {
        $groupEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $groupEntity->setCreatorId($dataIsolation->getCurrentUserId());
        $dataIsolation->disabled();
        if (! $groupEntity->getId()) {
            $modeGroupModel = new ModeGroupModel();
            $groupEntity->setId(IdGenerator::getSnowId());
        } else {
            /** @var ModeGroupModel $modeGroupModel */
            $modeGroupModel = ModeGroupModel::find($groupEntity->getId());
        }

        $modeGroupModel->fill($this->getAttributes($groupEntity));
        $modeGroupModel->save();

        $groupEntity->setId($modeGroupModel->id);
        return $groupEntity;
    }

    public function update(ModeDataIsolation $dataIsolation, ModeGroupEntity $groupEntity): ModeGroupEntity
    {
        $groupEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $model = ModeGroupModel::query()->where('id', $groupEntity->getId())->first();
        if (! $model) {
            throw new InvalidArgumentException('Mode group not found');
        }

        $model->fill($this->getAttributes($groupEntity));
        $model->save();

        $groupEntity->setUpdatedAt($model->updated_at?->toDateTimeString());

        return $groupEntity;
    }

    /**
     * @return ModeGroupEntity[]
     */
    public function findEnabledByModeId(ModeDataIsolation $dataIsolation, int|string $modeId): array
    {
        $builder = $this->createBuilder($dataIsolation, ModeGroupModel::query());
        $models = $builder->where('mode_id', $modeId)
            ->where('status', 1)
            ->orderBy('sort', 'desc')
            ->orderBy('created_at', 'asc')
            ->get();

        $data = [];
        foreach ($models as $model) {
            $data[] = ModeGroupFactory::modelToEntity($model);
        }
        return $data;
    }

    public function updateStatus(ModeDataIsolation $dataIsolation, string $id, int $status): bool
    {
        $builder = $this->createBuilder($dataIsolation, ModeGroupModel::query());
        return $builder->where('id', $id)
            ->update(['status' => $status]) > 0;
    }

    public function delete(ModeDataIsolation $dataIsolation, int|string $id): bool
    {
        $builder = $this->createBuilder($dataIsolation, ModeGroupModel::query());
        return $builder->where('id', $id)->delete() > 0;
    }

    public function deleteByModeId(ModeDataIsolation $dataIsolation, int|string $modeId): bool
    {
        $builder = $this->createBuilder($dataIsolation, ModeGroupModel::query());
        $delete = $builder->where('mode_id', $modeId)->delete();
        return $delete >= 0;
    }

    /**
     * @param $groupEntities ModeGroupEntity[]
     */
    public function batchSave(ModeDataIsolation $dataIsolation, array $groupEntities)
    {
        $builder = $this->createBuilder($dataIsolation, ModeGroupModel::query());
        $data = [];
        foreach ($groupEntities as $groupEntity) {
            $array = $groupEntity->toArray();
            $array['name_i18n'] = Json::encode($array['name_i18n']);
            $data[] = $array;
        }
        $builder->insert($data);
    }

    /**
     * 根据多个模式ID批量获取分组列表.
     * @param int[]|string[] $modeIds
     * @return ModeGroupEntity[]
     */
    public function findByModeIds(ModeDataIsolation $dataIsolation, array $modeIds): array
    {
        if (empty($modeIds)) {
            return [];
        }

        $builder = $this->createBuilder($dataIsolation, ModeGroupModel::query());
        $models = $builder->whereIn('mode_id', $modeIds)
            ->orderBy('mode_id', 'asc')
            ->orderBy('sort', 'desc')
            ->orderBy('created_at', 'asc')
            ->get();

        $data = [];
        foreach ($models as $model) {
            $data[] = ModeGroupFactory::modelToEntity($model);
        }
        return $data;
    }
}
