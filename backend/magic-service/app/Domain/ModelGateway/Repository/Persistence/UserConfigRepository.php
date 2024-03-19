<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository\Persistence;

use App\Domain\ModelGateway\Entity\UserConfigEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Factory\UserConfigFactory;
use App\Domain\ModelGateway\Repository\Facade\UserConfigRepositoryInterface;
use App\Domain\ModelGateway\Repository\Persistence\Model\UserConfigModel;

class UserConfigRepository extends AbstractRepository implements UserConfigRepositoryInterface
{
    public function getByAppCodeAndOrganizationCode(LLMDataIsolation $dataIsolation, string $appCode, string $organizationCode, string $userId): ?UserConfigEntity
    {
        $builder = $this->createBuilder($dataIsolation, UserConfigModel::query());
        /** @var null|UserConfigModel $model */
        $model = $builder->where('user_id', $userId)
            ->where('app_code', $appCode)
            ->where('organization_code', $organizationCode)
            ->first();
        return $model ? UserConfigFactory::modelToEntity($model) : null;
    }

    public function create(LLMDataIsolation $dataIsolation, UserConfigEntity $userConfigEntity): UserConfigEntity
    {
        $model = new UserConfigModel();
        $model->fill($this->getAttributes($userConfigEntity));
        $model->save();
        $userConfigEntity->setId($model->id);
        $userConfigEntity->setCreatedAt($model->created_at);
        $userConfigEntity->setUpdatedAt($model->updated_at);
        return $userConfigEntity;
    }

    public function incrementUseAmount(LLMDataIsolation $dataIsolation, UserConfigEntity $userConfigEntity, float $amount): void
    {
        $builder = $this->createBuilder($dataIsolation, UserConfigModel::query());
        $builder->where('id', $userConfigEntity->getId())->increment('use_amount', $amount);
    }
}
