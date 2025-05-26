<?php

/** @noinspection ALL */

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelAdmin\Repository\Persistence;

use App\Domain\ModelAdmin\Entity\ServiceProviderConfigEntity;
use App\Domain\ModelAdmin\Entity\ServiceProviderModelsEntity;
use App\Domain\ModelAdmin\Factory\ServiceProviderConfigEntityFactory;
use App\Domain\ModelAdmin\Factory\ServiceProviderModelsEntityFactory;
use App\Domain\ModelAdmin\Repository\Model\ServiceProviderConfigModel;
use App\Domain\ModelAdmin\Repository\Model\ServiceProviderModel;
use App\Domain\ModelAdmin\Repository\Model\ServiceProviderModelsModel;
use Hyperf\DbConnection\Db;

abstract class AbstractModelRepository
{
    public function __construct(
        protected ServiceProviderConfigModel $configModel,
        protected ServiceProviderModelsModel $serviceProviderModelsModel,
        protected ServiceProviderModel $serviceProviderModel
    ) {
    }

    /**
     * @return ServiceProviderModelsEntity[]
     */
    public function getModelsByIds(array $modelIds): array
    {
        if (empty($modelIds)) {
            return [];
        }
        $query = $this->serviceProviderModelsModel::query()->whereIn('id', $modelIds);
        $result = Db::select($query->toSql(), $query->getBindings());
        return ServiceProviderModelsEntityFactory::toEntities($result);
    }

    /**
     * 根据配置ID数组获取配置实体列表.
     * @return ServiceProviderConfigEntity[]
     */
    public function getConfigsByIds(array $configIds): array
    {
        if (empty($configIds)) {
            return [];
        }
        $query = $this->configModel::query()->whereIn('id', $configIds);
        $result = Db::select($query->toSql(), $query->getBindings());
        return ServiceProviderConfigEntityFactory::toEntities($result);
    }

    /**
     * 根据多个服务商配置ID获取模型列表.
     * @param array $configIds 服务商配置ID数组
     * @return ServiceProviderModelsEntity[]
     */
    public function getModelsByServiceProviderConfigIds(array $configIds): array
    {
        if (empty($configIds)) {
            return [];
        }

        $query = $this->serviceProviderModelsModel::query()->whereIn('service_provider_config_id', $configIds);
        $result = Db::select($query->toSql(), $query->getBindings());

        return ServiceProviderModelsEntityFactory::toEntities($result);
    }
}
