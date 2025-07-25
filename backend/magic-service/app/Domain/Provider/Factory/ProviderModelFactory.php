<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Factory;

use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\DisabledByType;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelModel;

class ProviderModelFactory
{
    public static function modelToEntity(ProviderModelModel $model): ProviderModelEntity
    {
        $entity = new ProviderModelEntity();
        $entity->setId($model->id)
            ->setProviderConfigId($model->service_provider_config_id)
            ->setName($model->name)
            ->setModelVersion($model->model_version)
            ->setCategory(Category::from($model->category))
            ->setModelId($model->model_id)
            ->setModelType(ModelType::from($model->model_type))
            ->setConfig($model->config)
            ->setDescription($model->description)
            ->setSort($model->sort)
            ->setIcon($model->icon)
            ->setCreatedAt($model->created_at)
            ->setUpdatedAt($model->updated_at)
            ->setOrganizationCode($model->organization_code)
            ->setStatus(Status::from($model->status))
            ->setDisabledBy($model->disabled_by ? DisabledByType::from($model->disabled_by) : null)
            ->setTranslate($model->translate)
            ->setModelParentId($model->model_parent_id)
            ->setVisibleOrganizations($model->visible_organizations)
            ->setVisibleApplications($model->visible_applications)
            ->setVisiblePackages($model->visible_packages)
            ->setIsOffice((bool) $model->is_office);

        return $entity;
    }
}
