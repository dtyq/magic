<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Service;

use App\Domain\Provider\DTO\Item\ProviderConfigItem;
use App\Domain\Provider\DTO\ProviderConfigDTO;
use App\Domain\Provider\DTO\ProviderConfigModelsDTO;
use App\Domain\Provider\Entity\ProviderConfigEntity;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\ProviderType;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderModelQuery;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Repository\Persistence\ProviderConfigRepository;
use App\Domain\Provider\Repository\Persistence\ProviderModelRepository;
use App\Domain\Provider\Repository\Persistence\ProviderOriginalModelRepository;
use App\Domain\Provider\Repository\Persistence\ProviderRepository;
use App\Domain\Provider\Service\ConnectivityTest\ConnectResponse;
use App\Domain\Provider\Service\ConnectivityTest\ServiceProviderFactory;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Locker\RedisLocker;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Provider\Assembler\ProviderAssembler;
use Exception;
use Hyperf\Contract\TranslatorInterface;
use Psr\Log\LoggerInterface;
use Throwable;

class AdminProviderDomainService extends AbstractProviderDomainService
{
    public function __construct(
        protected ProviderRepository $serviceProviderRepository,
        protected ProviderModelRepository $providerModelRepository,
        protected ProviderConfigRepository $providerConfigRepository,
        protected ProviderOriginalModelRepository $serviceProviderOriginalModelsRepository,
        protected TranslatorInterface $translator,
        protected LoggerInterface $logger,
        protected RedisLocker $redisLocker,
    ) {
    }

    /**
     * 获取服务商配置信息.
     */
    public function getServiceProviderConfigDetail(string $serviceProviderConfigId, string $organizationCode, bool $decryptConfig = false): ProviderConfigDTO
    {
        // 1. 获取服务商配置实体
        $providerConfigEntity = $this->providerConfigRepository->getProviderConfigEntityById($serviceProviderConfigId, $organizationCode);

        if ($providerConfigEntity === null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotFound);
        }

        // 2. 获取服务商信息
        $providerEntity = $this->serviceProviderRepository->getById($providerConfigEntity->getServiceProviderId());

        if ($providerEntity === null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotFound);
        }

        // 3. 组装 ProviderConfigDTO
        $configData = $providerConfigEntity->toArray();
        $providerData = $providerEntity->toArray();
        // 合并配置和服务商数据
        $mergedData = array_merge($configData, [
            'name' => $providerData['name'],
            'description' => $providerData['description'],
            'icon' => $providerData['icon'],
            'provider_type' => $providerData['provider_type'],
            'category' => $providerData['category'],
            'provider_code' => $providerData['provider_code'],
        ]);

        // 4. 处理配置解密
        $mergedData['config'] = null;
        $mergedData['decryptedConfig'] = null;

        if (! empty($configData['config'])) {
            if ($decryptConfig) {
                // 当需要解密时，设置已解密的配置（不脱敏)
                // 需要 new 两次ProviderConfigItem对象，因为 setConfig 方法会操作原始对象进行脱敏
                $mergedData['decryptedConfig'] = new ProviderConfigItem($configData['config']);
            }
            // config 字段的 set 方法会脱敏
            $mergedData['config'] = new ProviderConfigItem($configData['config']);
        }

        // 5. 处理翻译字段
        $configTranslate = $providerConfigEntity->getTranslate() ?: [];
        $providerTranslate = $providerEntity->getTranslate() ?: [];
        $mergedData['translate'] = array_merge($configTranslate, $providerTranslate);
        return new ProviderConfigDTO($mergedData);
    }

    /**
     * 根据组织和服务商类型获取服务商配置列表.
     * @param string $organizationCode 组织编码
     * @param Category $category 服务商类型
     * @return ProviderConfigDTO[]
     */
    public function getOrganizationProvidersModelsByCategory(string $organizationCode, Category $category): array
    {
        return $this->providerConfigRepository->getOrganizationProviders($organizationCode, $category);
    }

    /**
     * vlm 的连通性测试. llm/嵌入的在 app 层。
     * @throws Exception
     */
    public function vlmConnectivityTest(string $serviceProviderConfigId, string $modelVersion, string $organizationCode): ConnectResponse
    {
        // vml 需要解密配置
        $serviceProviderConfigDTO = $this->getServiceProviderConfigDetail($serviceProviderConfigId, $organizationCode, true);
        $serviceProviderConfig = $serviceProviderConfigDTO->getDecryptedConfig();
        if (! $serviceProviderConfig) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderConfigError);
        }

        $serviceProviderCode = $serviceProviderConfigDTO->getProviderCode();
        if (! $serviceProviderCode) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotFound);
        }
        $provider = ServiceProviderFactory::get($serviceProviderCode, $serviceProviderConfigDTO->getCategory());
        return $provider->connectivityTestByModel($serviceProviderConfig, $modelVersion);
    }

    /**
     * 获取服务商配置（综合方法）
     * 根据模型版本、模型ID和组织编码获取服务商配置.
     *
     * @param string $modelVersion 模型版本
     * @param string $modelId 模型ID
     * @param string $organizationCode 组织编码
     * @return ?ProviderConfigEntity 服务商配置响应
     * @throws Exception
     */
    public function getServiceProviderConfig(
        string $modelVersion,
        string $modelId,
        string $organizationCode,
        bool $throw = true,
    ): ?ProviderConfigEntity {
        // 1. 如果提供了 modelId，走新的逻辑
        if (! empty($modelId)) {
            return $this->getServiceProviderConfigByModelId($modelId, $organizationCode, $throw);
        }

        // 2. 如果只有 modelVersion，先尝试查找对应的模型
        if (! empty($modelVersion)) {
            $models = $this->getModelsByVersionAndOrganization($modelVersion, $organizationCode);
            if (! empty($models)) {
                // 如果找到模型，不直接返回官方服务商配置，而是进行进一步判断
                $this->logger->info('找到对应模型，判断服务商配置', [
                    'modelVersion' => $modelVersion,
                    'organizationCode' => $organizationCode,
                ]);

                // 从激活的模型中查找可用的服务商配置
                return $this->findAvailableServiceProviderFromModels($models);
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
    public function getServiceProviderConfigByModelId(string $modelId, string $organizationCode, bool $throwModelNotExist = true): ?ProviderConfigEntity
    {
        // 1. 获取模型信息
        $dataIsolation = ProviderDataIsolation::create($organizationCode);
        try {
            $serviceProviderModelEntity = $this->providerModelRepository->getById($dataIsolation, $modelId);
        } catch (Throwable) {
            if ($throwModelNotExist) {
                ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
            }
            return null;
        }

        // 2. 检查模型状态
        if ($serviceProviderModelEntity->getStatus() === Status::Disabled) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotActive);
        }

        if ($serviceProviderModelEntity->getIsOffice()) {
            // 获取父级的模型服务商 id
            $serviceProviderConfigId = $this->getModelById((string) $serviceProviderModelEntity->getModelParentId())->getServiceProviderConfigId();
        } else {
            $serviceProviderConfigId = $serviceProviderModelEntity->getServiceProviderConfigId();
        }

        // 3. 获取服务商配置
        $serviceProviderConfigEntity = $this->providerConfigRepository->getById($dataIsolation, $serviceProviderConfigId);
        if ($serviceProviderConfigEntity === null) {
            return null;
        }
        // 4. 获取服务商信息
        $serviceProviderId = $serviceProviderConfigEntity->getServiceProviderId();
        $serviceProviderEntity = $this->serviceProviderRepository->getById($serviceProviderId);
        if ($serviceProviderEntity === null) {
            return null;
        }
        // 5. 判断服务商类型和状态
        $serviceProviderType = $serviceProviderEntity->getProviderType();
        if (
            $serviceProviderType !== ProviderType::Official
            && $serviceProviderConfigEntity->getStatus() === Status::Disabled
        ) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotActive);
        }

        return $serviceProviderConfigEntity;
    }

    public function getModelById(string $id): ProviderModelEntity
    {
        $dataIsolation = ProviderDataIsolation::create();
        return $this->providerModelRepository->getById($dataIsolation, $id);
    }

    /**
     * 返回模型和服务商都被激活了的接入点列表.
     * 要判断 model_parent_id 的模型和服务商是否激活.
     * @return ProviderModelEntity[]
     */
    public function getOrganizationActiveModelsByIdOrType(string $key, string $orgCode): array
    {
        // 创建数据隔离对象并获取可用模型
        $dataIsolation = ProviderDataIsolation::create($orgCode);
        $allModels = $this->providerModelRepository->getModelsForOrganization($dataIsolation);

        // 根据key进行过滤
        $models = [];
        foreach ($allModels as $model) {
            // 过滤禁用
            if ($model->getStatus() === Status::Disabled) {
                continue;
            }
            if (is_numeric($key)) {
                // 按ID过滤
                if ((string) $model->getId() === $key) {
                    $models[] = $model;
                }
            } elseif ($model->getModelId() === $key) {
                $models[] = $model;
            } elseif ($model->getModelVersion() === $key) {
                $models[] = $model;
            }
        }
        if (empty($models)) {
            return [];
        }
        return $models;
    }

    /**
     * 获取超清修复服务商配置。
     * 从ImageGenerateModelType::getMiracleVisionModes()[0]获取模型。
     * 如果官方和非官方都启用，优先使用非官方配置。
     *
     * @param string $modelId 模型版本
     * @param string $organizationCode 组织编码
     * @return ProviderConfigEntity 服务商配置响应
     */
    public function getMiracleVisionServiceProviderConfig(string $modelId, string $organizationCode): ProviderConfigEntity
    {
        // 创建数据隔离对象
        $dataIsolation = ProviderDataIsolation::create($organizationCode);

        // 获取所有分类的可用模型
        $allModels = $this->providerModelRepository->getModelsForOrganization($dataIsolation);

        // 按model_id过滤
        $models = [];
        foreach ($allModels as $model) {
            if ($model->getModelId() === $modelId) {
                $models[] = $model;
            }
        }

        if (empty($models)) {
            $this->logger->warning('美图模型未找到' . $modelId);
            // 如果没有找到模型，抛出异常
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotFound);
        }

        // 收集所有激活的模型
        $activeModels = [];
        foreach ($models as $model) {
            if ($model->getStatus() === Status::Enabled) {
                $activeModels[] = $model;
            }
        }

        // 如果没有激活的模型，抛出异常
        if (empty($activeModels)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ModelNotActive);
        }

        // 从激活的模型中查找可用的服务商配置
        return $this->findAvailableServiceProviderFromModels($activeModels);
    }

    /**
     * 获取所有非官方服务商列表，不依赖于组织编码
     *
     * @param Category $category 服务商类别
     * @return ProviderConfigModelsDTO[]
     */
    public function getAllNonOfficialProviders(Category $category): array
    {
        $serviceProviderEntities = $this->serviceProviderRepository->getNonOfficialByCategory($category);
        return ProviderAssembler::toDTOs($serviceProviderEntities);
    }

    /**
     * @return ProviderModelEntity[]
     */
    public function getOfficeModels(Category $category): array
    {
        $officeOrganizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();
        $providerDataIsolation = ProviderDataIsolation::create($officeOrganizationCode);
        return $this->providerModelRepository->getModelsForOrganization($providerDataIsolation, $category);
    }

    /**
     * 获取官方的激活模型配置（支持返回多个）.
     * @param string $modelVersion 模型
     * @return ProviderConfigItem[] 服务商配置数组
     */
    public function getOfficeAndActiveModel(string $modelVersion, Category $category): array
    {
        $serviceProviderEntities = $this->serviceProviderRepository->getByCategory($category);
        $serviceProviderConfigEntities = $this->providerConfigRepository->getsByServiceProviderIdsAndOffice(array_column($serviceProviderEntities, 'id'));

        $filteredModels = $this->getModelsByVersionAndOrganization($modelVersion, OfficialOrganizationUtil::getOfficialOrganizationCode());

        if (empty($filteredModels)) {
            // 如果没有找到匹配的激活模型，返回空数组
            return [];
        }

        // 创建配置ID到配置实体的映射，便于快速查找
        $configMap = [];
        foreach ($serviceProviderConfigEntities as $configEntity) {
            $configMap[$configEntity->getId()] = $configEntity;
        }

        // 收集所有匹配的服务商配置
        $result = [];
        foreach ($filteredModels as $activeModel) {
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
     * Get super magic display models and Magic provider models visible to current organization.
     * @param string $organizationCode Organization code
     * @return ProviderModelEntity[]
     */
    public function getSuperMagicDisplayModelsForOrganization(string $organizationCode): array
    {
        $dataIsolation = ProviderDataIsolation::create($organizationCode);

        // 获取所有分类的可用模型
        $allModels = $this->providerModelRepository->getModelsForOrganization($dataIsolation);

        // 按super_magic_display_state过滤
        $models = [];
        foreach ($allModels as $model) {
            if ($model->isSuperMagicDisplayState() === 1) {
                $models[] = $model;
            }
        }

        $superMagicModels = [];
        foreach ($models as $model) {
            $modelConfig = $model->getConfig();
            if (! $modelConfig || ! $modelConfig->isSupportFunction()) {
                continue;
            }
            $superMagicModels[] = $model;
        }

        // 根据 modelId 去重
        $uniqueModels = [];
        foreach ($superMagicModels as $model) {
            $uniqueModels[$model->getModelId()] = $model;
        }

        // 根据 sort 排序，大到小
        usort($uniqueModels, static function ($a, $b) {
            return $b->getSort() <=> $a->getSort();
        });

        return $uniqueModels;
    }

    public function queriesModels(ProviderDataIsolation $dataIsolation, ProviderModelQuery $providerModelQuery): array
    {
        $providerModelEntities = $this->providerModelRepository->getModelsForOrganization($dataIsolation, $providerModelQuery->getCategory(), $providerModelQuery->getStatus());

        // modelId 经过过滤，去重选一个
        if ($providerModelQuery->isModelIdFilter()) {
            $uniqueModels = [];
            foreach ($providerModelEntities as $model) {
                $modelId = $model->getModelId();
                // 如果这个 modelId 还没有被添加，则添加
                if (! isset($uniqueModels[$modelId])) {
                    $uniqueModels[$modelId] = $model;
                }
            }
            $providerModelEntities = array_values($uniqueModels);
        }

        return $providerModelEntities;
    }

    /**
     * 从激活的模型中查找可用的服务商配置
     * 优先返回非官方配置，如果没有则返回官方配置.
     *
     * @param ProviderModelEntity[] $activeModels 激活的模型列表
     */
    private function findAvailableServiceProviderFromModels(array $activeModels): ProviderConfigEntity
    {
        if (empty($activeModels)) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotActive);
        }

        // 1. 收集所有需要查询的 serviceProviderConfigId
        $configIds = [];
        foreach ($activeModels as $model) {
            $configIds[] = $model->getServiceProviderConfigId();
        }
        $configIds = array_unique($configIds);

        // 2. 批量查询所有配置
        $configMap = $this->providerConfigRepository->getByIdsWithoutOrganizationFilter($configIds);

        // 3. 收集所有需要查询的 serviceProviderId
        $providerIds = [];
        foreach ($configMap as $config) {
            $providerIds[] = $config->getServiceProviderId();
        }
        $providerIds = array_unique($providerIds);

        // 4. 批量查询所有服务商
        $providerMap = $this->serviceProviderRepository->getByIds($providerIds);

        // 5. 重建优先级处理逻辑
        $officialConfig = null;

        foreach ($activeModels as $model) {
            $configId = $model->getServiceProviderConfigId();

            // 检查配置是否存在
            if (! isset($configMap[$configId])) {
                continue;
            }
            $serviceProviderConfigEntity = $configMap[$configId];

            // 检查服务商是否存在
            $serviceProviderId = $serviceProviderConfigEntity->getServiceProviderId();
            if (! isset($providerMap[$serviceProviderId])) {
                continue;
            }
            $serviceProviderEntity = $providerMap[$serviceProviderId];

            // 获取服务商类型
            $providerType = $serviceProviderEntity->getProviderType();

            // 对于非官方服务商，检查其是否激活
            if ($providerType !== ProviderType::Official) {
                // 如果是非官方服务商但未激活，则跳过
                if ($serviceProviderConfigEntity->getStatus() !== Status::Enabled) {
                    continue;
                }
                // 找到激活的非官方配置，立即返回（优先级最高）
                return $serviceProviderConfigEntity;
            }

            // 如果是官方服务商配置，先保存，如果没有找到非官方的再使用
            if ($officialConfig === null) {
                $officialConfig = $serviceProviderConfigEntity;
            }
        }

        // 如果找到了官方配置，则返回
        if ($officialConfig !== null) {
            return $officialConfig;
        }

        // 如果官方和非官方都没有找到激活的配置，抛出异常
        ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotActive);
    }

    /**
     * 根据模型版本和组织获取模型列表.
     * @param string $modelVersion 模型版本
     * @param string $organizationCode 组织代码
     * @return ProviderModelEntity[] 过滤后的模型列表
     */
    private function getModelsByVersionAndOrganization(string $modelVersion, string $organizationCode): array
    {
        // 创建数据隔离对象
        $dataIsolation = ProviderDataIsolation::create($organizationCode);

        // 获取所有分类的可用模型
        $allModels = $this->providerModelRepository->getModelsForOrganization($dataIsolation);

        // 按model_version过滤
        $filteredModels = [];
        foreach ($allModels as $model) {
            if ($model->getModelVersion() === $modelVersion) {
                $filteredModels[] = $model;
            }
        }

        return $filteredModels;
    }
}
