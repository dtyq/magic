<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelAdmin\Service;

use App\Domain\ModelAdmin\Constant\DisabledByType;
use App\Domain\ModelAdmin\Constant\ModelType;
use App\Domain\ModelAdmin\Constant\OriginalModelType;
use App\Domain\ModelAdmin\Constant\ServiceProviderCategory;
use App\Domain\ModelAdmin\Constant\ServiceProviderCode;
use App\Domain\ModelAdmin\Constant\ServiceProviderType;
use App\Domain\ModelAdmin\Constant\Status;
use App\Domain\ModelAdmin\Entity\ServiceProviderConfigEntity;
use App\Domain\ModelAdmin\Entity\ServiceProviderEntity;
use App\Domain\ModelAdmin\Entity\ServiceProviderModelsEntity;
use App\Domain\ModelAdmin\Entity\ServiceProviderOriginalModelsEntity;
use App\Domain\ModelAdmin\Entity\ValueObject\ServiceProviderConfig;
use App\Domain\ModelAdmin\Entity\ValueObject\ServiceProviderConfigDTO;
use App\Domain\ModelAdmin\Entity\ValueObject\ServiceProviderDTO;
use App\Domain\ModelAdmin\Entity\ValueObject\ServiceProviderModelsDTO;
use App\Domain\ModelAdmin\Entity\ValueObject\ServiceProviderResponse;
use App\Domain\ModelAdmin\Factory\ServiceProviderEntityFactory;
use App\Domain\ModelAdmin\Repository\Persistence\ServiceProviderConfigRepository;
use App\Domain\ModelAdmin\Repository\Persistence\ServiceProviderModelsRepository;
use App\Domain\ModelAdmin\Repository\Persistence\ServiceProviderOriginalModelsRepository;
use App\Domain\ModelAdmin\Repository\Persistence\ServiceProviderRepository;
use App\Domain\ModelAdmin\Repository\ValueObject\UpdateConsumerModel;
use App\Domain\ModelAdmin\Service\Provider\ServiceProviderFactory;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Locker\Excpetion\LockException;
use App\Infrastructure\Util\Locker\RedisLocker;
use App\Interfaces\Kernel\Assembler\FileAssembler;
use Exception;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\DbConnection\Db;
use Psr\Log\LoggerInterface;

use function Hyperf\Translation\__;

class ServiceProviderDomainService
{
    public function __construct(
        protected ServiceProviderRepository $serviceProviderRepository,
        protected ServiceProviderModelsRepository $serviceProviderModelsRepository,
        protected ServiceProviderConfigRepository $serviceProviderConfigRepository,
        protected ServiceProviderOriginalModelsRepository $serviceProviderOriginalModelsRepository,
        protected TranslatorInterface $translator,
        protected LoggerInterface $logger,
        protected RedisLocker $redisLocker,
    ) {
    }

    /**
     * 新增服务商(超级管理员用的).
     */
    public function addServiceProvider(ServiceProviderEntity $serviceProviderEntity, array $organizationCodes): ServiceProviderEntity
    {
        Db::beginTransaction();
        try {
            // todo xhy 校验 $serviceProviderEntity

            $this->serviceProviderRepository->insert($serviceProviderEntity);

            $status = ServiceProviderType::from($serviceProviderEntity->getProviderType()) === ServiceProviderType::OFFICIAL;

            // 如果是文生图，才需要同步
            if ($serviceProviderEntity->getCategory() === ServiceProviderCategory::VLM->value) {
                // 给所有组织添加服务商，同步category字段
                $this->serviceProviderConfigRepository->addServiceProviderConfigs($serviceProviderEntity->getId(), $organizationCodes, $status);
            }
            Db::commit();
        } catch (Exception $e) {
            $this->logger->error('添加服务商失败' . $e->getMessage());
            Db::rollBack();
            ExceptionBuilder::throw(ServiceProviderErrorCode::SystemError, __('service_provider.add_provider_failed'));
        }
        return $serviceProviderEntity;
    }

    /**
     * 获取所有服务商.
     * @return ServiceProviderEntity[]
     */
    public function getAllServiceProvider(int $page, int $pageSize): array
    {
        return $this->serviceProviderRepository->getAll($page, $pageSize);
    }

    /**
     * 根据id获取服务商以及服务商下的模型.
     */
    public function getServiceProviderById(int $id): ?ServiceProviderDTO
    {
        $serviceProviderEntity = $this->serviceProviderRepository->getById($id);
        $models = $this->serviceProviderModelsRepository->getModelsByServiceProviderId($serviceProviderEntity->getId());
        return ServiceProviderEntityFactory::toDTO($serviceProviderEntity, $models);
    }

    public function getServiceProviderConfigByServiceProviderModel(ServiceProviderModelsEntity $serviceProviderModelsEntity): ?ServiceProviderConfigEntity
    {
        // 获取服务商配置
        $serviceProviderConfigEntity = $this->serviceProviderConfigRepository->getById($serviceProviderModelsEntity->getServiceProviderConfigId());
        if (! $serviceProviderConfigEntity) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderConfigError);
        }
        // 获取服务商配置，用于确定使用 odin 的哪个客户端去连
        $serviceProviderEntity = $this->serviceProviderRepository->getById($serviceProviderConfigEntity->getServiceProviderId());
        if (! $serviceProviderEntity) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotFound);
        }
        $serviceProviderConfigEntity->setProviderCode(ServiceProviderCode::tryFrom($serviceProviderEntity->getProviderCode()));
        return $serviceProviderConfigEntity;
    }

    /**
     * 给 llm 服务商添加模型，组织自行添加.
     */
    public function saveModelsToServiceProvider(ServiceProviderModelsEntity $serviceProviderModelsEntity): ServiceProviderModelsEntity
    {
        $serviceProviderModelsEntity->valid();

        if ($serviceProviderModelsEntity->getModelType() === ModelType::EMBEDDING->value) {
            $serviceProviderModelsEntity->getConfig()->setSupportEmbedding(true);
        }
        $organizationCode = $serviceProviderModelsEntity->getOrganizationCode();
        $serviceProviderConfigEntity = $this->serviceProviderConfigRepository->getByIdAndOrganizationCode(
            (string) $serviceProviderModelsEntity->getServiceProviderConfigId(),
            $organizationCode
        );

        if ($serviceProviderModelsEntity->getId()) {
            // 设置一下model_parent_id,不需要前端传入
            $serviceProviderModelsEntity->setModelParentId($this->serviceProviderModelsRepository->getById((string) $serviceProviderModelsEntity->getId())->getModelParentId());
        }

        $serviceProviderEntity = $this->serviceProviderRepository->getById($serviceProviderConfigEntity->getServiceProviderId());
        $serviceProviderModelsEntity->setIcon(FileAssembler::formatPath($serviceProviderModelsEntity->getIcon()));

        $serviceProviderModelsEntity->setCategory($serviceProviderEntity->getCategory());
        $serviceProviderModelsEntity->valid();

        // 校验model_id

        if (ServiceProviderCategory::from($serviceProviderEntity->getCategory()) === ServiceProviderCategory::LLM && ! $this->serviceProviderOriginalModelsRepository->exist($serviceProviderModelsEntity->getModelId())) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, '模型id不存在');
        }

        // 当前组织是官方组织
        if ($this->isOfficial($organizationCode)) {
            // 同步其他组织
            $this->syncSaveModelsToOtherServiceProvider($serviceProviderModelsEntity);
        } else {
            // 非官方组织不可添加官方模型以及文生图模型
            $isOfficialProvider = ServiceProviderType::from($serviceProviderEntity->getProviderType()) === ServiceProviderType::OFFICIAL;
            // 只能给大模型服务商添加模型
            if ($isOfficialProvider || ServiceProviderCategory::from($serviceProviderEntity->getCategory()) === ServiceProviderCategory::VLM) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter);
            }
        }
        $this->serviceProviderModelsRepository->saveModels($serviceProviderModelsEntity);
        return $serviceProviderModelsEntity;
    }

    public function saveModelsToServiceProviderForAdmin(ServiceProviderModelsEntity $serviceProviderModelsEntity): ServiceProviderModelsEntity
    {
        $serviceProviderModelsEntity->valid();

        $serviceProviderConfigEntity = $this->serviceProviderConfigRepository->getByIdAndOrganizationCode(
            (string) $serviceProviderModelsEntity->getServiceProviderConfigId(),
            $serviceProviderModelsEntity->getOrganizationCode()
        );

        $serviceProviderModelsEntity->setIcon(FileAssembler::formatPath($serviceProviderModelsEntity->getIcon()));

        $serviceProviderEntity = $this->serviceProviderRepository->getById($serviceProviderConfigEntity->getServiceProviderId());

        // 校验model_id
        if ($serviceProviderEntity->getCategory() === ServiceProviderCategory::LLM->value && ! $this->serviceProviderOriginalModelsRepository->exist($serviceProviderModelsEntity->getModelId())) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, '模型id不存在');
        }

        $serviceProviderModelsEntity->setCategory($serviceProviderEntity->getCategory());
        $serviceProviderModelsEntity->valid();
        $this->handleNonOfficialProviderModel($serviceProviderModelsEntity, $serviceProviderEntity);
        return $serviceProviderModelsEntity;
    }

    /**
     * 根据组织获取服务商.
     * @return ServiceProviderConfigDTO[]
     */
    public function getServiceProviderConfigs(string $organization, ?ServiceProviderCategory $serviceProviderCategory = null): array
    {
        $serviceProviderConfigEntities = $this->serviceProviderConfigRepository->getByOrganizationCode($organization);
        // 获取id
        $ids = array_column($serviceProviderConfigEntities, 'service_provider_id');
        $serviceProviderEntities = $this->serviceProviderRepository->getByIds($ids);
        $serviceProviderMap = [];
        foreach ($serviceProviderEntities as $serviceProviderEntity) {
            $serviceProviderMap[$serviceProviderEntity->getId()] = $serviceProviderEntity;
        }
        $result = [];
        foreach ($serviceProviderConfigEntities as $serviceProviderConfigEntity) {
            $serviceProviderEntity = $serviceProviderMap[$serviceProviderConfigEntity->getServiceProviderId()];
            if ($serviceProviderCategory === null || $serviceProviderEntity->getCategory() === $serviceProviderCategory->value) {
                $result[] = $this->buildServiceProviderConfigDTO($serviceProviderEntity, $serviceProviderConfigEntity);
            }
        }

        return $result;
    }

    /**
     * 获取服务商配置信息.
     */
    public function getServiceProviderConfigDetail(string $serviceProviderConfigId, string $organizationCode): ServiceProviderConfigDTO
    {
        $serviceProviderConfigEntity = $this->serviceProviderConfigRepository->getByIdAndOrganizationCode($serviceProviderConfigId, $organizationCode);
        $serviceProviderEntities = $this->serviceProviderRepository->getByIds([$serviceProviderConfigEntity->getServiceProviderId()]);

        // 可能这个服务商官方下架了
        if (empty($serviceProviderEntities)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotFound);
        }

        // 获取组织级别的模型
        $models = $this->getModelStatusByServiceProviderConfigIdAndOrganizationCode($serviceProviderConfigId, $organizationCode);
        return $this->buildServiceProviderConfigDTO($serviceProviderEntities[0], $serviceProviderConfigEntity, $models);
    }

    /**
     * @return ServiceProviderModelsDTO[]
     */
    public function getModelStatusByServiceProviderConfigIdAndOrganizationCode(string $serviceProviderConfigId, string $organizationCode): array
    {
        $serviceProviderModelsEntities = $this->serviceProviderModelsRepository->getModelStatusByServiceProviderConfigIdAndOrganizationCode($serviceProviderConfigId, $organizationCode);

        $serviceProviderModelsDTOs = [];
        foreach ($serviceProviderModelsEntities as $serviceProviderModelsEntity) {
            $serviceProviderModelsDTOs[] = new ServiceProviderModelsDTO($serviceProviderModelsEntity->toArray());
        }

        return $serviceProviderModelsDTOs;
    }

    /**
     * 保存服务商配置信息.
     */
    public function updateServiceProviderConfig(ServiceProviderConfigEntity $serviceProviderConfigEntity): ServiceProviderConfigEntity
    {
        $serviceProviderConfigEntityObject = $this->serviceProviderConfigRepository->getByIdAndOrganizationCode((string) $serviceProviderConfigEntity->getId(), $serviceProviderConfigEntity->getOrganizationCode());

        // 不可修改官方服务商
        $serviceProviderEntity = $this->serviceProviderRepository->getById($serviceProviderConfigEntityObject->getServiceProviderId());
        if (ServiceProviderType::from($serviceProviderEntity->getProviderType()) === ServiceProviderType::OFFICIAL) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::SystemError, '官方服务商不可修改');
        }

        // 处理脱敏后的配置数据
        if ($serviceProviderConfigEntity->getConfig() && $serviceProviderConfigEntityObject->getConfig()) {
            $processedConfig = $this->processDesensitizedConfig(
                $serviceProviderConfigEntity->getConfig(),
                $serviceProviderConfigEntityObject->getConfig()
            );
            $serviceProviderConfigEntity->setConfig($processedConfig);
        }

        $serviceProviderConfigEntity->setServiceProviderId($serviceProviderConfigEntityObject->getServiceProviderId());

        // 只有大模型服务商并且是非官方的类型才能修改别名
        $serviceProviderCategory = ServiceProviderCategory::from($serviceProviderEntity->getCategory());
        if ($serviceProviderCategory === ServiceProviderCategory::VLM) {
            $serviceProviderConfigEntity->setAlias('');
        }

        // 检查是否修改了服务商状态
        $statusChanged = $serviceProviderConfigEntityObject->getStatus() !== $serviceProviderConfigEntity->getStatus();
        $originalStatus = Status::from($serviceProviderConfigEntityObject->getStatus());
        $newStatus = Status::from($serviceProviderConfigEntity->getStatus());

        $this->serviceProviderConfigRepository->save($serviceProviderConfigEntity);

        // 尝试同步其他组织的模型状态
        // 修改服务商状态如果是官方组织修改的，则还需要同步修改其他组织下的magic服务商下对应模型的状态

        $isOfficeOrganization = $this->isOfficial($serviceProviderConfigEntity->getOrganizationCode());

        if ($isOfficeOrganization && $statusChanged) {
            // 获取当前服务商下的所有模型
            $currentModels = $this->serviceProviderModelsRepository->getModelsByServiceProviderConfigId($serviceProviderConfigEntity->getId());

            if ($newStatus === Status::DISABLE) {
                // 设置禁用来源为official
                $disabledBy = DisabledByType::OFFICIAL;

                foreach ($currentModels as $model) {
                    // 使用排除自身的方法
                    // 大模型服务商和文生图服务商分开处理，文生图模型没有 model_parent_id ，因为官方组织无法添加
                    if ($serviceProviderCategory === ServiceProviderCategory::VLM) {
                        $this->serviceProviderModelsRepository->syncUpdateModelsStatusExcludeSelfByVLM($model->getModelVersion(), Status::DISABLE, $disabledBy);
                    } elseif ($serviceProviderCategory === ServiceProviderCategory::LLM) {
                        $this->serviceProviderModelsRepository->syncUpdateModelsStatusExcludeSelfByLLM($model->getId(), Status::DISABLE, $disabledBy);
                    }
                }
            } elseif ($newStatus === Status::ACTIVE && $originalStatus === Status::DISABLE) {
                foreach ($currentModels as $model) {
                    // 获取当前模型状态并使用排除自身的方法
                    $modelStatus = Status::from($model->getStatus());
                    // 激活时，清除禁用来源
                    $disabledBy = $modelStatus === Status::DISABLE ? null : null;

                    if ($serviceProviderCategory == ServiceProviderCategory::VLM) {
                        $this->serviceProviderModelsRepository->syncUpdateModelsStatusExcludeSelfByVLM($model->getModelVersion(), $modelStatus, $disabledBy);
                    } elseif ($serviceProviderCategory == ServiceProviderCategory::LLM) {
                        $this->serviceProviderModelsRepository->syncUpdateModelsStatusExcludeSelfByLLM($model->getId(), $modelStatus, $disabledBy);
                    }
                }
            }
        }

        return $serviceProviderConfigEntity;
    }

    /**
     * 修改可用的模型状态
     */
    public function updateModelStatus(string $modelId, Status $status, string $organizationCode): void
    {
        // 根据模型id获取服务商
        $serviceProviderModelsEntity = $this->getModelById($modelId);
        $serviceProviderConfigId = $serviceProviderModelsEntity->getServiceProviderConfigId();
        $serviceProviderConfigDetail = $this->getServiceProviderConfigDetail((string) $serviceProviderConfigId, $organizationCode);
        $serviceProviderDTO = $this->getServiceProviderById((int) $serviceProviderConfigDetail->getServiceProviderId());

        // 设置禁用来源
        $disabledBy = $this->isOfficial($organizationCode) ? DisabledByType::OFFICIAL : DisabledByType::USER;

        if ($this->isOfficial($organizationCode)) {
            // 如果服务商状态为false，则其他模型为false
            $newStatus = $status;
            if ($serviceProviderConfigDetail->getStatus() === Status::DISABLE->value) {
                $newStatus = Status::DISABLE;
            }
            $serviceProviderCategory = ServiceProviderCategory::from($serviceProviderDTO->getCategory());
            if ($serviceProviderCategory === ServiceProviderCategory::VLM) {
                $this->syncUpdateModelsStatusByVLM($serviceProviderModelsEntity->getModelVersion(), $newStatus, $disabledBy);
            } elseif ($serviceProviderCategory === ServiceProviderCategory::LLM) {
                $this->syncUpdateModelsStatusByLLM((int) $serviceProviderModelsEntity->getId(), $newStatus, $disabledBy);
            }
        }
        // 更新模型状态和禁用来源
        $this->serviceProviderModelsRepository->updateModelStatusAndDisabledBy($modelId, $organizationCode, $status, $disabledBy);
    }

    /**
     * 根据组织和服务商类型获取模型列表.
     * @param string $organizationCode 组织编码
     * @param ?ServiceProviderCategory $serviceProviderCategory 服务商类型
     * @return ServiceProviderConfigDTO[]
     */
    public function getActiveModelsByOrganizationCode(string $organizationCode, ?ServiceProviderCategory $serviceProviderCategory = null): array
    {
        // 1. 获取组织下的所有服务商配置
        $serviceProviderConfigs = $this->serviceProviderConfigRepository->getByOrganizationCodeAndActive($organizationCode);
        if (empty($serviceProviderConfigs)) {
            return [];
        }

        // 2. 获取对应的服务商信息
        $serviceProviderIds = array_column($serviceProviderConfigs, 'service_provider_id');
        $serviceProviderEntities = $this->serviceProviderRepository->getByIds($serviceProviderIds);

        // 按类型过滤服务商
        $serviceProviderMap = [];
        foreach ($serviceProviderEntities as $serviceProviderEntity) {
            if ($serviceProviderCategory === null || $serviceProviderEntity->getCategory() === $serviceProviderCategory->value) {
                $serviceProviderMap[$serviceProviderEntity->getId()] = $serviceProviderEntity;
            }
        }

        if (empty($serviceProviderMap)) {
            return [];
        }

        // 过滤掉不符合类型的配置
        /**
         * @var ServiceProviderConfigEntity[] $filteredConfigEntities
         */
        $filteredConfigEntities = [];
        foreach ($serviceProviderConfigs as $configEntity) {
            if (isset($serviceProviderMap[$configEntity->getServiceProviderId()])) {
                $filteredConfigEntities[] = $configEntity;
            }
        }

        // 3. 获取所有配置的激活模型
        $serviceProviderConfigIds = array_column($filteredConfigEntities, 'id');
        $allActiveModels = $this->serviceProviderModelsRepository->getActiveModelsByOrganizationCode($serviceProviderConfigIds, $organizationCode);

        if (empty($allActiveModels)) {
            return [];
        }

        // 4. 按照service_provider_config_id分组active models
        $activeModelsMap = [];
        foreach ($allActiveModels as $activeModel) {
            $configId = $activeModel->getServiceProviderConfigId();
            if (! isset($activeModelsMap[$configId])) {
                $activeModelsMap[$configId] = [];
            }
            $activeModelsMap[$configId][] = $activeModel;
        }

        // 5. 组装结果
        $result = [];
        foreach ($filteredConfigEntities as $configEntity) {
            $serviceProviderId = $configEntity->getServiceProviderId();
            $configId = $configEntity->getId();
            $activeModels = $activeModelsMap[$configId] ?? [];

            // 直接使用 activeModels 创建 DTO
            $configModels = [];
            foreach ($activeModels as $model) {
                $configModels[] = new ServiceProviderModelsDTO($model->toArray());
            }

            $serviceProviderConfigDTO = $this->buildServiceProviderConfigDTO($serviceProviderMap[$serviceProviderId], $configEntity, $configModels);
            $serviceProviderConfigDTO->setConfig(new ServiceProviderConfig());
            $result[] = $serviceProviderConfigDTO;
        }

        return $result;
    }

    /**
     * @throws Exception
     */
    public function deleteModel(string $modelId, string $organizationCode): void
    {
        $serviceProviderModelsEntity = $this->serviceProviderModelsRepository->getById($modelId);
        if ($this->isOfficial($organizationCode)) {
            $this->syncDeleteModelsToOtherServiceProvider([$serviceProviderModelsEntity->getId()]);
        }
        $this->serviceProviderModelsRepository->deleteByModelIdAndOrganizationCode($modelId, $organizationCode);
    }

    /**
     * 获取原始模型列表.
     * @return ServiceProviderOriginalModelsEntity[]
     */
    public function listOriginalModels(string $organizationCode): array
    {
        // 获取系统的模型标识
        return $this->serviceProviderOriginalModelsRepository->listModels($organizationCode);
    }

    /**
     * 初始化组织的服务商信息
     * 当新加入一个组织后，初始化该组织的服务商和模型配置.
     * @return ServiceProviderConfigDTO[] 初始化后的服务商配置列表
     * @throws LockException
     */
    public function initOrganizationServiceProviders(string $organizationCode, ?ServiceProviderCategory $serviceProviderCategory = null): array
    {
        $lockKey = 'service_provider:init:' . $organizationCode;
        $userId = uniqid('service_provider'); // 使用唯一ID作为锁的拥有者

        // 尝试获取锁，超时时间设置为60秒
        if (! $this->redisLocker->mutexLock($lockKey, $userId, 60)) {
            $this->logger->warning(sprintf('获取 initOrganizationServiceProviders 锁失败, organizationCode: %s', $organizationCode));
            // 获取锁失败，返回空结果，避免并发操作
            return [];
        }

        try {
            $this->logger->info(sprintf('获取 initOrganizationServiceProviders 锁成功, 开始执行初始化, organizationCode: %s', $organizationCode));

            $result = [];
            Db::beginTransaction();
            try {
                // 获取所有服务商（如果指定了类别，则只获取该类别的服务商）
                $serviceProviders = $this->serviceProviderRepository->getAllByCategory(1, 1000, $serviceProviderCategory);
                if (empty($serviceProviders)) {
                    return [];
                }

                // 收集需要同步模型的服务商（官方和VLM类型）
                $officialAndVlmProviders = [];
                $serviceProviderMap = [];

                // collect vlm and official provider
                foreach ($serviceProviders as $serviceProvider) {
                    if ($serviceProvider->getCategory() === ServiceProviderCategory::LLM->value) {
                        continue;
                    }
                    $serviceProviderMap[$serviceProvider->getId()] = $serviceProvider;
                    // 收集需要同步模型的服务商（官方和VLM类型）
                    $isOfficial = ServiceProviderType::from($serviceProvider->getProviderType()) === ServiceProviderType::OFFICIAL;
                    if ($isOfficial || ServiceProviderCategory::from($serviceProvider->getCategory()) === ServiceProviderCategory::VLM) {
                        $officialAndVlmProviders[] = $serviceProvider->getId();
                    }
                }

                // 批量创建服务商配置
                $configEntities = $this->batchCreateServiceProviderConfigs($serviceProviders, $organizationCode);

                // process vlm and official provider
                if (! empty($officialAndVlmProviders)) {
                    $this->batchSyncServiceProviderModels($officialAndVlmProviders, $organizationCode);
                }

                // Special handling: Initialize models for new organization's Magic service provider from all LLM service providers in official organization
                $this->initMagicServiceProviderModels($organizationCode);

                // 构建返回结果
                foreach ($configEntities as $configEntity) {
                    $serviceProviderId = $configEntity->getServiceProviderId();
                    if (isset($serviceProviderMap[$serviceProviderId])) {
                        $result[] = $this->buildServiceProviderConfigDTO(
                            $serviceProviderMap[$serviceProviderId],
                            $configEntity
                        );
                    }
                }

                Db::commit();
            } catch (Exception $e) {
                $this->logger->error('初始化组织服务商失败: ' . $e->getMessage());
                Db::rollBack();
                ExceptionBuilder::throw(ServiceProviderErrorCode::SystemError, __('service_provider.init_organization_providers_failed'));
            }

            return $result;
        } finally {
            // 确保锁被释放
            $this->redisLocker->release($lockKey, $userId);
            $this->logger->info(sprintf('释放 initOrganizationServiceProviders 锁, organizationCode: %s', $organizationCode));
        }
    }

    /**
     * 批量同步服务商模型数据.
     * @param array $serviceProviderIds 服务商ID数组
     * @param string $orgCode 组织代码
     */
    public function batchSyncServiceProviderModels(array $serviceProviderIds, string $orgCode): bool
    {
        if (empty($serviceProviderIds) || empty($orgCode)) {
            return false;
        }

        // 1. 获取目标组织下的所有服务商配置
        $newOrgConfigs = $this->serviceProviderConfigRepository->getByOrganizationCode($orgCode);
        if (empty($newOrgConfigs)) {
            return false;
        }

        // 2. 创建服务商ID到配置ID的映射
        $newOrgConfigMap = [];
        foreach ($newOrgConfigs as $config) {
            $newOrgConfigMap[$config->getServiceProviderId()] = $config->getId();
        }

        // 3. 获取样例配置ID和对应的服务商ID映射
        $configToProviderMap = $this->serviceProviderConfigRepository->getSampleConfigsByServiceProviderIds($serviceProviderIds);
        if (empty($configToProviderMap)) {
            return true; // 没有找到任何配置，但不视为错误
        }

        // 4. 获取所有样例配置ID
        $sampleConfigIds = array_keys($configToProviderMap);

        // 5. 根据样例配置ID批量获取模型
        $allModels = $this->serviceProviderModelsRepository->getModelsByConfigIds($sampleConfigIds);
        if (empty($allModels)) {
            return true;
        }

        // 6. 按服务商ID组织模型
        $modelsByProviderId = [];
        foreach ($allModels as $model) {
            $configId = $model->getServiceProviderConfigId();
            if (isset($configToProviderMap[$configId])) {
                $providerId = $configToProviderMap[$configId];
                if (! isset($modelsByProviderId[$providerId])) {
                    $modelsByProviderId[$providerId] = [];
                }
                $modelsByProviderId[$providerId][] = $model;
            }
        }

        // 7. 为目标组织创建模型副本
        $modelsToSave = [];
        foreach ($serviceProviderIds as $serviceProviderId) {
            if (! isset($newOrgConfigMap[$serviceProviderId]) || ! isset($modelsByProviderId[$serviceProviderId])) {
                continue;
            }

            $newConfigId = $newOrgConfigMap[$serviceProviderId];
            $baseModels = $modelsByProviderId[$serviceProviderId];

            foreach ($baseModels as $baseModel) {
                $newModel = clone $baseModel;
                $newModel->setServiceProviderConfigId($newConfigId);
                $newModel->setOrganizationCode($orgCode);
                $modelsToSave[] = $newModel;
            }
        }

        // 8. 批量保存所有模型
        if (! empty($modelsToSave)) {
            $this->serviceProviderModelsRepository->batchSaveModels($modelsToSave);
            return true;
        }

        return true;
    }

    /**
     * 连通性测试.
     * @throws Exception
     */
    public function connectivityTest(string $serviceProviderConfigId, string $modelVersion, string $organizationCode): Provider\ConnectResponse
    {
        $serviceProviderConfigDTO = $this->getServiceProviderConfigDetail($serviceProviderConfigId, $organizationCode);
        $serviceProviderConfig = $serviceProviderConfigDTO->getConfig();

        $serviceProviderCode = ServiceProviderCode::from($serviceProviderConfigDTO->getProviderCode());

        $provider = ServiceProviderFactory::get($serviceProviderCode, ServiceProviderCategory::from($serviceProviderConfigDTO->getCategory()));
        return $provider->connectivityTestByModel($serviceProviderConfig, $modelVersion);
    }

    public function addOriginalModel(string $modelId): void
    {
        if ($this->serviceProviderOriginalModelsRepository->exist($modelId)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, __('service_provider.original_model_already_exists'));
        }

        $serviceProviderOriginalModelsEntity = new ServiceProviderOriginalModelsEntity();
        $serviceProviderOriginalModelsEntity->setModelId($modelId);
        $this->serviceProviderOriginalModelsRepository->insert($serviceProviderOriginalModelsEntity);
    }

    public function deleteOriginalModel(string $modelId): void
    {
        $this->serviceProviderOriginalModelsRepository->deleteByModelId($modelId);
    }

    /**
     * 获取服务商配置（综合方法）
     * 根据模型版本、模型ID和组织编码获取服务商配置.
     *
     * @param string $modelVersion 模型版本
     * @param string $modelId 模型ID
     * @param string $organizationCode 组织编码
     * @return ?ServiceProviderResponse 服务商配置响应
     * @throws Exception
     */
    public function getServiceProviderConfig(
        string $modelVersion,
        string $modelId,
        string $organizationCode,
        bool $throw = true,
    ): ?ServiceProviderResponse {
        // 1. 如果提供了 modelId，走新的逻辑
        if (! empty($modelId)) {
            return $this->getServiceProviderConfigByModelId($modelId, $organizationCode, $throw);
        }

        // 2. 如果只有 modelVersion，先尝试查找对应的模型
        if (! empty($modelVersion)) {
            $models = $this->serviceProviderModelsRepository->getModelsByVersionAndOrganization($modelVersion, $organizationCode);
            if (! empty($models)) {
                // 如果找到模型，不直接返回官方服务商配置，而是进行进一步判断
                $this->logger->info('找到对应模型，判断服务商配置', [
                    'modelVersion' => $modelVersion,
                    'organizationCode' => $organizationCode,
                ]);

                // 从激活的模型中查找可用的服务商配置
                return $this->findAvailableServiceProviderFromModels($models, $organizationCode);
            }
        }

        // 3. 如果都没找到，抛出异常
        ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
    }

    /**
     * 根据模型ID获取服务商配置.
     * @param string $modelId 模型ID
     * @param string $organizationCode 组织编码
     * @throws Exception
     */
    public function getServiceProviderConfigByModelId(string $modelId, string $organizationCode, bool $throwModelNotExist = true): ?ServiceProviderResponse
    {
        // 1. 获取模型信息
        $serviceProviderModelEntity = $this->serviceProviderModelsRepository->getById($modelId, $throwModelNotExist);

        if (empty($serviceProviderModelEntity)) {
            return null;
        }

        // 2. 检查模型状态
        if (Status::from($serviceProviderModelEntity->getStatus()) === Status::DISABLE) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotActive);
        }

        // 3. 获取服务商配置
        $serviceProviderConfigId = $serviceProviderModelEntity->getServiceProviderConfigId();
        $serviceProviderConfigEntity = $this->serviceProviderConfigRepository->getByIdAndOrganizationCode(
            (string) $serviceProviderConfigId,
            $organizationCode
        );

        // 4. 获取服务商信息
        $serviceProviderId = $serviceProviderConfigEntity->getServiceProviderId();
        $serviceProviderEntity = $this->serviceProviderRepository->getById($serviceProviderId);
        // 5. 判断服务商类型和状态
        $serviceProviderType = ServiceProviderType::from($serviceProviderEntity->getProviderType());
        if (
            $serviceProviderType !== ServiceProviderType::OFFICIAL
            && Status::from($serviceProviderConfigEntity->getStatus()) === Status::DISABLE
        ) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotActive);
        }

        // 6. 构建响应
        $serviceProviderResponse = new ServiceProviderResponse();
        $serviceProviderResponse->setModelConfig($serviceProviderModelEntity->getConfig());
        $serviceProviderResponse->setServiceProviderConfig($serviceProviderConfigEntity->getConfig());
        $serviceProviderResponse->setServiceProviderType($serviceProviderType);
        $serviceProviderResponse->setServiceProviderModelsEntity($serviceProviderModelEntity);
        $serviceProviderResponse->setServiceProviderCode($serviceProviderEntity->getProviderCode());

        return $serviceProviderResponse;
    }

    public function getModelByIdAndOrganizationCode(string $modelId, string $organizationCode): ServiceProviderModelsEntity
    {
        return $this->serviceProviderModelsRepository->getModelByIdAndOrganizationCode($modelId, $organizationCode);
    }

    public function getModelById(string $id): ServiceProviderModelsEntity
    {
        return $this->serviceProviderModelsRepository->getById($id);
    }

    /**
     * 返回模型和服务商都被激活了的接入点列表.
     * 要判断 model_parent_id 的模型和服务商是否激活.
     * @return ServiceProviderModelsEntity[]
     */
    public function getOrganizationActiveModelsByIdOrType(string $key, ?string $orgCode = null): array
    {
        // 获取所有匹配条件的活跃模型
        $models = $this->serviceProviderModelsRepository->getOrganizationActiveModelsByIdOrType($key, $orgCode);
        if (empty($models)) {
            return [];
        }

        // 提取模型配置ID和父模型ID
        $modelConfigIds = $this->extractModelConfigIds($models);
        $parentModelIds = $this->extractParentModelIds($models);

        // 获取父模型数据和映射
        $parentModelMap = $this->buildParentModelMap($parentModelIds);

        // 合并所有需要查询的配置ID
        $allConfigIds = $this->mergeAllConfigIds($modelConfigIds, $parentModelMap);

        // 一次性批量查询所有服务商配置并过滤激活状态
        $activeConfigMap = $this->getActiveConfigMap($allConfigIds);
        if (empty($activeConfigMap)) {
            return [];
        }

        // 筛选并处理最终的活跃模型（同时过滤父模型）
        return $this->filterActiveModels($models, $activeConfigMap, $parentModelMap);
    }

    public function deleteServiceProviderForAdmin(string $serviceProviderConfigId, string $organizationCode): void
    {
        Db::beginTransaction();
        try {
            // 1. 获取服务商配置实体
            $serviceProviderConfigEntity = $this->serviceProviderConfigRepository->getByIdAndOrganizationCode($serviceProviderConfigId, $organizationCode);
            $serviceProviderId = $serviceProviderConfigEntity->getServiceProviderId();

            // 2. 获取所有相关的服务商配置
            $serviceProviderConfigEntities = $this->serviceProviderConfigRepository->getsByServiceProviderId($serviceProviderId);
            $serviceProviderConfigIds = array_column($serviceProviderConfigEntities, 'id');

            // 3. 获取并删除服务商配置下的所有模型
            if (! empty($serviceProviderConfigIds)) {
                // 获取与这些配置相关的所有模型
                $models = $this->serviceProviderModelsRepository->getModelsByServiceProviderConfigIds($serviceProviderConfigIds);

                if (! empty($models)) {
                    // 提取模型 ID 列表
                    $modelIds = array_map(function ($model) {
                        return $model->getId();
                    }, $models);
                    $this->serviceProviderModelsRepository->deleteByIds($modelIds);
                }
            }

            // 4. 删除服务商配置
            $this->serviceProviderConfigRepository->deleteByServiceProviderId($serviceProviderId);

            Db::commit();
        } catch (Exception $e) {
            $this->logger->error('删除服务商及模型失败: ' . $e->getMessage());
            Db::rollBack();
            ExceptionBuilder::throw(ServiceProviderErrorCode::SystemError, __('service_provider.delete_provider_failed'));
        }
    }

    public function updateServiceProvider(ServiceProviderEntity $serviceProviderEntity, string $organizationCode): ServiceProviderEntity
    {
        $serviceProviderEntity->setIcon(FileAssembler::formatPath($serviceProviderEntity->getIcon()));
        $serviceProviderConfigEntity = $this->serviceProviderConfigRepository->getByIdAndOrganizationCode((string) $serviceProviderEntity->getId(), $organizationCode);
        $serviceProviderId = $serviceProviderConfigEntity->getServiceProviderId();
        $serviceProviderEntity->setId($serviceProviderId);
        return $this->serviceProviderRepository->updateById($serviceProviderEntity);
    }

    public function addModelId(string $modelId): ServiceProviderOriginalModelsEntity
    {
        $serviceProviderOriginalModelsEntity = new ServiceProviderOriginalModelsEntity();
        $serviceProviderOriginalModelsEntity->setModelId($modelId);
        return $this->serviceProviderOriginalModelsRepository->insert($serviceProviderOriginalModelsEntity);
    }

    public function addServiceProviderForOrganization(ServiceProviderConfigDTO $serviceProviderConfigDTO, string $organizationCode): ServiceProviderConfigDTO
    {
        $serviceProviderId = (int) $serviceProviderConfigDTO->getServiceProviderId();
        // 获取服务商
        $serviceProviderEntity = $this->serviceProviderRepository->getById($serviceProviderId);
        // 如果是官方服务商则不允许添加
        $serviceProviderType = ServiceProviderType::from($serviceProviderEntity->getProviderType());
        if ($serviceProviderType === ServiceProviderType::OFFICIAL) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotFound);
        }

        // 添加事务
        Db::beginTransaction();
        try {
            $serviceProviderConfigEntity = new ServiceProviderConfigEntity();
            $serviceProviderConfigEntity->setAlias($serviceProviderConfigDTO->getAlias());
            $serviceProviderConfigEntity->setServiceProviderId($serviceProviderEntity->getId());
            $serviceProviderConfigEntity->setOrganizationCode($organizationCode);
            $serviceProviderConfigEntity->setStatus($serviceProviderConfigDTO->getStatus());
            $serviceProviderConfigEntity->setConfig($serviceProviderConfigDTO->getConfig());
            $serviceProviderConfigEntity = $this->serviceProviderConfigRepository->insert($serviceProviderConfigEntity);
        } catch (Exception $exception) {
            Db::rollBack();
            $this->logger->error('添加服务商失败: ' . $exception->getMessage());
            ExceptionBuilder::throw(ServiceProviderErrorCode::SystemError, __('service_provider.add_provider_failed'));
        }
        Db::commit();
        return $this->buildServiceProviderConfigDTO($serviceProviderEntity, $serviceProviderConfigEntity);
    }

    public function deleteServiceProviderForOrganization(string $serviceProviderConfigId, string $organizationCode): void
    {
        // 判断 serviceProviderConfigId 为空
        if (empty($serviceProviderConfigId)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, __('service_provider.service_provider_config_id_is_required'));
        }

        // 查询服务商配置
        $serviceProviderConfigEntity = $this->serviceProviderConfigRepository->getByIdAndOrganizationCode($serviceProviderConfigId, $organizationCode);

        // 查询服务商
        $serviceProviderEntity = $this->serviceProviderRepository->getById($serviceProviderConfigEntity->getServiceProviderId());
        // 只有大模型的服务商并且是非官方的服务商才能删除
        $serviceProviderType = ServiceProviderType::from($serviceProviderEntity->getProviderType());
        if ($serviceProviderType === ServiceProviderType::OFFICIAL || ServiceProviderCategory::from($serviceProviderEntity->getCategory()) === ServiceProviderCategory::VLM) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotFound);
        }

        // 事务
        Db::beginTransaction();
        try {
            // 删除服务商配置
            $this->serviceProviderConfigRepository->deleteById($serviceProviderConfigId);

            // 如果是官方组织则要把所有模型删除
            if ($this->isOfficial($organizationCode)) {
                // 获取服务商下的所有模型
                $models = $this->serviceProviderModelsRepository->getModelsByServiceProviderId((int) $serviceProviderConfigId);
                $modelParentIds = array_column($models, 'model_parent_id');
                $this->syncDeleteModelsToOtherServiceProvider($modelParentIds);
            } else {
                // 删除服务商下所有的模型
                $this->serviceProviderModelsRepository->deleteByServiceProviderConfigId($serviceProviderConfigId, $organizationCode);
            }
        } catch (Exception $exception) {
            Db::rollBack();
            $this->logger->error('删除服务商失败: ' . $exception->getMessage());
            ExceptionBuilder::throw(ServiceProviderErrorCode::SystemError, __('service_provider.delete_provider_failed'));
        }
        Db::commit();
    }

    public function addModelIdForOrganization(string $modelId, string $organizationCode): void
    {
        // 不可重复添加，以组织纬度+modelId判断，因为其他组织可能也会添加，使用额外方法
        if ($this->serviceProviderOriginalModelsRepository->existByOrganizationCodeAndModelId($organizationCode, $modelId)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter, __('service_provider.original_model_already_exists'));
        }

        $serviceProviderOriginalModelsEntity = new ServiceProviderOriginalModelsEntity();
        $serviceProviderOriginalModelsEntity->setModelId($modelId);
        $serviceProviderOriginalModelsEntity->setOrganizationCode($organizationCode);
        $serviceProviderOriginalModelsEntity->setType(OriginalModelType::ORGANIZATION_ADD->value);
        $this->serviceProviderOriginalModelsRepository->insert($serviceProviderOriginalModelsEntity);
    }

    // 删除模型
    public function deleteModelIdForOrganization(string $modelId, string $organizationCode): void
    {
        $this->serviceProviderOriginalModelsRepository->deleteByModelIdAndOrganizationCodeAndType($modelId, $organizationCode, OriginalModelType::ORGANIZATION_ADD->value);
    }

    /**
     * 获取超清修复服务商配置。
     * 从ImageGenerateModelType::getMiracleVisionModes()[0]获取模型。
     * 如果官方和非官方都启用，优先使用非官方配置。
     *
     * @param string $modelId 模型版本
     * @param string $organizationCode 组织编码
     * @return ServiceProviderResponse 服务商配置响应
     */
    public function getMiracleVisionServiceProviderConfig(string $modelId, string $organizationCode): ServiceProviderResponse
    {
        // 直接获取指定模型版本和组织的模型列表
        $models = $this->serviceProviderModelsRepository->getModelsByVersionIdAndOrganization($modelId, $organizationCode);

        if (empty($models)) {
            $this->logger->warning('美图模型未找到' . $modelId);
            // 如果没有找到模型，抛出异常
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
        }

        // 收集所有激活的模型
        $activeModels = [];
        foreach ($models as $model) {
            if ($model->getStatus() === Status::ACTIVE->value) {
                $activeModels[] = $model;
            }
        }

        // 如果没有激活的模型，抛出异常
        if (empty($activeModels)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotActive);
        }

        // 从激活的模型中查找可用的服务商配置
        return $this->findAvailableServiceProviderFromModels($activeModels, $organizationCode);
    }

    /**
     * 获取指定组织下的非官方服务商列表.
     *
     * @param string $organizationCode 组织编码
     * @param ServiceProviderCategory $category 服务商类别
     * @return array 非官方服务商列表
     */
    public function getNonOfficialServiceProviders(string $organizationCode, ServiceProviderCategory $category): array
    {
        // 获取非官方服务商列表
        $serviceProviders = $this->serviceProviderRepository->getNonOfficialByCategory($category);

        if (empty($serviceProviders)) {
            return [];
        }

        // 转换为前端需要的格式
        $result = [];
        foreach ($serviceProviders as $serviceProvider) {
            $result[] = [
                'id' => $serviceProvider->getId(),
                'name' => $serviceProvider->getName(),
                'icon' => $serviceProvider->getIcon(),
                'category' => $serviceProvider->getCategory(),
                'provider_type' => $serviceProvider->getProviderType(),
                'description' => $serviceProvider->getDescription(),
            ];
        }

        return $result;
    }

    /**
     * 获取所有非官方服务商列表，不依赖于组织编码
     *
     * @param ServiceProviderCategory $category 服务商类别
     * @return ServiceProviderDTO[]
     */
    public function getAllNonOfficialProviders(ServiceProviderCategory $category): array
    {
        $serviceProviderEntities = $this->serviceProviderRepository->getNonOfficialByCategory($category);
        return ServiceProviderEntityFactory::toDTOs($serviceProviderEntities);
    }

    /**
     * 根据模型类型获取启用模型(优先取组织的).
     * @throws Exception
     */
    public function findSelectedActiveProviderByType(string $organizationCode, ModelType $modelType): ?ServiceProviderResponse
    {
        // 先获取组织的
        if ($model = $this->serviceProviderModelsRepository->findActiveModelByType($modelType, $organizationCode)) {
            return $this->getServiceProviderConfig($model->getModelVersion(), (string) $model->getId(), $organizationCode, false);
        }
        // 再获取官方的
        $model = $this->serviceProviderModelsRepository->findActiveModelByType($modelType, env('OFFICE_ORGANIZATION', ''));
        return $model ? $this->getServiceProviderConfig($model->getModelVersion(), (string) $model->getId(), $organizationCode, false) : null;
    }

    /**
     * 根据可见组织过滤模型.
     *
     * @param $serviceProviderModels ServiceProviderModelsDTO[] 服务提供商模型数组
     * @param string $currentOrganizationCode 当前组织代码
     * @return array 过滤后的模型数组
     */
    public function filterModelsByVisibleOrganizations(array $serviceProviderModels, string $currentOrganizationCode): array
    {
        // 如果当前是官方组织，直接返回所有模型，无需过滤
        if ($this->isOfficial($currentOrganizationCode)) {
            return $serviceProviderModels;
        }

        // 非官方组织需要按可见性过滤
        return array_filter($serviceProviderModels, function ($model) use ($currentOrganizationCode) {
            // 获取模型的可见组织列表
            $visibleOrganizations = $model->getVisibleOrganizations();

            // 如果可见组织为空，则所有组织可见
            if (empty($visibleOrganizations)) {
                return true;
            }

            // 如果可见组织不为空，检查当前组织是否在可见组织列表中
            return in_array($currentOrganizationCode, $visibleOrganizations);
        });
    }

    /**
     * 根据可见应用过滤模型.
     *
     * @param $serviceProviderModels ServiceProviderModelsDTO[] 服务提供商模型数组
     * @param string $currentApplicationCode 当前应用代码
     * @return array 过滤后的模型数组
     */
    public function filterModelsByVisibleApplications(array $serviceProviderModels, string $currentApplicationCode): array
    {
        return array_filter($serviceProviderModels, function ($model) use ($currentApplicationCode) {
            // 获取模型的可见应用列表
            $visibleApplications = $model->getVisibleApplications();

            // 如果可见应用为空，则所有应用可见
            if (empty($visibleApplications)) {
                return true;
            }

            // 如果可见应用不为空，检查当前应用是否在可见应用列表中
            return in_array($currentApplicationCode, $visibleApplications);
        });
    }

    public function maskString(string $value): string
    {
        if (empty($value)) {
            return '';
        }
        $length = mb_strlen($value);
        if ($length <= 6) {
            return str_repeat('*', $length);
        }

        // 保留前三位和后三位，中间用原字符数量相同的星号代替
        $prefix = mb_substr($value, 0, 3);
        $suffix = mb_substr($value, -3, 3);
        $middleLength = $length - 6; // 减去前三位和后三位
        $maskedMiddle = str_repeat('*', $middleLength);
        return $prefix . $maskedMiddle . $suffix;
    }

    /**
     * @return ServiceProviderModelsEntity[]
     */
    public function getOfficeModels(ServiceProviderCategory $category): array
    {
        $serviceProviderEntities = $this->serviceProviderRepository->getByCategory($category);
        $serviceProviderConfigEntities = $this->serviceProviderConfigRepository->getsByServiceProviderIdsAndOffice(array_column($serviceProviderEntities, 'id'));
        $serviceProviderConfigIds = array_column($serviceProviderConfigEntities, 'id');

        return $this->serviceProviderModelsRepository->getActiveModelsByConfigIds($serviceProviderConfigIds);
    }

    /**
     * 获取官方的激活模型配置（支持返回多个）.
     * @param string $modelVersion 模型
     * @return ServiceProviderConfig[] 服务商配置数组
     */
    public function getOfficeAndActiveModel(string $modelVersion, ServiceProviderCategory $category): array
    {
        $serviceProviderEntities = $this->serviceProviderRepository->getByCategory($category);
        $serviceProviderConfigEntities = $this->serviceProviderConfigRepository->getsByServiceProviderIdsAndOffice(array_column($serviceProviderEntities, 'id'));

        // 提取所有服务商配置ID
        $serviceProviderConfigIds = array_column($serviceProviderConfigEntities, 'id');

        // 根据服务商配置IDs、modelId和激活状态查找对应的模型（可能有多个）
        $activeModels = $this->serviceProviderModelsRepository->getActiveModelsByConfigIdsAndModelVersion($serviceProviderConfigIds, $modelVersion);

        if (empty($activeModels)) {
            // 如果没有找到激活的模型，返回空数组
            return [];
        }

        // 创建配置ID到配置实体的映射，便于快速查找
        $configMap = [];
        foreach ($serviceProviderConfigEntities as $configEntity) {
            $configMap[$configEntity->getId()] = $configEntity;
        }

        // 收集所有匹配的服务商配置
        $result = [];
        foreach ($activeModels as $activeModel) {
            $targetConfigId = $activeModel->getServiceProviderConfigId();
            if (isset($configMap[$targetConfigId])) {
                $config = $configMap[$targetConfigId]->getConfig();
                if ($config) {
                    $result[] = $config;
                }
            }
        }

        // 如果没有找到任何有效配置，返回空数组
        return $result;
    }

    /**
     * 提取模型的配置ID.
     * @param ServiceProviderModelsEntity[] $models
     * @return array 模型配置ID数组
     */
    private function extractModelConfigIds(array $models): array
    {
        $modelConfigIds = [];
        foreach ($models as $model) {
            $modelConfigIds[] = $model->getServiceProviderConfigId();
        }
        return array_unique($modelConfigIds);
    }

    /**
     * 提取模型的父模型ID.
     * @param ServiceProviderModelsEntity[] $models
     * @return array 父模型ID数组
     */
    private function extractParentModelIds(array $models): array
    {
        $parentModelIds = [];
        foreach ($models as $model) {
            // 收集需要查询的 model_parent_id（重点是model_parent_id存在，且不等于 id）
            $modelParentId = $model->getModelParentId();
            if ($modelParentId > 0 && $modelParentId !== $model->getId()) {
                $parentModelIds[] = $modelParentId;
            }
        }
        return array_unique($parentModelIds);
    }

    /**
     * 构建父模型映射.
     * @return array 父模型ID到父模型实体的映射
     */
    private function buildParentModelMap(array $parentModelIds): array
    {
        if (empty($parentModelIds)) {
            return [];
        }

        $parentModels = $this->serviceProviderModelsRepository->getModelsByIds($parentModelIds);

        $parentModelMap = [];
        foreach ($parentModels as $parentModel) {
            $parentModelMap[$parentModel->getId()] = $parentModel;
        }

        return $parentModelMap;
    }

    /**
     * 合并所有需要查询的配置ID.
     * @param array $modelConfigIds 模型的配置ID
     * @param array $parentModelMap 父模型映射
     * @return array 所有需要查询的配置ID
     */
    private function mergeAllConfigIds(array $modelConfigIds, array $parentModelMap): array
    {
        $allConfigIds = $modelConfigIds;

        // 添加父模型的配置ID
        foreach ($parentModelMap as $parentModel) {
            $allConfigIds[] = $parentModel->getServiceProviderConfigId();
        }

        return array_unique($allConfigIds);
    }

    /**
     * 获取激活的配置映射.
     * @return array 配置ID到配置实体的映射
     */
    private function getActiveConfigMap(array $configIds): array
    {
        if (empty($configIds)) {
            return [];
        }

        $configEntities = $this->serviceProviderConfigRepository->getByIds($configIds);

        $activeConfigMap = [];
        foreach ($configEntities as $config) {
            if ($config->getStatus() === Status::ACTIVE->value) {
                $activeConfigMap[$config->getId()] = $config;
            }
        }

        return $activeConfigMap;
    }

    /**
     * 检查模型是否激活（模型状态和服务商配置都激活）.
     */
    private function isModelActive(ServiceProviderModelsEntity $model, array $configMap): bool
    {
        return $model->getStatus() === Status::ACTIVE->value
            && isset($configMap[$model->getServiceProviderConfigId()]);
    }

    /**
     * 筛选活跃的模型并处理父模型关系（同时过滤父模型的激活状态）.
     * @param ServiceProviderModelsEntity[] $models
     * @return ServiceProviderModelsEntity[]
     */
    private function filterActiveModels(array $models, array $activeConfigMap, array $parentModelMap): array
    {
        $activeModels = [];

        foreach ($models as $model) {
            // 检查当前模型的服务商配置是否激活
            if (! isset($activeConfigMap[$model->getServiceProviderConfigId()])) {
                continue;
            }

            $modelParentId = $model->getModelParentId();

            // 处理有父模型关系的情况
            if ($modelParentId > 0 && $modelParentId !== $model->getId()) {
                // 检查父模型是否存在
                if (! isset($parentModelMap[$modelParentId])) {
                    continue;
                }

                // 检查父模型是否激活（模型状态和服务商配置都激活）
                $parentModel = $parentModelMap[$modelParentId];
                if (! $this->isModelActive($parentModel, $activeConfigMap)) {
                    // 父模型不激活，跳过此模型
                    continue;
                }

                // 还原接入点真实的ProviderConfigId（使用父模型的配置ID）
                $model->setServiceProviderConfigId($parentModel->getServiceProviderConfigId());
            }

            $activeModels[] = $model;
        }

        return $activeModels;
    }

    private function syncUpdateModelsStatusByLLM(int $modelId, Status $status, ?DisabledByType $disabledBy = null)
    {
        $this->serviceProviderModelsRepository->syncUpdateModelsStatusByLLM($modelId, $status, $disabledBy);
    }

    private function syncUpdateModelsStatusByVLM(string $getModelVersion, Status $status, ?DisabledByType $disabledBy = null)
    {
        $this->serviceProviderModelsRepository->syncUpdateModelsStatusByVLM($getModelVersion, $status, $disabledBy);
    }

    private function syncDeleteModelsToOtherServiceProvider(array $modelParentId): void
    {
        $this->serviceProviderModelsRepository->deleteByModelParentIdForOffice($modelParentId);
    }

    /**
     * @param $models ServiceProviderModelsDTO[]
     */
    private function buildServiceProviderConfigDTO(ServiceProviderEntity $serviceProviderEntity, ServiceProviderConfigEntity $serviceProviderConfigEntity, array $models = [], ?string $applicationCode = null): ServiceProviderConfigDTO
    {
        $data = array_merge($serviceProviderConfigEntity->toArray(), $serviceProviderEntity->toArray());
        $serviceProviderConfigDTO = new ServiceProviderConfigDTO($data);

        $models = $this->filterModelsByVisibleOrganizations($models, $serviceProviderConfigEntity->getOrganizationCode());

        // 如果提供了应用编码，则按应用可见性过滤 TODO xhy
        if ($applicationCode !== null) {
            $models = $this->filterModelsByVisibleApplications($models, $applicationCode);
        }

        // 修改过滤逻辑
        $isOfficial = ServiceProviderType::from($serviceProviderEntity->getProviderType()) === ServiceProviderType::OFFICIAL;

        if ($isOfficial) {
            $filteredModels = array_filter($models, function ($model) {
                return $model->getStatus() === Status::ACTIVE->value
                    || ($model->getStatus() === Status::DISABLE->value && $model->getDisabledBy() === DisabledByType::USER->value);
            });
            $serviceProviderConfigDTO->setModels(array_values($filteredModels));
        } else {
            $serviceProviderConfigDTO->setModels($models);
        }

        $serviceProviderConfigDTO->setId($serviceProviderConfigEntity->getId());
        $serviceProviderConfigDTO->setStatus($serviceProviderConfigEntity->getStatus());
        $serviceProviderConfigDTO->setTranslate($serviceProviderConfigEntity->getTranslate());
        return $serviceProviderConfigDTO;
    }

    /**
     * 处理脱敏后的配置数据
     * 如果数据是脱敏格式（前3位+星号+后3位），则使用原始值；否则使用新值
     *
     * @param ServiceProviderConfig $newConfig 新的配置数据（可能包含脱敏信息）
     * @param ServiceProviderConfig $oldConfig 旧的配置数据（包含原始值）
     * @return ServiceProviderConfig 处理后的配置数据
     */
    private function processDesensitizedConfig(
        ServiceProviderConfig $newConfig,
        ServiceProviderConfig $oldConfig
    ): ServiceProviderConfig {
        // 检查ak是否为脱敏后的格式
        $ak = $newConfig->getAk();
        if (! empty($ak) && preg_match('/^.{3}\*+.{3}$/', $ak)) {
            $newConfig->setAk($oldConfig->getAk());
        }

        // 检查sk是否为脱敏后的格式
        $sk = $newConfig->getSk();
        if (! empty($sk) && preg_match('/^.{3}\*+.{3}$/', $sk)) {
            $newConfig->setSk($oldConfig->getSk());
        }

        // 检查apiKey是否为脱敏后的格式
        $apiKey = $newConfig->getApiKey();
        if (! empty($apiKey) && preg_match('/^.{3}\*+.{3}$/', $apiKey)) {
            $newConfig->setApiKey($oldConfig->getApiKey());
        }

        return $newConfig;
    }

    /**
     * 从激活的模型中查找可用的服务商配置
     * 优先返回非官方配置，如果没有则返回官方配置.
     *
     * @param ServiceProviderModelsEntity[] $activeModels 激活的模型列表
     * @param string $organizationCode 组织编码
     */
    private function findAvailableServiceProviderFromModels(array $activeModels, string $organizationCode): ServiceProviderResponse
    {
        $serviceProviderResponse = new ServiceProviderResponse();
        $officialFound = false;
        $officialProviderType = null;
        $officialConfig = null;
        $officialModelConfig = null;
        $officialModel = null;

        foreach ($activeModels as $model) {
            // 获取服务商配置
            $serviceProviderConfigId = $model->getServiceProviderConfigId();
            $serviceProviderConfigEntity = $this->serviceProviderConfigRepository->findByIdAndOrganizationCode(
                (string) $serviceProviderConfigId,
                $organizationCode
            );
            if (! $serviceProviderConfigEntity) {
                continue;
            }

            // 获取服务商信息
            $serviceProviderId = $serviceProviderConfigEntity->getServiceProviderId();
            $serviceProviderEntity = $this->serviceProviderRepository->findById($serviceProviderId);

            if (! $serviceProviderEntity) {
                continue;
            }

            // 获取服务商类型
            $providerType = ServiceProviderType::from($serviceProviderEntity->getProviderType());

            // 对于非官方服务商，检查其是否激活
            if ($providerType !== ServiceProviderType::OFFICIAL) {
                // 如果是非官方服务商但未激活，则跳过
                if ($serviceProviderConfigEntity->getStatus() !== Status::ACTIVE->value) {
                    continue;
                }

                // 非官方配置且已激活，优先返回
                $serviceProviderResponse->setServiceProviderType($providerType);
                $serviceProviderResponse->setServiceProviderConfig($serviceProviderConfigEntity->getConfig());
                $serviceProviderResponse->setModelConfig($model->getConfig());
                $serviceProviderResponse->setServiceProviderModelsEntity($model);
                return $serviceProviderResponse;
            }

            // 如果是官方服务商配置，先保存，如果没有找到非官方的再使用
            if ($providerType === ServiceProviderType::OFFICIAL) {
                $officialFound = true;
                $officialProviderType = $providerType;
                $officialModelConfig = $model->getConfig();
                $officialModel = $model;

                // 文生图模型的特殊处理：获取官方组织下的模型配置
                if (ServiceProviderCategory::from($model->getCategory()) === ServiceProviderCategory::VLM) {
                    $officialConfig = $this->getOfficialVLMProviderConfig($model);
                } else {
                    // 非文生图模型使用当前模型的服务商配置
                    $officialConfig = $serviceProviderConfigEntity->getConfig();
                }
            }
        }

        // 如果找到了官方配置，则返回
        if ($officialFound) {
            $serviceProviderResponse->setServiceProviderType($officialProviderType);
            $serviceProviderResponse->setServiceProviderConfig($officialConfig);
            $serviceProviderResponse->setModelConfig($officialModelConfig);
            $serviceProviderResponse->setServiceProviderModelsEntity($officialModel);
            return $serviceProviderResponse;
        }

        // 如果官方和非官方都没有找到激活的配置，抛出异常
        ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotActive);
    }

    /**
     * 获取官方组织的文生图模型服务商配置.
     *
     * 文生图模型因为目前不能官方组织添加，因此没有 model_parent_id，
     * 找不到对应的 model_id 也就找不到官方服务商的配置，因此要特殊处理
     *
     * @param ServiceProviderModelsEntity $model 当前模型
     * @return ServiceProviderConfig 官方组织的服务商配置
     */
    private function getOfficialVLMProviderConfig(ServiceProviderModelsEntity $model): ServiceProviderConfig
    {
        $officeOrganization = config('service_provider.office_organization');
        $officeModels = $this->serviceProviderModelsRepository->getModelsByVersionAndOrganization(
            $model->getModelVersion(),
            $officeOrganization
        );

        if (empty($officeModels)) {
            return new ServiceProviderConfig();
        }

        // 获取所有模型的服务商配置ID
        $configIds = array_map(function ($model) {
            return $model->getServiceProviderConfigId();
        }, $officeModels);

        // 批量获取服务商配置
        $configEntities = [];
        foreach ($configIds as $configId) {
            $configEntity = $this->serviceProviderConfigRepository->getById($configId);
            if ($configEntity) {
                $configEntities[] = $configEntity;
            }
        }

        $mergedConfig = new ServiceProviderConfig();

        // 合并所有配置
        foreach ($configEntities as $configEntity) {
            $config = $configEntity->getConfig();
            if (! $config) {
                continue;
            }

            // 优先使用非空的配置值
            $sk = $config->getSk();
            if (! empty($sk)) {
                $mergedConfig->setSk($sk);
            }

            $ak = $config->getAk();
            if (! empty($ak)) {
                $mergedConfig->setAk($ak);
            }

            $apiKey = $config->getApiKey();
            if (! empty($apiKey)) {
                $mergedConfig->setApiKey($apiKey);
            }

            $url = $config->getUrl();
            if (! empty($url)) {
                $mergedConfig->setUrl($url);
            }

            $apiVersion = $config->getApiVersion();
            if (! empty($apiVersion)) {
                $mergedConfig->setApiVersion($apiVersion);
            }
            $proxyUrl = $config->getProxyUrl();
            if (! empty($proxyUrl)) {
                $mergedConfig->setProxyUrl($proxyUrl);
            }
        }

        return $mergedConfig;
    }

    /**
     * 批量创建服务商配置.
     * @param ServiceProviderEntity[] $serviceProviders 服务商实体列表
     * @param string $organizationCode 组织代码
     * @return ServiceProviderConfigEntity[] 创建的服务商配置实体列表
     */
    private function batchCreateServiceProviderConfigs(array $serviceProviders, string $organizationCode): array
    {
        // 创建ServiceProviderConfigEntity对象列表
        $configEntities = [];

        foreach ($serviceProviders as $serviceProvider) {
            $configEntity = new ServiceProviderConfigEntity();
            $configEntity->setServiceProviderId($serviceProvider->getId());
            $configEntity->setOrganizationCode($organizationCode);
            $isOfficial = ServiceProviderType::from($serviceProvider->getProviderType()) === ServiceProviderType::OFFICIAL;
            $configEntity->setStatus($isOfficial ? Status::ACTIVE->value : Status::DISABLE->value);
            $configEntities[] = $configEntity;
        }

        if (! empty($configEntities)) {
            return $this->serviceProviderConfigRepository->batchAddServiceProviderConfigs($configEntities);
        }

        return [];
    }

    /**
     * 处理非官方服务商下的模型保存（情况1.2）.
     */
    private function handleNonOfficialProviderModel(ServiceProviderModelsEntity $serviceProviderModelsEntity, ServiceProviderEntity $serviceProviderEntity): void
    {
        // 获取服务提供商配置
        $serviceProviderConfigEntities = $this->serviceProviderConfigRepository->getsByServiceProviderId(
            $serviceProviderEntity->getId()
        );

        if (empty($serviceProviderConfigEntities)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotFound);
        }
        $modelArray = $serviceProviderModelsEntity->toArray();
        $insertNonOfficeData = [];
        // 服务商下面添加该模型
        foreach ($serviceProviderConfigEntities as $serviceProviderConfigEntity) {
            $providerModelsEntity = new ServiceProviderModelsEntity($modelArray);
            $providerModelsEntity->setOrganizationCode($serviceProviderConfigEntity->getOrganizationCode());
            $providerModelsEntity->setServiceProviderConfigId($serviceProviderConfigEntity->getId());
            $providerModelsEntity->setIsOffice(false);
            $insertNonOfficeData[] = $providerModelsEntity;
        }

        // magic 服务商下面也需要添加该模型
        $officeServiceProviderId = $this->serviceProviderRepository->getOfficial(ServiceProviderCategory::VLM)->getId();
        $serviceProviderConfigEntities = $this->serviceProviderConfigRepository->getsByServiceProviderId(
            $officeServiceProviderId
        );
        $insertOfficeData = [];
        foreach ($serviceProviderConfigEntities as $serviceProviderConfigEntity) {
            $providerModelsEntity = new ServiceProviderModelsEntity($modelArray);
            $providerModelsEntity->setOrganizationCode($serviceProviderConfigEntity->getOrganizationCode());
            $providerModelsEntity->setServiceProviderConfigId($serviceProviderConfigEntity->getId());
            $providerModelsEntity->setIsOffice(true);
            $insertOfficeData[] = $providerModelsEntity;
        }
        $insertData = array_merge($insertOfficeData, $insertNonOfficeData);
        $this->serviceProviderModelsRepository->batchInsert($insertData);
    }

    private function syncSaveModelsToOtherServiceProvider(ServiceProviderModelsEntity $serviceProviderModelsEntity): void
    {
        $isAdd = ! $serviceProviderModelsEntity->getId();

        if ($isAdd) {
            $serviceProviderCategory = ServiceProviderCategory::from($serviceProviderModelsEntity->getCategory());
            // 官方组织添加模型
            $this->serviceProviderModelsRepository->saveModels($serviceProviderModelsEntity);
            // 获取官方服务商，并且还要筛选自己，因为自己不需要添加
            $serviceProviderEntity = $this->serviceProviderRepository->getOffice($serviceProviderCategory, ServiceProviderType::OFFICIAL);
            // 获取服务商配置
            $serviceProviderConfigEntities = $this->serviceProviderConfigRepository->getsByServiceProviderId($serviceProviderEntity->getId());

            // 过滤掉官方组织的配置
            $serviceProviderConfigEntities = array_filter($serviceProviderConfigEntities, function ($configEntity) {
                return ! $this->isOfficial($configEntity->getOrganizationCode());
            });

            $modelParentId = $serviceProviderModelsEntity->getId();
            $modelEntities = [];
            // 处理官方模型
            foreach ($serviceProviderConfigEntities as $serviceProviderConfigEntity) {
                $modelEntity = clone $serviceProviderModelsEntity;
                $modelEntity->setServiceProviderConfigId($serviceProviderConfigEntity->getId());
                $modelEntity->setOrganizationCode($serviceProviderConfigEntity->getOrganizationCode());
                $modelEntity->setModelParentId($modelParentId);
                $modelEntity->setIsOffice(true);
                $modelEntities[] = $modelEntity;
            }

            // 如果是文生图，还要额外处理其他服务商
            if ($serviceProviderCategory === ServiceProviderCategory::VLM) {
                $serviceProviderId = $this->serviceProviderConfigRepository->getById($serviceProviderModelsEntity->getServiceProviderConfigId())->getServiceProviderId();
                $serviceProviderConfigEntities = $this->serviceProviderConfigRepository->getsByServiceProviderId($serviceProviderId);
                foreach ($serviceProviderConfigEntities as $serviceProviderConfigEntity) {
                    // 跳过当前模型，避免重复添加
                    if ($serviceProviderConfigEntity->getId() === $serviceProviderModelsEntity->getServiceProviderConfigId()) {
                        continue;
                    }
                    $modelEntity = clone $serviceProviderModelsEntity;
                    $modelEntity->setServiceProviderConfigId($serviceProviderConfigEntity->getId());
                    $modelEntity->setOrganizationCode($serviceProviderConfigEntity->getOrganizationCode());
                    $modelEntity->setModelParentId($modelParentId);
                    $modelEntity->setIsOffice(false);
                    $modelEntity->setStatus(Status::DISABLE->value);
                    $modelEntities[] = $modelEntity;
                }
            }

            $this->serviceProviderModelsRepository->batchSaveModels($modelEntities);
        } else {
            // 修改官方的模型
            $modelArray = $serviceProviderModelsEntity->toArray();
            $this->serviceProviderModelsRepository->updateOfficeModel($serviceProviderModelsEntity->getId(), $modelArray);
            // 修改客户的模型信息
            $updateConsumerModel = new UpdateConsumerModel();
            $updateConsumerModel->setName($serviceProviderModelsEntity->getName());
            $updateConsumerModel->setIcon($serviceProviderModelsEntity->getIcon());
            $updateConsumerModel->setTranslate($serviceProviderModelsEntity->getTranslate());
            $updateConsumerModel->setVisibleOrganizations($serviceProviderModelsEntity->getVisibleOrganizations());
            $updateConsumerModel->setVisibleApplications($serviceProviderModelsEntity->getVisibleApplications());
            $modelParentId = $serviceProviderModelsEntity->getId();
            $this->serviceProviderModelsRepository->updateConsumerModel($modelParentId, $updateConsumerModel);
        }
    }

    private function isOfficial(string $organizationCode): bool
    {
        $officeOrganization = config('service_provider.office_organization');
        return $organizationCode === $officeOrganization;
    }

    /**
     * Initialize models for new organization's Magic service provider
     * Magic service provider's models come from all LLM type service providers in official organization.
     *
     * @param string $organizationCode New organization code
     * @return bool Whether initialization is successful
     */
    private function initMagicServiceProviderModels(string $organizationCode): bool
    {
        // If it's official organization, no need to process
        if ($this->isOfficial($organizationCode)) {
            return true;
        }

        // 1. Get Magic official service provider
        $magicServiceProvider = $this->serviceProviderRepository->getOfficial(ServiceProviderCategory::LLM);
        if (! $magicServiceProvider) {
            return false;
        }

        // 2. Get Magic service provider configuration for new organization
        $newOrgConfigs = $this->serviceProviderConfigRepository->getByServiceProviderIdsAndOrganizationCode(
            [$magicServiceProvider->getId()],
            $organizationCode
        );
        if (empty($newOrgConfigs)) {
            return false;
        }
        $magicConfigId = $newOrgConfigs[0]->getId();

        // 3. Get all LLM type service provider configurations in official organization (exclude Magic itself)
        $officeOrganization = config('service_provider.office_organization');
        $officeLLMProviders = $this->serviceProviderRepository->getAllByCategory(1, 1000, ServiceProviderCategory::LLM);

        $officeLLMProviderIds = [];
        foreach ($officeLLMProviders as $provider) {
            if ($provider->getProviderCode() === ServiceProviderCode::Magic->value) {
                continue;
            }
            // Exclude Magic itself, only collect other LLM service providers
            if ($provider->getId() !== $magicServiceProvider->getId()) {
                $officeLLMProviderIds[] = $provider->getId();
            }
        }

        if (empty($officeLLMProviderIds)) {
            return true;
        }

        // 4. Get configurations of these LLM service providers in official organization
        $officeConfigs = $this->serviceProviderConfigRepository->getByServiceProviderIdsAndOrganizationCode(
            $officeLLMProviderIds,
            $officeOrganization
        );

        if (empty($officeConfigs)) {
            return true;
        }

        $officeConfigMap = [];
        $officeConfigIds = [];
        foreach ($officeConfigs as $config) {
            $id = $config->getId();
            $officeConfigIds[] = $id;
            $officeConfigMap[$id] = $config->getStatus();
        }

        // 5. Get all models under these configurations
        $allModels = $this->serviceProviderModelsRepository->getModelsByConfigIds($officeConfigIds);

        if (empty($allModels)) {
            return true;
        }

        // 6. Create model copies for new organization's Magic service provider
        $modelsToSave = [];
        foreach ($allModels as $baseModel) {
            $newModel = clone $baseModel;
            $newModel->setId(null);
            $newModel->setServiceProviderConfigId($magicConfigId);
            $newModel->setOrganizationCode($organizationCode);
            $newModel->setIsOffice(true); // Mark as official model
            $newModel->setModelParentId($baseModel->getId());

            // Model is enabled only when both service provider and model are active; otherwise disabled
            $bothActive = ($baseModel->getStatus() === Status::ACTIVE->value)
                          && ($officeConfigMap[$baseModel->getServiceProviderConfigId()] === Status::ACTIVE->value);

            $newModel->setStatus($bothActive ? Status::ACTIVE->value : Status::DISABLE->value);
            $modelsToSave[] = $newModel;
        }

        // 7. Batch save models
        $this->serviceProviderModelsRepository->batchSaveModels($modelsToSave);
        $this->logger->info(sprintf('Initialized %d models for organization %s Magic service provider', count($modelsToSave), $organizationCode));

        return true;
    }
}
