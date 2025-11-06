<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Persistence;

use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;
use App\Domain\Provider\Repository\Facade\AiAbilityRepositoryInterface;
use App\Domain\Provider\Repository\Persistence\Model\AiAbilityModel;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Hyperf\Codec\Json;

/**
 * AI 能力仓储实现.
 */
class AiAbilityRepository implements AiAbilityRepositoryInterface
{
    /**
     * 根据能力代码获取AI能力实体.
     */
    public function getByCode(MagicUserAuthorization $authorization, AiAbilityCode $code): ?AiAbilityEntity
    {
        $organizationCode = $authorization->getOrganizationCode();

        $model = AiAbilityModel::query()
            ->where('organization_code', $organizationCode)
            ->where('code', $code->value)
            ->first();
        if ($model === null) {
            return null;
        }

        return $this->modelToEntity($model);
    }

    /**
     * 获取所有AI能力列表.
     */
    public function getAll(MagicUserAuthorization $authorization): array
    {
        $organizationCode = $authorization->getOrganizationCode();

        $models = AiAbilityModel::query()
            ->where('organization_code', $organizationCode)
            ->orderBy('sort_order')
            ->get();

        $entities = [];
        foreach ($models as $model) {
            $entities[] = $this->modelToEntity($model);
        }

        return $entities;
    }

    /**
     * 根据ID获取AI能力实体.
     */
    public function getById(MagicUserAuthorization $authorization, int $id): ?AiAbilityEntity
    {
        $organizationCode = $authorization->getOrganizationCode();

        $model = AiAbilityModel::query()
            ->where('organization_code', $organizationCode)
            ->where('id', $id)
            ->first();
        if ($model === null) {
            return null;
        }

        return $this->modelToEntity($model);
    }

    /**
     * 保存AI能力实体.
     */
    public function save(AiAbilityEntity $entity): bool
    {
        $model = new AiAbilityModel();
        $model->code = $entity->getCode()->value;
        $model->organization_code = $entity->getOrganizationCode();
        $model->name_i18n = $entity->getName();
        $model->description_i18n = $entity->getDescription();
        $model->icon = $entity->getIcon();
        $model->sort_order = $entity->getSortOrder();
        $model->status = $entity->getStatus()->value;
        $model->config = $entity->getConfig()->toArray();

        $result = $model->save();

        if ($result) {
            $entity->setId($model->id);
        }

        return $result;
    }

    /**
     * 更新AI能力实体.
     */
    public function update(AiAbilityEntity $entity): bool
    {
        $model = AiAbilityModel::query()
            ->where('organization_code', $entity->getOrganizationCode())
            ->where('code', $entity->getCode()->value)
            ->first();
        if ($model === null) {
            return false;
        }

        $model->name_i18n = $entity->getName();
        $model->description_i18n = $entity->getDescription();
        $model->icon = $entity->getIcon();
        $model->sort_order = $entity->getSortOrder();
        $model->status = $entity->getStatus()->value;
        $model->config = $entity->getConfig()->toArray();

        return $model->save();
    }

    /**
     * 根据code更新（支持选择性更新）.
     */
    public function updateByCode(MagicUserAuthorization $authorization, AiAbilityCode $code, array $data): bool
    {
        if (empty($data)) {
            return false;
        }

        if (! empty($data['config'])) {
            $data['config'] = Json::encode($data['config']);
        }

        $organizationCode = $authorization->getOrganizationCode();
        $data['updated_at'] = date('Y-m-d H:i:s');

        return AiAbilityModel::query()
            ->where('organization_code', $organizationCode)
            ->where('code', $code->value)
            ->update($data) > 0;
    }

    /**
     * 将Model转换为Entity.
     */
    private function modelToEntity(AiAbilityModel $model): AiAbilityEntity
    {
        $entity = new AiAbilityEntity();
        $entity->setId($model->id);
        $entity->setCode($model->code);
        $entity->setOrganizationCode($model->organization_code);
        $entity->setName($model->name_i18n);
        $entity->setDescription($model->description_i18n);
        $entity->setIcon($model->icon);
        $entity->setSortOrder($model->sort_order);
        $entity->setStatus($model->status);
        $entity->setConfig($model->config ?? []);

        return $entity;
    }
}
