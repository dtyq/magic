<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Contact\Repository\Persistence;

use App\Domain\Contact\Entity\MagicUserSettingEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Entity\ValueObject\Query\MagicUserSettingQuery;
use App\Domain\Contact\Factory\MagicUserSettingFactory;
use App\Domain\Contact\Repository\Facade\MagicUserSettingRepositoryInterface;
use App\Domain\Contact\Repository\Persistence\Model\UserSettingModel;
use App\Infrastructure\Core\ValueObject\Page;

class MagicUserSettingRepository extends AbstractMagicContactRepository implements MagicUserSettingRepositoryInterface
{
    protected bool $filterOrganizationCode = true;

    public function save(DataIsolation $dataIsolation, MagicUserSettingEntity $magicUserSettingEntity): MagicUserSettingEntity
    {
        if (! $magicUserSettingEntity->getId()) {
            $model = new UserSettingModel();
        } else {
            $builder = $this->createContactBuilder($dataIsolation, UserSettingModel::query());
            $model = $builder->where('id', $magicUserSettingEntity->getId())->first();
        }

        $model->fill(MagicUserSettingFactory::createModel($magicUserSettingEntity));
        $model->save();

        $magicUserSettingEntity->setId($model->id);
        return $magicUserSettingEntity;
    }

    public function get(DataIsolation $dataIsolation, string $key): ?MagicUserSettingEntity
    {
        $builder = $this->createContactBuilder($dataIsolation, UserSettingModel::query());

        /** @var null|UserSettingModel $model */
        $model = $builder->where('user_id', $dataIsolation->getCurrentUserId())
            ->where('key', $key)
            ->first();

        if (! $model) {
            return null;
        }

        return MagicUserSettingFactory::createEntity($model);
    }

    /**
     * @return array{total: int, list: array<MagicUserSettingEntity>}
     */
    public function queries(DataIsolation $dataIsolation, MagicUserSettingQuery $query, Page $page): array
    {
        $builder = $this->createContactBuilder($dataIsolation, UserSettingModel::query());

        if ($query->getUserId()) {
            $builder->where('user_id', $query->getUserId());
        }

        if ($query->getKey()) {
            $builder->where('key', 'like', '%' . $query->getKey() . '%');
        }

        if (! empty($query->getKeys())) {
            $builder->whereIn('key', $query->getKeys());
        }

        $result = $this->getByPage($builder, $page, $query);

        $list = [];
        /** @var UserSettingModel $model */
        foreach ($result['list'] as $model) {
            $list[] = MagicUserSettingFactory::createEntity($model);
        }

        return [
            'total' => $result['total'],
            'list' => $list,
        ];
    }
}
