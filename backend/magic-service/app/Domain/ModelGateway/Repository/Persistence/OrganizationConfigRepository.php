<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository\Persistence;

use App\Domain\ModelGateway\Entity\OrganizationConfigEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Factory\OrganizationConfigFactory;
use App\Domain\ModelGateway\Repository\Facade\OrganizationConfigRepositoryInterface;
use App\Domain\ModelGateway\Repository\Persistence\Model\OrganizationConfigModel;

class OrganizationConfigRepository extends AbstractRepository implements OrganizationConfigRepositoryInterface
{
    public function getByAppCodeAndOrganizationCode(LLMDataIsolation $dataIsolation, string $appCode, string $organizationCode): ?OrganizationConfigEntity
    {
        $builder = $this->createBuilder($dataIsolation, OrganizationConfigModel::query());
        /** @var null|OrganizationConfigModel $model */
        $model = $builder->where('app_code', $appCode)->where('organization_code', $organizationCode)->first();
        return $model ? OrganizationConfigFactory::modelToEntity($model) : null;
    }

    public function create(LLMDataIsolation $dataIsolation, OrganizationConfigEntity $organizationConfigEntity): OrganizationConfigEntity
    {
        $model = new OrganizationConfigModel();

        $model->fill($this->getAttributes($organizationConfigEntity));
        $model->save();
        $organizationConfigEntity->setId($model->id);
        $organizationConfigEntity->setCreatedAt($model->created_at);
        $organizationConfigEntity->setUpdatedAt($model->updated_at);

        return OrganizationConfigFactory::modelToEntity($model);
    }

    public function incrementUseAmount(LLMDataIsolation $dataIsolation, OrganizationConfigEntity $organizationConfigEntity, float $amount): void
    {
        $builder = $this->createBuilder($dataIsolation, OrganizationConfigModel::query());
        $builder->where('id', $organizationConfigEntity->getId())->increment('use_amount', $amount);
    }
}
