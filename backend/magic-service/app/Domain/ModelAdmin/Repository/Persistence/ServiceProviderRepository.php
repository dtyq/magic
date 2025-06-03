<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelAdmin\Repository\Persistence;

use App\Domain\ModelAdmin\Constant\ServiceProviderCategory;
use App\Domain\ModelAdmin\Constant\ServiceProviderType;
use App\Domain\ModelAdmin\Entity\ServiceProviderEntity;
use App\Domain\ModelAdmin\Factory\ServiceProviderEntityFactory;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Codec\Json;
use Hyperf\DbConnection\Db;

class ServiceProviderRepository extends AbstractModelRepository
{
    public function getById(int $id): ?ServiceProviderEntity
    {
        $model = $this->serviceProviderModel::query()->where('id', $id)->first();
        if (! $model) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotFound);
        }
        return ServiceProviderEntityFactory::toEntity($model->toArray());
    }

    public function findById(int $id): ?ServiceProviderEntity
    {
        $model = $this->serviceProviderModel::query()->where('id', $id)->first();
        if (! $model) {
            return null;
        }
        return ServiceProviderEntityFactory::toEntity($model->toArray());
    }

    public function getByIdWithoutThrow(int $id): ?ServiceProviderEntity
    {
        $model = $this->serviceProviderModel::query()->where('id', $id)->first();
        if (! $model) {
            return null;
        }
        return ServiceProviderEntityFactory::toEntity($model->toArray());
    }

    /**
     * @return ServiceProviderEntity[]
     */
    public function getAll(int $page, int $pageSize): array
    {
        $offset = ($page - 1) * $pageSize;
        $query = $this->serviceProviderModel::query()->skip($offset)
            ->take($pageSize);
        $result = Db::select($query->toSql(), $query->getBindings());
        return ServiceProviderEntityFactory::toEntities($result);
    }

    /**
     * 根据服务商类别获取所有服务商.
     * @param int $page 页码
     * @param int $pageSize 每页数量
     * @param null|ServiceProviderCategory $category 服务商类别
     * @return ServiceProviderEntity[] 服务商实体列表
     */
    public function getAllByCategory(int $page, int $pageSize, ?ServiceProviderCategory $category = null): array
    {
        $offset = ($page - 1) * $pageSize;
        $query = $this->serviceProviderModel::query()->skip($offset)
            ->take($pageSize);

        if ($category !== null) {
            $query->where('category', $category->value);
        }

        $result = Db::select($query->toSql(), $query->getBindings());
        return ServiceProviderEntityFactory::toEntities($result);
    }

    public function getAllCount(): int
    {
        return $this->serviceProviderModel::query()->count();
    }

    // 插入
    public function insert(ServiceProviderEntity $serviceProviderEntity): ServiceProviderEntity
    {
        $date = date('Y-m-d H:i:s');
        $serviceProviderEntity->setId(IdGenerator::getSnowId());
        $serviceProviderEntity->setUpdatedAt($date);
        $serviceProviderEntity->setCreatedAt($date);

        $entityArray = $serviceProviderEntity->toArray();
        $translate = $serviceProviderEntity->getTranslate();
        if ($translate !== null) {
            $entityArray['translate'] = Json::encode($translate);
        }
        $model = $this->serviceProviderModel::query()->create($entityArray);
        $serviceProviderEntity->setId($model->id);
        return $serviceProviderEntity;
    }

    public function updateById(ServiceProviderEntity $serviceProviderEntity): ServiceProviderEntity
    {
        $serviceProviderEntity->setUpdatedAt(date('Y-m-d H:i:s'));
        $entityArray = $serviceProviderEntity->toArray();
        $translate = $serviceProviderEntity->getTranslate();
        if ($translate !== null) {
            $entityArray['translate'] = Json::encode($translate);
        }
        $this->serviceProviderModel::query()->where('id', $serviceProviderEntity->getId())
            ->update($entityArray);
        return $serviceProviderEntity;
    }

    public function deleteById(int $id): void
    {
        $this->serviceProviderModel::query()->where('id', $id)->delete();
    }

    /**
     * @return ServiceProviderEntity[]
     */
    public function getByIds(array $ids): array
    {
        $query = $this->serviceProviderModel::query()->whereIn('id', $ids);
        $result = Db::select($query->toSql(), $query->getBindings());
        return ServiceProviderEntityFactory::toEntities($result);
    }

    public function getOfficial(?ServiceProviderCategory $serviceProviderCategory): ?ServiceProviderEntity
    {
        $query = $this->serviceProviderModel::query();

        if ($serviceProviderCategory) {
            $query->where('category', $serviceProviderCategory->value);
        }
        $query->where('provider_type', ServiceProviderType::OFFICIAL->value);
        $result = Db::select($query->toSql(), $query->getBindings());
        if (empty($result)) {
            return null;
        }
        return ServiceProviderEntityFactory::toEntity($result[0]);
    }

    /**
     * 获取指定类别的非官方服务商.
     *
     * @param ServiceProviderCategory $category 服务商类别
     * @return ServiceProviderEntity[] 非官方服务商列表
     */
    public function getNonOfficialByCategory(ServiceProviderCategory $category): array
    {
        $query = $this->serviceProviderModel::query();
        $query->where('category', $category->value);
        $query->where('provider_type', '!=', ServiceProviderType::OFFICIAL->value);

        $result = Db::select($query->toSql(), $query->getBindings());
        return ServiceProviderEntityFactory::toEntities($result);
    }

    public function getOffice(ServiceProviderCategory $LLM, ServiceProviderType $OFFICIAL): ServiceProviderEntity
    {
        $model = $this->serviceProviderModel::query()->where('category', $LLM->value)
            ->where('provider_type', $OFFICIAL->value)->first();
        if (! $model) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotFound);
        }
        return ServiceProviderEntityFactory::toEntity($model->toArray());
    }

    /**
     * @param ServiceProviderCategory $LLM
     * @return ServiceProviderEntity[]
     */
    public function getByCategory(ServiceProviderCategory $LLM): array
    {
        $model = $this->serviceProviderModel::query()->where('category', $LLM->value)
            ->where('provider_code','!=',ProviderCode::Official->value)->get();
        if (! $model) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotFound);
        }
        return ServiceProviderEntityFactory::toEntities($model->toArray());
    }
}
