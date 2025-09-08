<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Mode\Repository\Persistence;

use App\Domain\Mode\Entity\ModeDataIsolation;
use App\Domain\Mode\Entity\ModeEntity;
use App\Domain\Mode\Entity\ValueQuery\ModeQuery;
use App\Domain\Mode\Factory\ModeFactory;
use App\Domain\Mode\Repository\Facade\ModeRepositoryInterface;
use App\Domain\Mode\Repository\Persistence\Model\ModeModel;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\IdGenerator\IdGenerator;

class ModeRepository extends AbstractRepository implements ModeRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    public function findById(ModeDataIsolation $dataIsolation, int|string $id): ?ModeEntity
    {
        $dataIsolation->disabled();
        $builder = $this->createBuilder($dataIsolation, ModeModel::query());
        $model = $builder->where('id', $id)->first();

        return $model ? ModeFactory::modelToEntity($model) : null;
    }

    public function findByIdentifier(ModeDataIsolation $dataIsolation, string $identifier): ?ModeEntity
    {
        $builder = $this->createBuilder($dataIsolation, ModeModel::query());
        $model = $builder->where('identifier', $identifier)->first();

        return $model ? ModeFactory::modelToEntity($model) : null;
    }

    public function findDefaultMode(ModeDataIsolation $dataIsolation): ?ModeEntity
    {
        $dataIsolation->disabled();
        $builder = $this->createBuilder($dataIsolation, ModeModel::query());
        $model = $builder->where('is_default', 1)->first();

        return $model ? ModeFactory::modelToEntity($model) : null;
    }

    /**
     * @return array{total: int, list: ModeEntity[]}
     */
    public function queries(ModeDataIsolation $dataIsolation, ModeQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, ModeModel::query());

        // 是否过滤默认模式
        if ($query->isExcludeDefault()) {
            $builder->where('is_default', 0);
        }

        if ($query->getStatus() !== null) {
            $builder->where('status', $query->getStatus());
        }

        // 排序：is_default优先（默认模式在开头），然后sort字段，最后created_at
        $builder->orderBy('is_default', 'desc')
            ->orderBy('sort', $query->getSortDirection())
            ->orderBy('created_at', 'desc');

        $data = $this->getByPage($builder, $page);
        if (! empty($data['list'])) {
            $list = [];
            foreach ($data['list'] as $modeEntity) {
                $list[] = ModeFactory::modelToEntity($modeEntity);
            }
            $data['list'] = $list;
        }

        return $data;
    }

    public function save(ModeDataIsolation $dataIsolation, ModeEntity $modeEntity): ModeEntity
    {
        $modeEntity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $modeEntity->setCreatorId($dataIsolation->getCurrentUserId());
        $dataIsolation->disabled();
        if (! $modeEntity->getId()) {
            $modeModel = new ModeModel();
            $modeEntity->setId(IdGenerator::getSnowId());
        } else {
            /** @var ModeModel $modeModel */
            $modeModel = ModeModel::find($modeEntity->getId());
        }

        $modeModel->fill($this->getAttributes($modeEntity));
        $modeModel->save();

        $modeEntity->setId($modeModel->id);

        return $modeEntity;
    }

    public function delete(ModeDataIsolation $dataIsolation, int|string $id): bool
    {
        $builder = $this->createBuilder($dataIsolation, ModeModel::query());
        $model = $builder->where('id', $id)->first();

        if (! $model || $model->is_default === 1) {
            return false;
        }

        return $model->delete();
    }

    public function isIdentifierUnique(ModeDataIsolation $dataIsolation, string $identifier, null|int|string $excludeId = null): bool
    {
        $builder = $this->createBuilder($dataIsolation, ModeModel::query());
        $query = $builder->where('identifier', $identifier);

        if ($excludeId) {
            $query->where('id', '!=', $excludeId);
        }

        return ! $query->exists();
    }

    /**
     * @return ModeEntity[]
     */
    public function findEnabledModes(ModeDataIsolation $dataIsolation): array
    {
        $builder = $this->createBuilder($dataIsolation, ModeModel::query());
        $models = $builder->where('status', 1)
            ->orderBy('is_default', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        return $models->map(function ($model) {
            /* @var ModeModel $model */
            return ModeFactory::modelToEntity($model);
        })->toArray();
    }

    /**
     * @return ModeEntity[]
     */
    public function findByFollowModeId(ModeDataIsolation $dataIsolation, int|string $followModeId): array
    {
        $builder = $this->createBuilder($dataIsolation, ModeModel::query());
        $models = $builder->where('follow_mode_id', $followModeId)->get();

        $data = [];
        foreach ($models as $model) {
            $data[] = ModeFactory::modelToEntity($model);
        }
        return $data;
    }

    public function updateStatus(ModeDataIsolation $dataIsolation, int|string $id, bool $status): bool
    {
        $builder = $this->createBuilder($dataIsolation, ModeModel::query());
        return $builder->where('id', $id)
            ->update(['status' => $status]) > 0;
    }
}
