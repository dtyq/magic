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
use DateTime;

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

    /**
     * 通过 magicId + key 获取用户设置（跨组织）.
     */
    public function getByMagicId(string $magicId, string $key): ?MagicUserSettingEntity
    {
        /** @var null|UserSettingModel $model */
        $model = UserSettingModel::query()
            ->where('magic_id', $magicId)
            ->where('key', $key)
            ->first();

        return $model ? MagicUserSettingFactory::createEntity($model) : null;
    }

    /**
     * 通过 magicId 保存用户设置（跨组织），若已存在相同 key 则更新。
     */
    public function saveByMagicId(string $magicId, MagicUserSettingEntity $magicUserSettingEntity): MagicUserSettingEntity
    {
        // 写入 magicId
        $magicUserSettingEntity->setMagicId($magicId);

        // 查找现有记录
        $model = UserSettingModel::query()
            ->where('magic_id', $magicId)
            ->where('key', $magicUserSettingEntity->getKey())
            ->first();

        if (! $model) {
            $model = new UserSettingModel();
        } else {
            $magicUserSettingEntity->setId($model->id);
        }

        $model->fill(MagicUserSettingFactory::createModel($magicUserSettingEntity));
        $model->save();

        $magicUserSettingEntity->setId($model->id);
        return $magicUserSettingEntity;
    }

    /**
     * 获取全局配置（organization_code/user_id/magic_id 均为 NULL）。
     */
    public function getGlobal(string $key): ?MagicUserSettingEntity
    {
        /** @var null|UserSettingModel $model */
        $model = UserSettingModel::query()
            ->whereNull('organization_code')
            ->whereNull('user_id')
            ->whereNull('magic_id')
            ->where('key', $key)
            ->first();

        return $model ? MagicUserSettingFactory::createEntity($model) : null;
    }

    /**
     * 保存全局配置.
     */
    public function saveGlobal(MagicUserSettingEntity $magicUserSettingEntity): MagicUserSettingEntity
    {
        // 查找现有记录
        /** @var null|UserSettingModel $model */
        $model = UserSettingModel::query()
            ->whereNull('organization_code')
            ->whereNull('user_id')
            ->whereNull('magic_id')
            ->where('key', $magicUserSettingEntity->getKey())
            ->first();

        if (! $model) {
            $model = new UserSettingModel();
        } else {
            $magicUserSettingEntity->setId($model->id);
        }

        // 使用工厂生成数据后手动覆盖 NULL 字段
        $magicUserSettingEntity->setOrganizationCode(null);
        $magicUserSettingEntity->setUserId(null);
        $magicUserSettingEntity->setMagicId(null);
        $magicUserSettingEntity->setCreatedAt(new DateTime());
        $magicUserSettingEntity->setUpdatedAt(new DateTime());
        $model->fill(MagicUserSettingFactory::createModel($magicUserSettingEntity));

        $model->save();

        $magicUserSettingEntity->setId($model->id);
        return $magicUserSettingEntity;
    }
}
