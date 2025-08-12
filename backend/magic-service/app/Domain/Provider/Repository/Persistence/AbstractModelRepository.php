<?php

/** @noinspection ALL */

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Persistence;

use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Repository\Persistence\Model\ProviderConfigModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModel;
use App\Domain\Provider\Repository\Persistence\Model\ProviderModelModel;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\AbstractRepository;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Interfaces\Provider\Assembler\ProviderConfigAssembler;
use App\Interfaces\Provider\Assembler\ProviderModelAssembler;
use DateTime;
use Hyperf\Codec\Json;
use Hyperf\Database\Query\Builder;
use Hyperf\DbConnection\Db;

abstract class AbstractModelRepository extends AbstractRepository
{
    protected array $attributeMaps = [
        'creator' => 'created_uid',
        'modifier' => 'updated_uid',
    ];

    public function __construct(
        protected ProviderConfigModel $configModel,
        protected ProviderModelModel $serviceProviderModelsModel,
        protected ProviderModel $serviceProviderModel
    ) {
    }

    /**
     * @return ProviderModelEntity[]
     */
    public function getModelsByIds(array $modelIds): array
    {
        if (empty($modelIds)) {
            return [];
        }
        $query = $this->createProviderModelQuery()->whereIn('id', $modelIds);
        $result = Db::select($query->toSql(), $query->getBindings());
        return ProviderModelAssembler::toEntities($result);
    }

    /**
     * 根据配置ID数组获取配置实体列表.
     * @return ProviderConfigEntity[]
     */
    public function getConfigsByIds(array $configIds): array
    {
        if (empty($configIds)) {
            return [];
        }
        $query = $this->createConfigQuery()->whereIn('id', $configIds);
        $result = Db::select($query->toSql(), $query->getBindings());
        return ProviderConfigAssembler::toEntities($result);
    }

    /**
     * 根据多个服务商配置ID获取模型列表.
     * @param array $configIds 服务商配置ID数组
     * @return ProviderModelEntity[]
     */
    public function getModelsByServiceProviderConfigIds(array $configIds): array
    {
        if (empty($configIds)) {
            return [];
        }

        $query = $this->createProviderModelQuery()->whereIn('service_provider_config_id', $configIds);
        $result = Db::select($query->toSql(), $query->getBindings());

        return ProviderModelAssembler::toEntities($result);
    }

    /**
     * 初始化实体的ID和时间戳（为新创建的实体设置）.
     * @param mixed $entity
     */
    protected function initializeEntityForCreation($entity, array &$attributes): void
    {
        $now = new DateTime();
        $nowString = $now->format('Y-m-d H:i:s');
        $id = IdGenerator::getSnowId();

        // 设置实体属性
        $entity->setId($id);
        $entity->setCreatedAt($now);
        $entity->setUpdatedAt($now);
        $entity->setDeletedAt(null);

        // 设置数组属性（用于数据库插入）
        $attributes['id'] = $id;
        $attributes['created_at'] = $nowString;
        $attributes['updated_at'] = $nowString;
        $attributes['deleted_at'] = null;
    }

    /**
     * 重写 getAttributes 方法以正确处理复杂字段的序列化.
     */
    protected function getFieldAttributes(AbstractEntity $entity): array
    {
        $attributes = [];
        $array = $entity->toArray();
        foreach ($array as $key => $value) {
            // 对复杂字段进行特殊处理
            if (in_array($key, ['config', 'translate'], true) && (is_array($value) || is_object($value))) {
                $value = Json::encode($value);
            }

            if (array_key_exists($key, $this->attributeMaps)) {
                $attributes[$this->attributeMaps[$key]] = $value;
            } else {
                $attributes[$key] = $value;
            }
        }

        if (empty($attributes['id'])) {
            unset($attributes['id']);
        }
        return $attributes;
    }

    /**
     * 准备移除软删相关功能，临时这样写。创建带有软删除过滤的 ProviderConfigModel 查询构建器.
     */
    private function createConfigQuery(): Builder
    {
        return $this->configModel::query()->whereNull('deleted_at');
    }

    /**
     * 准备移除软删相关功能，临时这样写。创建带有软删除过滤的 ProviderModelModel 查询构建器.
     */
    private function createProviderModelQuery(): Builder
    {
        return $this->serviceProviderModelsModel::query()->whereNull('deleted_at');
    }
}
