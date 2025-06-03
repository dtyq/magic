<?php

/** @noinspection ALL */
declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelAdmin\Repository\Persistence;

use App\Domain\ModelAdmin\Constant\Status;
use App\Domain\ModelAdmin\Entity\ServiceProviderConfigEntity;
use App\Domain\ModelAdmin\Factory\ServiceProviderConfigEntityFactory;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Aes\AesUtil;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Codec\Json;
use Hyperf\DbConnection\Db;

use function Hyperf\Config\config;

class ServiceProviderConfigRepository extends AbstractModelRepository
{
    /**
     * 根据组织获取服务商.
     * @return ServiceProviderConfigEntity[]
     */
    public function getByOrganizationCode(string $organizationCode): array
    {
        $query = $this->configModel::query()->where('organization_code', $organizationCode);
        $result = Db::select($query->toSql(), $query->getBindings());
        return ServiceProviderConfigEntityFactory::toEntities($result);
    }

    public function getByIdAndOrganizationCode(string $id, string $organizationCode): ServiceProviderConfigEntity
    {
        $model = $this->configModel::query()->where('id', $id)->where('organization_code', $organizationCode)->first();
        if (! $model) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotFound);
        }
        return ServiceProviderConfigEntityFactory::toEntity($model->toArray());
    }

    public function findByIdAndOrganizationCode(string $id, string $organizationCode): ?ServiceProviderConfigEntity
    {
        $model = $this->configModel::query()->where('id', $id)->where('organization_code', $organizationCode)->first();
        if (! $model) {
            return null;
        }
        return ServiceProviderConfigEntityFactory::toEntity($model->toArray());
    }

    public function getById(int $id): ?ServiceProviderConfigEntity
    {
        $model = $this->configModel::query()->where('id', $id)->first();
        if (! $model) {
            return null;
        }
        return ServiceProviderConfigEntityFactory::toEntity($model->toArray());
    }

    public function save(ServiceProviderConfigEntity $serviceProviderConfigEntity)
    {
        Db::transaction(function () use ($serviceProviderConfigEntity) {
            // 获取旧的实体数据
            $oldEntity = $this->getById($serviceProviderConfigEntity->getId());
            if (! $oldEntity) {
                return;
            }

            // 更新数据
            $this->configModel::query()
                ->where('id', $serviceProviderConfigEntity->getId())
                ->update([
                    'config' => $this->encryptionConfig($serviceProviderConfigEntity->getConfig() ? $serviceProviderConfigEntity->getConfig()->toArray() : [], (string) $serviceProviderConfigEntity->getId()),
                    'status' => $serviceProviderConfigEntity->getStatus(),
                    'alias' => $serviceProviderConfigEntity->getAlias(),
                    'translate' => Json::encode($serviceProviderConfigEntity->getTranslate() ?: []),
                ]);
        });
    }

    /**
     * @return ServiceProviderConfigEntity[]
     */
    public function getsByServiceProviderId(int $serviceProviderId): array
    {
        $query = $this->configModel::query()->where('service_provider_id', $serviceProviderId);
        $result = Db::select($query->toSql(), $query->getBindings());
        return ServiceProviderConfigEntityFactory::toEntities($result);
    }

    /**
     * @return ServiceProviderConfigEntity[]
     */
    public function getsByServiceProviderIdsAndOffice(array $serviceProviderIds): array
    {
        $query = $this->configModel::query()->whereIn('service_provider_id', $serviceProviderIds)
            ->where('organization_code', config('service_provider.office_organization'));
        $result = Db::select($query->toSql(), $query->getBindings());
        return ServiceProviderConfigEntityFactory::toEntities($result);
    }

    public function addServiceProviderConfigs(int $serviceProviderId, array $organizationCodes, bool $status)
    {
        $data = [];
        $date = date('Y-m-d H:i:s');
        foreach ($organizationCodes as $organizationCode) {
            $id = IdGenerator::getSnowId();
            $data[] = [
                'id' => $id,
                'service_provider_id' => $serviceProviderId,
                'organization_code' => $organizationCode,
                'config' => $this->encryptionConfig([], (string) $id),
                'created_at' => $date,
                'updated_at' => $date,
                'status' => $status,
            ];
        }
        $this->configModel::query()->insert($data);
    }

    /**
     * 批量添加服务商配置.
     * @param ServiceProviderConfigEntity[] $configEntities 服务商配置实体列表
     * @return ServiceProviderConfigEntity[] 创建的服务商配置实体列表
     */
    public function batchAddServiceProviderConfigs(array $configEntities): array
    {
        if (empty($configEntities)) {
            return [];
        }

        $data = [];
        $date = date('Y-m-d H:i:s');

        foreach ($configEntities as $entity) {
            $id = IdGenerator::getSnowId();
            $entity->setId($id);
            $entity->setCreatedAt($date);
            $entity->setUpdatedAt($date);

            // 配置加密
            $configData = $entity->getConfig() ? $entity->getConfig()->toArray() : [];
            $encryptedConfig = $this->encryptionConfig($configData, (string) $id);

            // 准备插入数据库的数据
            $entityArray = $entity->toArray();
            $entityArray['config'] = $encryptedConfig;
            $entityArray['translate'] = Json::encode($entity->getTranslate() ?: []);

            $data[] = $entityArray;
        }

        $this->configModel::query()->insert($data);

        return $configEntities;
    }

    /**
     * 根据多个服务商ID和组织代码获取配置.
     * @return ServiceProviderConfigEntity[]
     */
    public function getByServiceProviderIdsAndOrganizationCode(array $serviceProviderIds, string $organizationCode): array
    {
        $query = $this->configModel::query()
            ->whereIn('service_provider_id', $serviceProviderIds)
            ->where('organization_code', $organizationCode);

        $result = Db::select($query->toSql(), $query->getBindings());
        return ServiceProviderConfigEntityFactory::toEntities($result);
    }

    public function deleteByServiceProviderId(int $id): void
    {
        Db::transaction(function () use ($id) {
            // 获取该服务商ID下的所有配置
            $configs = $this->configModel::query()
                ->where('service_provider_id', $id)
                ->get(['id'])
                ->pluck('id')
                ->toArray();

            if (empty($configs)) {
                return;
            }

            // 删除服务商配置
            $this->configModel::query()->where('service_provider_id', $id)->delete();
        });
    }

    public function deleteById(string $id)
    {
        $this->configModel::query()->where('id', $id)->delete();
    }

    /**
     * @return ServiceProviderConfigEntity[]
     */
    public function getByOrganizationCodeAndActive(string $organizationCode): array
    {
        $query = $this->configModel::query()->where('organization_code', $organizationCode)->where('status', Status::ACTIVE->value);
        $result = Db::select($query->toSql(), $query->getBindings());
        return ServiceProviderConfigEntityFactory::toEntities($result);
    }

    public function encryptionConfig(array $config, string $salt): string
    {
        return AesUtil::encode($this->_getAesKey($salt), Json::encode($config));
    }

    /**
     * 获取多个服务商ID对应的示例配置
     * 为每个服务商ID获取一个示例配置ID.
     * @param array $serviceProviderIds 服务商ID数组
     * @return array [config_id => service_provider_id] 配置ID到服务商ID的映射
     */
    public function getSampleConfigsByServiceProviderIds(array $serviceProviderIds): array
    {
        if (empty($serviceProviderIds)) {
            return [];
        }

        // 一次性查询所有服务商的配置
        $allConfigs = $this->configModel::query()
            ->whereIn('service_provider_id', $serviceProviderIds)
            ->get();

        if ($allConfigs->isEmpty()) {
            return [];
        }

        // 按服务商ID分组，每组只取第一个配置
        $configToProviderMap = [];
        $groupedConfigs = $allConfigs->groupBy('service_provider_id');

        foreach ($groupedConfigs as $providerId => $configs) {
            $firstConfig = $configs->first();
            $configToProviderMap[$firstConfig->id] = $providerId;
        }

        return $configToProviderMap;
    }

    public function insert(ServiceProviderConfigEntity $serviceProviderConfigEntity): ServiceProviderConfigEntity
    {
        $date = date('Y-m-d H:i:s');
        $serviceProviderConfigEntity->setId(IdGenerator::getSnowId());
        $serviceProviderConfigEntity->setCreatedAt($date);
        $serviceProviderConfigEntity->setUpdatedAt($date);
        $entityArray = $serviceProviderConfigEntity->toArray();
        $entityArray['config'] = $this->encryptionConfig($entityArray['config'], (string) $entityArray['id']);
        $entityArray['translate'] = Json::encode($serviceProviderConfigEntity->getTranslate() ? $serviceProviderConfigEntity->getTranslate() : []);
        $this->configModel::query()->create($entityArray);
        return $serviceProviderConfigEntity;
    }

    /**
     * 根据多个ID批量获取服务商配置.
     * @param array $ids 服务商配置ID数组
     * @return ServiceProviderConfigEntity[]
     */
    public function getByIds(array $ids): array
    {
        return $this->getConfigsByIds($ids);
    }

    /**
     * aes key加盐.
     */
    private function _getAesKey(string $salt): string
    {
        return config('service_provider.model_aes_key') . $salt;
    }
}
