<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Repository\Persistence;

use App\Domain\Flow\Entity\MagicFlowToolSetEntity;
use App\Domain\Flow\Entity\ValueObject\FlowDataIsolation;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowToolSetQuery;
use App\Domain\Flow\Factory\MagicFlowToolSetFactory;
use App\Domain\Flow\Repository\Facade\MagicFlowToolSetRepositoryInterface;
use App\Domain\Flow\Repository\Persistence\Model\MagicFlowToolSetModel;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Database\Model\Relations\HasMany;

class MagicFlowToolSetRepository extends MagicFlowAbstractRepository implements MagicFlowToolSetRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    public function save(FlowDataIsolation $dataIsolation, MagicFlowToolSetEntity $magicFlowToolSetEntity): MagicFlowToolSetEntity
    {
        /** @var MagicFlowToolSetModel $model */
        $model = $this->createBuilder($dataIsolation, MagicFlowToolSetModel::query())->firstOrNew([
            'code' => $magicFlowToolSetEntity->getCode(),
        ]);

        $model->fill($this->getAttributes($magicFlowToolSetEntity));
        $model->save();
        $magicFlowToolSetEntity->setId($model->id);
        return $magicFlowToolSetEntity;
    }

    public function destroy(FlowDataIsolation $dataIsolation, string $code): void
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowToolSetModel::query());
        $builder->where('code', $code)->delete();
    }

    public function queries(FlowDataIsolation $dataIsolation, MagicFlowToolSetQuery $query, Page $page): array
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowToolSetModel::query());

        if (! is_null($query->getCodes())) {
            $builder->whereIn('code', $query->getCodes());
        }
        if (! is_null($query->getEnabled())) {
            $builder->where('enabled', $query->getEnabled());
        }

        if ($query->withToolsSimpleInfo) {
            $builder->with(['tools' => function (HasMany $hasMany) {
                $hasMany->select(['tool_set_id', 'code', 'name', 'description', 'icon', 'enabled', 'updated_at'])->orderBy('updated_at', 'desc');
            }]);
        }
        if (! empty($query->name)) {
            $builder->where('name', 'like', "%{$query->name}%");
        }

        $data = $this->getByPage($builder, $page, $query);
        if (! empty($data['list'])) {
            $list = [];
            foreach ($data['list'] as $model) {
                $list[] = MagicFlowToolSetFactory::modelToEntity($model);
            }
            $data['list'] = $list;
        }
        return $data;
    }

    public function getByCode(FlowDataIsolation $dataIsolation, string $code): ?MagicFlowToolSetEntity
    {
        $builder = $this->createBuilder($dataIsolation, MagicFlowToolSetModel::query());
        /** @var null|MagicFlowToolSetModel $model */
        $model = $builder->where('code', $code)->first();
        if (! $model) {
            return null;
        }
        return MagicFlowToolSetFactory::modelToEntity($model);
    }
}
