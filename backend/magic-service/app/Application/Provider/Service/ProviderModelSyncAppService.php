<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Service;

use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderCode;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Service\AdminProviderDomainService;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Interfaces\Provider\DTO\SaveProviderModelDTO;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

/**
 * 服务商模型同步应用服务.
 * 负责处理模型同步到Official服务商的业务逻辑.
 * 通过DomainService调用Repository，遵循DDD架构规范.
 */
class ProviderModelSyncAppService
{
    private LoggerInterface $logger;

    public function __construct(
        private readonly ProviderConfigDomainService $providerConfigDomainService,
        private readonly ProviderModelDomainService $providerModelDomainService,
        private readonly AdminProviderDomainService $adminProviderDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get('ProviderModelSync');
    }

    /**
     * 处理服务商配置创建事件.
     * 如果是Official服务商，同步所有非Official服务商的模型.
     */
    public function handleProviderConfigCreated(
        ProviderConfigEntity $providerConfigEntity,
        string $organizationCode
    ): void {
        // 获取服务商信息
        $dataIsolation = ProviderDataIsolation::create($organizationCode);
        $provider = $this->providerConfigDomainService->getProviderById($dataIsolation, $providerConfigEntity->getServiceProviderId());

        if (! $provider || $provider->getProviderCode() !== ProviderCode::Official) {
            $this->logger->debug('不是Official服务商，跳过同步', [
                'config_id' => $providerConfigEntity->getId(),
                'provider_code' => $provider?->getProviderCode()->value,
            ]);
            return;
        }

        $this->logger->info('Official服务商创建，开始同步所有模型', [
            'config_id' => $providerConfigEntity->getId(),
            'organization_code' => $organizationCode,
        ]);

        $this->syncAllModelsToOfficial($dataIsolation, $providerConfigEntity);
    }

    /**
     * 处理服务商配置更新事件.
     * 如果是Official服务商，重新同步所有非Official服务商的模型.
     */
    public function handleProviderConfigUpdated(
        ProviderConfigEntity $providerConfigEntity,
        string $organizationCode
    ): void {
        // 获取服务商信息
        $dataIsolation = ProviderDataIsolation::create($organizationCode);
        $provider = $this->providerConfigDomainService->getProviderById($dataIsolation, $providerConfigEntity->getServiceProviderId());

        if (! $provider || $provider->getProviderCode() !== ProviderCode::Official) {
            $this->logger->debug('不是Official服务商，跳过同步', [
                'config_id' => $providerConfigEntity->getId(),
                'provider_code' => $provider?->getProviderCode()->value,
            ]);
            return;
        }

        $this->logger->info('Official服务商更新，重新同步所有模型', [
            'config_id' => $providerConfigEntity->getId(),
            'organization_code' => $organizationCode,
        ]);

        $this->syncAllModelsToOfficial($dataIsolation, $providerConfigEntity);
    }

    /**
     * 处理模型创建事件.
     * 如果模型属于非Official服务商，则同步到Official服务商.
     */
    public function handleProviderModelCreated(
        ProviderModelEntity $providerModelEntity,
        string $organizationCode
    ): void {
        // 检查是否为非Official服务商的模型
        if (! $this->isNonOfficialProviderModel($providerModelEntity, $organizationCode)) {
            return;
        }

        $dataIsolation = ProviderDataIsolation::create($organizationCode);

        // 获取Official服务商配置
        $officialConfig = $this->getOfficialProviderConfig($dataIsolation);
        if (! $officialConfig) {
            $this->logger->debug('未找到Official服务商配置，跳过同步', [
                'organization_code' => $organizationCode,
            ]);
            return;
        }

        // 创建同步模型
        $this->createSyncedModel($dataIsolation, $providerModelEntity, $officialConfig);

        $this->logger->info('模型已同步到Official服务商', [
            'source_model_id' => $providerModelEntity->getId(),
            'official_config_id' => $officialConfig->getId(),
        ]);
    }

    /**
     * 处理模型更新事件.
     * 如果模型属于非Official服务商，则更新Official服务商的对应模型.
     */
    public function handleProviderModelUpdated(
        ProviderModelEntity $providerModelEntity,
        string $organizationCode
    ): void {
        // 检查是否为非Official服务商的模型
        if (! $this->isNonOfficialProviderModel($providerModelEntity, $organizationCode)) {
            return;
        }

        $dataIsolation = ProviderDataIsolation::create($organizationCode);

        // 获取Official服务商配置
        $officialConfig = $this->getOfficialProviderConfig($dataIsolation);
        if (! $officialConfig) {
            return;
        }

        // 查找已同步的模型
        $syncedModel = $this->providerModelDomainService->getByConfigIdAndSourceModelId(
            $dataIsolation,
            (string) $officialConfig->getId(),
            $providerModelEntity->getId()
        );

        if (! empty($syncedModel)) {
            $this->updateSyncedModel($dataIsolation, $syncedModel, $providerModelEntity, $officialConfig);

            $this->logger->info('已更新Official服务商的同步模型', [
                'source_model_id' => $providerModelEntity->getId(),
                'synced_model_id' => $syncedModel->getId(),
            ]);
        } else {
            // 如果不存在，创建新的同步模型
            $this->createSyncedModel($dataIsolation, $providerModelEntity, $officialConfig);

            $this->logger->info('模型不存在，已创建新的同步模型', [
                'source_model_id' => $providerModelEntity->getId(),
                'official_config_id' => $officialConfig->getId(),
            ]);
        }
    }

    /**
     * 处理模型删除事件.
     * 如果模型属于非Official服务商，则删除Official服务商的对应模型.
     */
    public function handleProviderModelDeleted(
        string $modelId,
        int $serviceProviderConfigId,
        string $organizationCode
    ): void {
        // 检查配置是否为非Official服务商
        $providerConfig = $this->providerConfigDomainService->getByIdWithoutOrganizationFilter($serviceProviderConfigId);
        if (! $providerConfig) {
            return;
        }

        $dataIsolation = ProviderDataIsolation::create($organizationCode);
        $provider = $this->providerConfigDomainService->getProviderById($dataIsolation, $providerConfig->getServiceProviderId());
        if (! $provider || $provider->getProviderCode() === ProviderCode::Official) {
            return;
        }

        // 获取Official服务商配置
        $officialConfig = $this->getOfficialProviderConfig($dataIsolation);
        if (! $officialConfig) {
            return;
        }

        // 查找并删除已同步的模型
        $syncedModel = $this->providerModelDomainService->getByConfigIdAndSourceModelId(
            $dataIsolation,
            (string) $officialConfig->getId(),
            (int) $modelId
        );

        if (! empty($syncedModel)) {
            $this->providerModelDomainService->deleteById($dataIsolation, (string) $syncedModel->getId());

            $this->logger->info('已删除Official服务商的同步模型', [
                'source_model_id' => $modelId,
                'synced_model_id' => $syncedModel->getId(),
            ]);
        }
    }

    /**
     * 同步所有非Official服务商的模型到Official服务商.
     * 使用批量查询优化性能.
     */
    private function syncAllModelsToOfficial(
        ProviderDataIsolation $dataIsolation,
        ProviderConfigEntity $officialConfigEntity
    ): void {
        $officialConfigId = (string) $officialConfigEntity->getId();

        // 1. 获取所有配置
        $allConfigs = $this->providerConfigDomainService->getAllByOrganization($dataIsolation);

        if (empty($allConfigs)) {
            $this->logger->info('没有其他服务商配置，清空Official的所有同步模型');
            $this->providerModelDomainService->deleteByConfigIdExceptSourceModelIds(
                $dataIsolation,
                $officialConfigId,
                []
            );
            return;
        }

        // 2. 批量获取所有服务商实体
        $configIds = array_map(fn ($config) => $config->getId(), $allConfigs);
        $providerMap = $this->providerConfigDomainService->getProviderEntitiesByConfigIds($dataIsolation, $configIds);

        // 3. 筛选非Official的配置ID
        $nonOfficialConfigIds = [];
        foreach ($allConfigs as $config) {
            $configId = $config->getId();
            if (isset($providerMap[$configId])) {
                $provider = $providerMap[$configId];
                if ($provider->getProviderCode() !== ProviderCode::Official) {
                    $nonOfficialConfigIds[] = (string) $configId;
                }
            }
        }

        if (empty($nonOfficialConfigIds)) {
            $this->logger->info('没有非Official服务商配置，清空Official的所有同步模型');
            $this->providerModelDomainService->deleteByConfigIdExceptSourceModelIds(
                $dataIsolation,
                $officialConfigId,
                []
            );
            return;
        }

        // 通过DomainService查询这些配置下的所有启用模型
        $sourceModels = $this->providerModelDomainService->getByProviderConfigIds(
            $dataIsolation,
            $nonOfficialConfigIds
        );

        // 通过DomainService获取Official配置下已存在的同步模型
        $existingSyncedModels = $this->providerModelDomainService->getSyncedModelsByConfigId(
            $dataIsolation,
            $officialConfigId
        );

        // 准备源模型ID集合
        $sourceModelIds = [];

        // 遍历源模型，进行新增或更新
        foreach ($sourceModels as $sourceModel) {
            $sourceModelId = $sourceModel->getId();
            $sourceModelIds[] = $sourceModelId;

            if (isset($existingSyncedModels[$sourceModelId])) {
                // 存在，执行更新
                $existingModel = $existingSyncedModels[$sourceModelId];
                $this->updateSyncedModel($dataIsolation, $existingModel, $sourceModel, $officialConfigEntity);
            } else {
                // 不存在，执行新增
                $this->createSyncedModel($dataIsolation, $sourceModel, $officialConfigEntity);
            }
        }

        // 通过DomainService删除不再存在的模型
        $this->providerModelDomainService->deleteByConfigIdExceptSourceModelIds(
            $dataIsolation,
            $officialConfigId,
            $sourceModelIds
        );

        $this->logger->info('完成所有模型同步', [
            'total_models' => count($sourceModels),
            'source_model_ids' => $sourceModelIds,
        ]);
    }

    /**
     * 创建同步模型 - 使用SaveProviderModelDTO和DomainService的saveModel方法.
     */
    private function createSyncedModel(
        ProviderDataIsolation $dataIsolation,
        ProviderModelEntity $sourceModel,
        ProviderConfigEntity $officialConfig
    ): void {
        // 转换为SaveProviderModelDTO
        $saveDTO = new SaveProviderModelDTO($sourceModel->toArray());

        // 重置ID（创建新模型）
        $saveDTO->setId(null);

        // 设置Official配置ID
        $saveDTO->setServiceProviderConfigId((int) $officialConfig->getId());

        // 设置源模型ID
        $saveDTO->setSourceModelId($sourceModel->getId());

        // 通过DomainService保存
        $this->providerModelDomainService->saveModel($dataIsolation, $saveDTO);
    }

    /**
     * 更新同步模型 - 使用SaveProviderModelDTO和DomainService的saveModel方法.
     */
    private function updateSyncedModel(
        ProviderDataIsolation $dataIsolation,
        ProviderModelEntity $existingModel,
        ProviderModelEntity $sourceModel,
        ProviderConfigEntity $officialConfig
    ): void {
        // 转换为SaveProviderModelDTO
        $saveDTO = new SaveProviderModelDTO($sourceModel->toArray());

        // 保持原有ID（更新模型）
        $saveDTO->setId($existingModel->getId());

        // 设置Official配置ID
        $saveDTO->setServiceProviderConfigId((int) $officialConfig->getId());

        // 设置源模型ID
        $saveDTO->setSourceModelId($sourceModel->getId());

        // 通过DomainService保存
        $this->providerModelDomainService->saveModel($dataIsolation, $saveDTO);
    }

    /**
     * 检查模型是否属于非Official服务商.
     */
    private function isNonOfficialProviderModel(
        ProviderModelEntity $providerModelEntity,
        string $organizationCode
    ): bool {
        $dataIsolation = ProviderDataIsolation::create($organizationCode);

        $providerConfig = $this->providerConfigDomainService->getByIdWithoutOrganizationFilter(
            $providerModelEntity->getServiceProviderConfigId()
        );

        if (! $providerConfig) {
            $this->logger->debug('未找到服务商配置', [
                'config_id' => $providerModelEntity->getServiceProviderConfigId(),
            ]);
            return false;
        }

        $provider = $this->providerConfigDomainService->getProviderById($dataIsolation, $providerConfig->getServiceProviderId());
        if (! $provider) {
            return false;
        }

        if ($provider->getProviderCode() === ProviderCode::Official) {
            $this->logger->debug('模型属于Official服务商，跳过同步', [
                'model_id' => $providerModelEntity->getId(),
            ]);
            return false;
        }

        return true;
    }

    /**
     * 获取Official服务商配置.
     * 使用批量查询优化，避免N+1查询问题.
     */
    private function getOfficialProviderConfig(
        ProviderDataIsolation $dataIsolation
    ): ?ProviderConfigEntity {
        // 1. 获取组织下所有配置
        $allConfigs = $this->providerConfigDomainService->getAllByOrganization($dataIsolation);

        if (empty($allConfigs)) {
            $this->logger->debug('组织下没有任何服务商配置', [
                'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
            ]);
            return null;
        }

        // 2. 提取所有配置ID
        $configIds = array_map(fn ($config) => $config->getId(), $allConfigs);

        // 3. 批量获取服务商实体（配置ID -> 服务商实体的映射）
        $providerMap = $this->providerConfigDomainService->getProviderEntitiesByConfigIds($dataIsolation, $configIds);

        // 4. 在内存中查找Official服务商的配置
        foreach ($allConfigs as $config) {
            $configId = $config->getId();
            if (isset($providerMap[$configId])) {
                $provider = $providerMap[$configId];
                if ($provider->getProviderCode() === ProviderCode::Official) {
                    return $config;
                }
            }
        }

        $this->logger->debug('未找到Official服务商配置', [
            'organization_code' => $dataIsolation->getCurrentOrganizationCode(),
        ]);

        return null;
    }
}
