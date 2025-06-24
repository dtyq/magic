<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelAdmin\Repository\Persistence;

use App\Domain\ModelAdmin\Constant\DisabledByType;
use App\Domain\ModelAdmin\Constant\ModelType;
use App\Domain\ModelAdmin\Constant\ServiceProviderCategory;
use App\Domain\ModelAdmin\Constant\Status;
use App\Domain\ModelAdmin\Entity\ServiceProviderModelsEntity;
use App\Domain\ModelAdmin\Factory\ServiceProviderModelsEntityFactory;
use App\Domain\ModelAdmin\Repository\ValueObject\UpdateConsumerModel;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Hyperf\Codec\Json;
use Hyperf\Database\Model\Builder as ModelBuilder;
use Hyperf\Database\Query\Builder as QueryBuilder;
use Hyperf\DbConnection\Annotation\Transactional;
use Hyperf\DbConnection\Db;

class ServiceProviderModelsRepository extends AbstractModelRepository
{
    /**
     * 根据服务商id查询所有模型.
     * @return ServiceProviderModelsEntity[]
     */
    public function getModelsByServiceProviderId(int $serviceProviderId): array
    {
        $query = $this->serviceProviderModelsModel::query()->where('service_provider_config_id', $serviceProviderId);
        return $this->executeQueryAndToEntities($query);
    }

    /**
     * 添加或更新模型.
     */
    #[Transactional]
    public function saveModels(ServiceProviderModelsEntity $serviceProviderModelsEntity): ServiceProviderModelsEntity
    {
        $isNew = ! $serviceProviderModelsEntity->getId();
        $entityArray = $this->prepareEntityForSave($serviceProviderModelsEntity, $isNew);

        if ($isNew) {
            $snowId = IdGenerator::getSnowId();
            $entityArray['model_parent_id'] = $snowId;
            $this->serviceProviderModelsModel::query()->insert($entityArray);
            $serviceProviderModelsEntity->setId($entityArray['id']);
        } else {
            $this->removeImmutableFields($entityArray);
            $this->serviceProviderModelsModel::query()->where('id', $serviceProviderModelsEntity->getId())->update($entityArray);
        }

        return $serviceProviderModelsEntity;
    }

    // 更新模型
    #[Transactional]
    public function updateModelById(ServiceProviderModelsEntity $entity): void
    {
        $entityArray = $this->prepareEntityForSave($entity);
        $this->removeImmutableFields($entityArray);
        $this->serviceProviderModelsModel::query()->where('id', $entity->getId())->update($entityArray);
    }

    // 删除模型
    public function deleteByIds(array $ids): void
    {
        if (empty($ids)) {
            return;
        }

        $query = $this->serviceProviderModelsModel::query()->whereIn('id', $ids);
        $this->queryThenDeleteAndDispatch($query);
    }

    // 根据服务商id和模型id改变模型的状态
    #[Transactional]
    public function changeModelStatus(int $serviceProviderId, int $modelId, int $status): void
    {
        $this->serviceProviderModelsModel::query()
            ->where('id', $modelId)
            ->where('service_provider_config_id', $serviceProviderId)
            ->update(['status' => $status]);
    }

    public function deleteByModelIdAndOrganizationCode(string $modelId, string $organizationCode): void
    {
        $query = $this->serviceProviderModelsModel::query()
            ->where('id', $modelId)
            ->where('organization_code', $organizationCode);

        $this->queryThenDeleteAndDispatch($query);
    }

    /**
     * @return ServiceProviderModelsEntity[]
     */
    public function getModelStatusByServiceProviderConfigIdAndOrganizationCode(string $serviceProviderConfigId, string $organizationCode): array
    {
        $query = $this->serviceProviderModelsModel::query()
            ->where('organization_code', $organizationCode)
            ->where('service_provider_config_id', $serviceProviderConfigId);

        return $this->executeQueryAndToEntities($query);
    }

    #[Transactional]
    public function updateModelStatus(string $id, string $organizationCode, Status $status): void
    {
        $this->serviceProviderModelsModel::query()
            ->where('id', $id)
            ->where('organization_code', $organizationCode)
            ->update(['status' => $status->value]);
    }

    /**
     * @return array<ServiceProviderModelsEntity>
     */
    public function getActiveModelsByOrganizationCode(array $serviceProviderConfigIds, string $organizationCode): array
    {
        if (empty($serviceProviderConfigIds)) {
            return [];
        }

        $query = $this->serviceProviderModelsModel::query()
            ->where('organization_code', $organizationCode)
            ->where('status', Status::ACTIVE->value)
            ->whereIn('service_provider_config_id', $serviceProviderConfigIds);

        return $this->executeQueryAndToEntities($query);
    }

    public function getById(string $modelId, bool $throw = true): ?ServiceProviderModelsEntity
    {
        $query = $this->serviceProviderModelsModel::query()->where('id', $modelId);
        $result = Db::selectOne($query->toSql(), $query->getBindings());
        if (! $result) {
            $throw && ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
            return null;
        }
        return ServiceProviderModelsEntityFactory::toEntity($result);
    }

    /**
     * @return ServiceProviderModelsEntity[]
     */
    public function getOrganizationActiveModelsByIdOrType(string $key, ?string $orgCode = null): array
    {
        # 提升索引命中，先根据id查询，再根据model_id查询
        $resultById = [];
        if (is_numeric($key)) {
            // 第一次查询：根据id查询
            $idQuery = $this->serviceProviderModelsModel::query()
                ->where('id', $key)
                ->where('status', Status::ACTIVE->value);

            if ($orgCode) {
                $idQuery->where('organization_code', $orgCode);
            }

            $resultById = Db::select($idQuery->toSql(), $idQuery->getBindings());
        }

        // 第二次查询：根据 model_id 查询
        $modelIdQuery = $this->serviceProviderModelsModel::query()
            ->where('model_id', $key)
            ->where('status', Status::ACTIVE->value);

        if ($orgCode) {
            $modelIdQuery->where('organization_code', $orgCode);
        }

        $resultByModelId = Db::select($modelIdQuery->toSql(), $modelIdQuery->getBindings());

        // 合并查询结果后统一转换为实体
        $mergedResults = array_merge($resultById, $resultByModelId);
        return ServiceProviderModelsEntityFactory::toEntities($mergedResults);
    }

    /**
     * @return ServiceProviderModelsEntity[]
     */
    public function getActiveModelByIdOrVersion(string $key, ?string $orgCode = null): array
    {
        # 提升索引命中，先根据id查询，再根据model_id查询
        // 第一次查询：根据id查询
        $idQuery = $this->serviceProviderModelsModel::query()
            ->where('id', $key)
            ->where('status', Status::ACTIVE->value);

        if ($orgCode) {
            $idQuery->where('organization_code', $orgCode);
        }

        $resultById = Db::select($idQuery->toSql(), $idQuery->getBindings());

        // 第二次查询：根据model_id查询
        $modelIdQuery = $this->serviceProviderModelsModel::query();
        if ($orgCode) {
            $modelIdQuery->where('organization_code', $orgCode);
        }

        $modelIdQuery->where('status', Status::ACTIVE->value)->where('model_version', $key);

        $resultByModelId = Db::select($modelIdQuery->toSql(), $modelIdQuery->getBindings());

        // 合并查询结果后统一转换为实体
        $mergedResults = array_merge($resultById, $resultByModelId);
        return ServiceProviderModelsEntityFactory::toEntities($mergedResults);
    }

    /**
     * @param $serviceProviderModelsEntities ServiceProviderModelsEntity[]
     */
    #[Transactional]
    public function batchInsert(array $serviceProviderModelsEntities): void
    {
        if (empty($serviceProviderModelsEntities)) {
            return;
        }

        $date = date('Y-m-d H:i:s');
        $data = [];
        foreach ($serviceProviderModelsEntities as $entity) {
            $entity->setId(IdGenerator::getSnowId());
            $entity->setUpdatedAt($date);
            $entity->setCreatedAt($date);
            $entityArray = $entity->toArray();
            $entityArray['config'] = Json::encode($entity->getConfig() ? $entity->getConfig()->toArray() : []);
            $entityArray['translate'] = Json::encode($entity->getTranslate() ?: []);
            $entityArray['visible_organizations'] = Json::encode($entity->getVisibleOrganizations() ?: []);
            $data[] = $entityArray;
        }

        $this->serviceProviderModelsModel::query()->insert($data);
    }

    /**
     * 根据模型版本和服务提供商配置ID删除记录
     * 用于批量删除同版本模型.
     */
    public function deleteByModelVersion(string $modelVersion): void
    {
        $query = $this->serviceProviderModelsModel::query()->where('model_version', $modelVersion);
        $this->queryThenDeleteAndDispatch($query);
    }

    /**
     * 批量保存模型数据.
     * @param ServiceProviderModelsEntity[] $modelEntities 模型实体数组
     */
    #[Transactional]
    public function batchSaveModels(array $modelEntities): void
    {
        if (empty($modelEntities)) {
            return;
        }

        $dataToInsert = [];
        foreach ($modelEntities as $entity) {
            $dataToInsert[] = $this->prepareEntityForSave($entity, true);
        }

        $this->serviceProviderModelsModel::query()->insert($dataToInsert);
    }

    /**
     * 根据服务商ID获取基础模型列表（不依赖特定组织）
     * 用于初始化新组织时获取模型基础数据.
     * @param int $serviceProviderId 服务商ID
     * @return ServiceProviderModelsEntity[]
     */
    public function getBaseModelsByServiceProviderId(int $serviceProviderId): array
    {
        // 首先从service_provider_config表中查询出一个样例配置ID
        $configQuery = Db::table('service_provider_config')
            ->select('id')
            ->where('service_provider_id', $serviceProviderId)
            ->limit(1);

        $configResult = Db::selectOne($configQuery->toSql(), $configQuery->getBindings());

        if (! $configResult) {
            return [];
        }

        $configId = $configResult->id;

        // 使用这个配置ID查询模型
        $query = $this->serviceProviderModelsModel::query()
            ->where('service_provider_config_id', $configId);

        return $this->executeQueryAndToEntities($query);
    }

    /**
     * 根据多个服务商配置ID批量获取模型列表
     * 简化后的方法，直接根据配置ID查询模型.
     * @param array $configIds 服务商配置ID数组
     * @return ServiceProviderModelsEntity[] 模型数组
     */
    public function getModelsByConfigIds(array $configIds): array
    {
        return $this->getModelsByServiceProviderConfigIds($configIds);
    }

    public function getModelsByVersionAndOrganization(string $modelVersion, string $organizationCode): array
    {
        $query = $this->serviceProviderModelsModel->newQuery()
            ->where('organization_code', $organizationCode)
            ->where('status', Status::ACTIVE->value)
            ->where('model_version', $modelVersion);

        $results = Db::select($query->toSql(), $query->getBindings());
        return ServiceProviderModelsEntityFactory::toEntities($results);
    }

    public function getModelsByVersionIdAndOrganization(string $modelId, string $organizationCode): array
    {
        $query = $this->serviceProviderModelsModel->newQuery()
            ->where('organization_code', $organizationCode)
            ->where('status', Status::ACTIVE->value)
            ->where('model_id', $modelId);

        return $this->executeQueryAndToEntities($query);
    }

    public function syncUpdateModelsStatusExcludeSelfByVLM(string $modelVersion, Status $status, ?DisabledByType $disabledBy = null)
    {
        $data = ['status' => $status->value];

        if ($disabledBy !== null) {
            $data['disabled_by'] = $disabledBy->value;
        }
        $this->removeImmutableFields($data);
        $this->serviceProviderModelsModel::query()
            ->where('model_version', $modelVersion)
            ->where('category', ServiceProviderCategory::VLM->value)
            ->where('is_office', true)
            ->update($data);
    }

    public function syncUpdateModelsStatusByVLM(string $modelVersion, Status $status, ?DisabledByType $disabledBy = null)
    {
        $data = ['status' => $status->value];

        if ($disabledBy !== null) {
            $data['disabled_by'] = $disabledBy->value;
        }
        $this->removeImmutableFields($data);
        $this->serviceProviderModelsModel::query()
            ->where('model_version', $modelVersion)
            ->where('category', ServiceProviderCategory::VLM->value)
            ->where('is_office', true)
            ->update($data);
    }

    /**
     * 更新模型状态和禁用来源.
     */
    public function updateModelStatusAndDisabledBy(string $modelId, string $organizationCode, Status $status, ?DisabledByType $disabledBy = null): void
    {
        $this->serviceProviderModelsModel::query()
            ->where('id', $modelId)
            ->where('organization_code', $organizationCode)
            ->update([
                'status' => $status->value,
                'disabled_by' => $disabledBy?->value,
            ]);
    }

    /**
     * 获取所有模型数据.
     * @return ServiceProviderModelsEntity[]
     */
    public function getAllModels(): array
    {
        $query = $this->serviceProviderModelsModel::query();
        return $this->executeQueryAndToEntities($query);
    }

    public function getModelByIdAndOrganizationCode(string $modelId, string $organizationCode): ?ServiceProviderModelsEntity
    {
        $query = $this->serviceProviderModelsModel::query()->where('id', $modelId)->where('organization_code', $organizationCode);
        $result = Db::selectOne($query->toSql(), $query->getBindings());
        if (! $result) {
            return null;
        }
        return ServiceProviderModelsEntityFactory::toEntity($result);
    }

    public function deleteByServiceProviderConfigId(string $serviceProviderConfigId, string $organizationCode): void
    {
        $query = $this->serviceProviderModelsModel::query()->where('service_provider_config_id', $serviceProviderConfigId)->where('organization_code', $organizationCode);
        $this->queryThenDeleteAndDispatch($query);
    }

    /**
     * @param $modelParentIds string[]
     */
    public function deleteByModelParentIdForOffice(array $modelParentIds): void
    {
        $modelParentIds = array_filter($modelParentIds, function ($value) {
            return $value !== 0;
        });
        if (empty($modelParentIds)) {
            return;
        }
        $this->serviceProviderModelsModel::query()->whereIn('model_parent_id', $modelParentIds)->where('is_office', true)->delete();
    }

    public function deleteByModelParentId(array $modelParentIds): void
    {
        $this->serviceProviderModelsModel::query()->whereIn('model_parent_id', $modelParentIds)->delete();
    }

    public function updateOfficeModel(int $id, array $entityArray): void
    {
        $this->removeOfficeImmutableFields($entityArray);
        $entityArray['config'] = Json::encode($entityArray['config'] ?: []);
        $entityArray['translate'] = Json::encode($entityArray['translate'] ?: []);
        $entityArray['visible_organizations'] = Json::encode($entityArray['visible_organizations'] ?: []);
        $entityArray['visible_applications'] = Json::encode($entityArray['visible_applications'] ?: []);
        $this->serviceProviderModelsModel::query()->where('id', $id)->update($entityArray);
    }

    public function updateConsumerModel(int $modelParentId, UpdateConsumerModel $updateConsumerModel): void
    {
        $modelArray = $updateConsumerModel->toArray();
        $modelArray['translate'] = Json::encode($modelArray['translate'] ?: []);
        $modelArray['visible_organizations'] = Json::encode($modelArray['visible_organizations'] ?: []);
        $modelArray['visible_applications'] = Json::encode($modelArray['visible_applications'] ?: []);
        $this->removeImmutableFields($modelArray);
        $this->serviceProviderModelsModel::query()->where('model_parent_id', $modelParentId)
            ->update($modelArray);
    }

    /**
     * 更新所有引用了该模型作为父模型的模型状态.
     * (保持原有功能，不排除自身，用于单独修改模型状态的场景).
     *
     * @param int $modelId 模型ID
     * @param Status $status 要设置的状态
     */
    public function syncUpdateModelsStatusByLLM(int $modelId, Status $status, ?DisabledByType $disabledBy = null): void
    {
        $data = ['status' => $status->value];

        if ($disabledBy !== null) {
            $data['disabled_by'] = $disabledBy->value;
        } else {
            $data['disabled_by'] = '';
        }
        $this->removeImmutableFields($data);
        $this->serviceProviderModelsModel::query()
            ->where('model_parent_id', $modelId)
            ->update($data);
    }

    /**
     * 更新除自身外的所有引用了该模型作为父模型的模型状态.
     * (专门用于服务商状态变更时，排除自身ID).
     *
     * @param int $modelId 模型ID
     * @param Status $status 要设置的状态
     */
    public function syncUpdateModelsStatusExcludeSelfByLLM(int $modelId, Status $status, ?DisabledByType $disabledBy = null): void
    {
        $data = ['status' => $status->value];

        if ($disabledBy !== null) {
            $data['disabled_by'] = $disabledBy->value;
        }
        $this->removeImmutableFields($data);
        $this->serviceProviderModelsModel::query()
            ->where('model_parent_id', $modelId)
            ->where('id', '!=', $modelId) // 排除自身ID
            ->update($data);
    }

    /**
     * 根据模型类型获取启用模型.
     */
    public function findActiveModelByType(ModelType $modelType, ?string $organizationCode): ?ServiceProviderModelsEntity
    {
        $res = $this->serviceProviderModelsModel::query()
            ->select('service_provider_models.*')
            ->leftJoin('service_provider_configs', 'service_provider_models.service_provider_config_id', '=', 'service_provider_configs.id')
            ->leftJoin('service_provider', 'service_provider_configs.service_provider_id', '=', 'service_provider.id')
            ->where('service_provider.status', Status::ACTIVE->value)
            ->where('service_provider_configs.status', Status::ACTIVE->value)
            ->where('service_provider.deleted_at', null)
            ->where('service_provider_configs.deleted_at', null)
            ->where('service_provider_models.model_type', $modelType->value)
            ->where('service_provider_models.organization_code', $organizationCode)
            ->where('service_provider_models.status', Status::ACTIVE->value)
            ?->first()
            ?->toArray();
        if ($res) {
            return ServiceProviderModelsEntityFactory::toEntity($res);
        }

        return null;
    }

    /**
     * 根据多个服务商配置ID获取模型列表.
     * @param array $configIds 服务商配置ID数组
     * @return ServiceProviderModelsEntity[]
     */
    public function getModelsByServiceProviderConfigIds(array $configIds): array
    {
        $query = $this->serviceProviderModelsModel::query()
            ->whereIn('service_provider_config_id', $configIds);

        $result = Db::select($query->toSql(), $query->getBindings());
        return ServiceProviderModelsEntityFactory::toEntities($result);
    }

    /**
     * 根据服务商配置ID获取所有模型.
     * @param int $serviceProviderConfigId 服务商配置ID
     * @return ServiceProviderModelsEntity[] 模型实体列表
     */
    public function getModelsByServiceProviderConfigId(int $serviceProviderConfigId): array
    {
        $query = $this->serviceProviderModelsModel::query()->where('service_provider_config_id', $serviceProviderConfigId);
        $result = Db::select($query->toSql(), $query->getBindings());
        return ServiceProviderModelsEntityFactory::toEntities($result);
    }

    /**
     * 根据服务商配置IDs、modelId和激活状态查找对应的模型.
     * @param array $configIds 服务商配置ID数组
     * @param string $modelVersion 模型ID
     * @return ServiceProviderModelsEntity[] 找到的激活模型数组
     */
    public function getActiveModelsByConfigIdsAndModelVersion(array $configIds, string $modelVersion): array
    {
        if (empty($configIds) || empty($modelVersion)) {
            return [];
        }

        $query = $this->serviceProviderModelsModel::query()
            ->whereIn('service_provider_config_id', $configIds)
            ->where('model_version', $modelVersion)
            ->where('status', Status::ACTIVE->value)
            ->orderBy('created_at', 'desc'); // 按创建时间倒序排列

        return $this->executeQueryAndToEntities($query);
    }

    /**
     * @return ServiceProviderModelsEntity[]
     */
    public function getActiveModelsByConfigIds(array $configIds): array
    {
        if (empty($configIds)) {
            return [];
        }

        $query = $this->serviceProviderModelsModel::query()
            ->whereIn('service_provider_config_id', $configIds)
            ->where('status', Status::ACTIVE->value)
            ->orderBy('created_at', 'desc'); // 按创建时间倒序排列

        return $this->executeQueryAndToEntities($query);
    }

    /**
     * 根据服务商配置IDs、modelId和激活状态查找对应的模型.
     * @param array $configIds 服务商配置ID数组
     * @param string $modelVersion 模型ID
     * @return ServiceProviderModelsEntity[] 找到的激活模型数组
     */
    public function getActiveModelsByConfigIdsAndModelId(array $configIds, string $modelVersion): array
    {
        if (empty($configIds) || empty($modelVersion)) {
            return [];
        }

        $query = $this->serviceProviderModelsModel::query()
            ->whereIn('service_provider_config_id', $configIds)
            ->where('model_version', $modelVersion)
            ->where('status', Status::ACTIVE->value)
            ->orderBy('created_at', 'desc'); // 按创建时间倒序排列

        return $this->executeQueryAndToEntities($query);
    }

    /**
     * Remove immutable fields from entity array.
     */
    private function removeImmutableFields(array &$entityArray): void
    {
        unset($entityArray['id'], $entityArray['model_parent_id']);
    }

    /**
     * Remove immutable fields for office model updates.
     */
    private function removeOfficeImmutableFields(array &$entityArray): void
    {
        unset(
            $entityArray['id'],
            $entityArray['organization_code'],
            $entityArray['service_provider_config_id'],
            $entityArray['status'],
            $entityArray['model_parent_id'],
        );
    }

    /**
     * 执行查询并转换为实体数组.
     * @return ServiceProviderModelsEntity[]
     */
    private function executeQueryAndToEntities(ModelBuilder|QueryBuilder $query): array
    {
        $result = Db::select($query->toSql(), $query->getBindings());
        return ServiceProviderModelsEntityFactory::toEntities($result);
    }

    /**
     * 执行查询并返回单个实体.
     */
    /* @phpstan-ignore-next-line */
    private function executeQueryAndToEntity(ModelBuilder|QueryBuilder $query): ServiceProviderModelsEntity
    {
        $result = Db::selectOne($query->toSql(), $query->getBindings());
        if (! $result) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
        }
        return ServiceProviderModelsEntityFactory::toEntity($result);
    }

    /**
     * 准备实体数据用于保存.
     */
    private function prepareEntityForSave(ServiceProviderModelsEntity $entity, bool $isNew = false): array
    {
        $date = date('Y-m-d H:i:s');
        $entity->setUpdatedAt($date);

        if ($isNew) {
            $entity->setId(IdGenerator::getSnowId());
            $entity->setCreatedAt($date);
        }

        $entityArray = $entity->toArray();
        $entityArray['config'] = Json::encode($entity->getConfig() ? $entity->getConfig()->toArray() : []);
        $entityArray['translate'] = Json::encode($entity->getTranslate() ?: []);
        $entityArray['visible_organizations'] = Json::encode($entity->getVisibleOrganizations());
        $entityArray['visible_applications'] = Json::encode($entity->getVisibleApplications());

        return $entityArray;
    }

    /**
     * 先查询再删除的通用模式.
     */
    #[Transactional]
    private function queryThenDeleteAndDispatch(ModelBuilder|QueryBuilder $query): void
    {
        $models = $this->executeQueryAndToEntities($query);

        if (! empty($models)) {
            $query->delete();
        }
    }
}
