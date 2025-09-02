<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\Service;

use App\Application\ModelGateway\Mapper\ModelFilter;
use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelGateway\Entity\Dto\CompletionDTO;
use App\Domain\ModelGateway\Entity\Dto\EmbeddingsDTO;
use App\Domain\Provider\DTO\ProviderConfigDTO;
use App\Domain\Provider\DTO\ProviderConfigModelsDTO;
use App\Domain\Provider\DTO\ProviderModelDetailDTO;
use App\Domain\Provider\Entity\ProviderEntity;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\NaturalLanguageProcessing;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderModelQuery;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Service\AdminProviderDomainService;
use App\Domain\Provider\Service\ConnectivityTest\ConnectResponse;
use App\Domain\Provider\Service\ProviderConfigDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Agent\Assembler\FileAssembler;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Provider\Assembler\ProviderAdminAssembler;
use App\Interfaces\Provider\DTO\CreateProviderConfigRequest;
use App\Interfaces\Provider\DTO\SaveProviderModelDTO;
use App\Interfaces\Provider\DTO\UpdateProviderConfigRequest;
use Exception;
use Hyperf\DbConnection\Db;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use Psr\Log\LoggerInterface;

readonly class AdminProviderAppService
{
    public function __construct(
        private ProviderConfigDomainService $providerConfigDomainService,
        private FileDomainService $fileDomainService,
        private ProviderModelDomainService $providerModelDomainService,
        private AdminProviderDomainService $adminProviderDomainService,
        private LoggerInterface $logger,
    ) {
    }

    /**
     * 根据服务商配置ID获取服务商详细信息.
     */
    public function getProviderModelsByConfigId(
        MagicUserAuthorization $authorization,
        string $configId
    ): ?ProviderConfigModelsDTO {
        // 构建数据隔离对象
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );

        // 通过领域层方法一次性获取服务商、配置和模型信息
        $providerModels = $this->providerConfigDomainService->getProviderModelsByConfigId($dataIsolation, $configId);
        if ($providerModels === null) {
            return null;
        }

        // ProviderModelsDTO 已经包含所有需要的数据，统一处理 provider 和 models 的 icon 并返回
        $this->processProviderAndModelsIcons($providerModels);
        return $providerModels;
    }

    public function updateProvider(
        MagicUserAuthorization $authorization,
        UpdateProviderConfigRequest $updateProviderConfigRequest
    ): ProviderConfigModelsDTO {
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );
        $providerConfigEntity = ProviderAdminAssembler::updateRequestToEntity($updateProviderConfigRequest, $authorization->getOrganizationCode());

        $providerConfigEntity = $this->providerConfigDomainService->updateProviderConfig($dataIsolation, $providerConfigEntity);
        return ProviderAdminAssembler::entityToModelsDTO($providerConfigEntity);
    }

    public function createProvider(
        MagicUserAuthorization $authorization,
        CreateProviderConfigRequest $createProviderConfigRequest
    ): ProviderConfigModelsDTO {
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );
        $providerConfigEntity = ProviderAdminAssembler::createRequestToEntity($createProviderConfigRequest, $authorization->getOrganizationCode());

        $providerConfigEntity = $this->providerConfigDomainService->createProviderConfig($dataIsolation, $providerConfigEntity);

        $providerEntity = $this->providerConfigDomainService->getProviderById($dataIsolation, $providerConfigEntity->getServiceProviderId());
        if ($providerEntity === null) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::ServiceProviderNotFound);
        }
        $providerModelsDTO = ProviderAdminAssembler::entityToModelsDTO($providerConfigEntity);

        $this->fillProviderInfoAndIcon($providerEntity, $providerModelsDTO);
        return $providerModelsDTO;
    }

    // 删除服务商

    /**
     * @throws Exception
     */
    public function deleteProvider(
        MagicUserAuthorization $authorization,
        string $id,
    ): void {
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );

        // 事务
        Db::beginTransaction();

        try {
            if ($this->isOfficialOrganization($authorization->getOrganizationCode())) {
                $providerModelEntities = $this->providerModelDomainService->getByProviderConfigId($dataIsolation, $id);
                $modelParentIds = array_column($providerModelEntities, 'id');
                $cloneDataIsolation = clone $dataIsolation;
                $cloneDataIsolation->disabled();
                $this->providerModelDomainService->deleteByModelParentIds($cloneDataIsolation, $modelParentIds);
            }

            $this->providerConfigDomainService->delete($dataIsolation, $id);
            $this->providerModelDomainService->deleteByProviderId($dataIsolation, $id);
            Db::commit();
        } catch (Exception $e) {
            Db::rollBack();
            throw $e;
        }
    }

    // 删除模型

    /**
     * @throws Exception
     */
    public function deleteModel(
        MagicUserAuthorization $authorization,
        string $id,
    ): void {
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );

        Db::beginTransaction();
        try {
            if ($this->isOfficialOrganization($authorization->getOrganizationCode())) {
                $cloneDataIsolation = clone $dataIsolation;
                $cloneDataIsolation->disabled();
                $this->providerModelDomainService->deleteByModelParentId($cloneDataIsolation, $id);
            }
            $this->providerModelDomainService->deleteById($dataIsolation, $id);
            Db::commit();
        } catch (Exception $e) {
            $this->logger->error('删除模型失败', ['error' => $e->getMessage()]);
            Db::rollBack();
            throw $e;
        }
    }

    /**
     * 修改模型状态.
     */
    public function updateModelStatus(
        MagicUserAuthorization $authorization,
        string $id,
        int $status,
    ): void {
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );

        $statusEnum = Status::from($status);
        $this->providerModelDomainService->updateStatus($dataIsolation, $id, $statusEnum);
    }

    // 保存模型
    public function saveModel(MagicUserAuthorization $authorization, SaveProviderModelDTO $saveProviderModelDTO): array
    {
        $dataIsolation = ProviderDataIsolation::create($authorization->getOrganizationCode(), $authorization->getId());
        $saveProviderModelDTO = $this->providerModelDomainService->saveModel($dataIsolation, $saveProviderModelDTO);

        $saveProviderModelData = $saveProviderModelDTO->toArray();
        // icon传入是 url，返回也需要是 url，但是保存在数据库是 file_key
        // 所以 SaveProviderModelDTO 的 setIcon 做了 url 到 file_key的转换
        $saveProviderModelData['icon'] = $this->getFileUrl($saveProviderModelDTO->getIcon());
        return $saveProviderModelData;
    }

    /**
     * 根据组织编码和服务商分类获取活跃的服务商配置.
     * @param string $organizationCode 组织编码
     * @param Category $category 服务商分类
     * @return ProviderConfigDTO[]
     */
    public function getOrganizationProvidersModelsByCategory(string $organizationCode, Category $category): array
    {
        // 调用领域层时传递 modelTypes 参数，让仓储层完成查询和过滤
        $serviceProviderModelsDTOs = $this->adminProviderDomainService->getOrganizationProvidersModelsByCategory($organizationCode, $category);

        // 处理图标
        $this->processProviderConfigIcons($serviceProviderModelsDTOs);

        return array_values($serviceProviderModelsDTOs);
    }

    /**
     * @throws Exception
     */
    public function connectivityTest(string $serviceProviderConfigId, string $modelVersion, string $modelPrimaryId, MagicUserAuthorization $authorization): ConnectResponse
    {
        // 构建数据隔离对象
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );

        // 通过领域层方法获取完整的模型详情信息
        $providerModelEntity = $this->providerModelDomainService->getById(
            $dataIsolation,
            $modelPrimaryId
        );
        // 根据服务商类型和模型类型进行连通性测试
        return match ($this->getConnectivityTestType($providerModelEntity->getCategory()->value, $providerModelEntity->getModelType()->value)) {
            NaturalLanguageProcessing::EMBEDDING => $this->embeddingConnectivityTest($modelPrimaryId, $authorization),
            NaturalLanguageProcessing::LLM => $this->llmConnectivityTest($modelPrimaryId, $authorization),
            default => $this->adminProviderDomainService->vlmConnectivityTest($serviceProviderConfigId, $modelVersion, $authorization->getOrganizationCode()),
        };
    }

    /**
     * 获取所有非官方服务商列表，不依赖于组织.
     *
     * @param Category $category 服务商分类
     * @param string $organizationCode 组织编码
     * @return ProviderConfigModelsDTO[] 非官方服务商列表
     */
    public function getAllNonOfficialProviders(Category $category, string $organizationCode): array
    {
        // 获取所有非官方服务商
        $serviceProviders = $this->adminProviderDomainService->getAllNonOfficialProviders($category);

        if (empty($serviceProviders)) {
            return [];
        }

        // 处理图标
        $this->processServiceProviderEntityListIcons($serviceProviders, $organizationCode);

        return $serviceProviders;
    }

    /**
     * Get super magic display models and Magic provider models visible to current organization.
     * @param string $organizationCode Organization code
     * @return ProviderModelDetailDTO[]
     */
    public function getSuperMagicDisplayModelsForOrganization(string $organizationCode): array
    {
        $models = $this->adminProviderDomainService->getSuperMagicDisplayModelsForOrganization($organizationCode);

        if (empty($models)) {
            return [];
        }

        // 收集所有图标路径按组织编码分组
        $iconsByOrg = [];
        $iconToModelMap = [];

        foreach ($models as $model) {
            $icon = $model->getIcon();
            if (! empty($icon)) {
                $iconOrganizationCode = substr($icon, 0, strpos($icon, '/'));

                if (! isset($iconsByOrg[$iconOrganizationCode])) {
                    $iconsByOrg[$iconOrganizationCode] = [];
                }
                $iconsByOrg[$iconOrganizationCode][] = $icon;

                if (! isset($iconToModelMap[$icon])) {
                    $iconToModelMap[$icon] = [];
                }
                $iconToModelMap[$icon][] = $model;
            }
        }

        // 批量获取图标URL
        $iconUrlMap = [];
        foreach ($iconsByOrg as $iconOrganizationCode => $icons) {
            $links = $this->fileDomainService->getLinks($iconOrganizationCode, array_unique($icons));
            $iconUrlMap[] = $links;
        }
        ! empty($iconUrlMap) && $iconUrlMap = array_merge(...$iconUrlMap);
        // 创建DTO并设置图标URL
        $modelDTOs = [];
        foreach ($models as $model) {
            $modelDTO = new ProviderModelDetailDTO($model->toArray());

            $icon = $model->getIcon();
            if (! empty($icon) && isset($iconUrlMap[$icon])) {
                $fileLink = $iconUrlMap[$icon];
                if ($fileLink) {
                    $modelDTO->setIcon($fileLink->getUrl());
                }
            }

            $modelDTOs[] = $modelDTO;
        }

        return $modelDTOs;
    }

    /**
     * 获取官方组织下的所有可用模型.
     * @return ProviderModelDetailDTO[]
     */
    public function queriesModels(MagicUserAuthorization $authorization, ProviderModelQuery $providerModelQuery): array
    {
        $dataIsolation = ProviderDataIsolation::create(
            $authorization->getOrganizationCode(),
            $authorization->getId(),
        );
        $queriesModels = $this->adminProviderDomainService->queriesModels($dataIsolation, $providerModelQuery);
        $providerConfigModelsDTOs = [];
        foreach ($queriesModels as $model) {
            $providerConfigModelsDTOs[] = new ProviderModelDetailDTO($model->toArray());
        }
        $this->processModelIcons($providerConfigModelsDTOs);
        return $providerConfigModelsDTOs;
    }

    /**
     * @param $providerModelDetailDTOs ProviderModelDetailDTO[]
     */
    private function processModelIcons(array $providerModelDetailDTOs): void
    {
        if (empty($providerModelDetailDTOs)) {
            return;
        }

        // 收集所有图标路径按组织编码分组
        $iconsByOrg = [];
        $iconToModelMap = [];

        foreach ($providerModelDetailDTOs as $model) {
            $icon = $model->getIcon();
            if (empty($icon)) {
                continue;
            }

            $icon = FileAssembler::formatPath($icon);
            $organizationCode = substr($icon, 0, strpos($icon, '/'));

            if (! isset($iconsByOrg[$organizationCode])) {
                $iconsByOrg[$organizationCode] = [];
            }
            $iconsByOrg[$organizationCode][] = $icon;

            if (! isset($iconToModelMap[$icon])) {
                $iconToModelMap[$icon] = [];
            }
            $iconToModelMap[$icon][] = $model;
        }

        // 批量获取图标URL
        $iconUrlMap = [];
        foreach ($iconsByOrg as $organizationCode => $icons) {
            $links = $this->fileDomainService->getLinks($organizationCode, array_unique($icons));
            $iconUrlMap = array_merge($iconUrlMap, $links);
        }

        // 设置图标URL
        foreach ($iconUrlMap as $icon => $fileLink) {
            if (isset($iconToModelMap[$icon])) {
                $url = $fileLink ? $fileLink->getUrl() : '';
                foreach ($iconToModelMap[$icon] as $model) {
                    $model->setIcon($url);
                }
            }
        }
    }

    /**
     * 填充 provider 信息并处理 icon.
     */
    private function fillProviderInfoAndIcon(
        ProviderEntity $provider,
        ProviderConfigModelsDTO $providerModelsDTO
    ): void {
        // 填充 provider 基本信息
        $providerModelsDTO->setName($provider->getName());
        $providerModelsDTO->setDescription($provider->getDescription());
        $providerModelsDTO->setServiceProviderId((string) $provider->getId());
        $providerModelsDTO->setCategory($provider->getCategory()->value);
        $providerModelsDTO->setProviderCode($provider->getProviderCode());
        $providerModelsDTO->setProviderType($provider->getProviderType());
        $providerModelsDTO->setIcon($this->getFileUrl($provider->getIcon()));
    }

    private function getFileUrl(string $icon): string
    {
        if (empty($icon)) {
            return '';
        }
        $icon = FileAssembler::formatPath($icon);

        $organizationCode = substr($icon, 0, strpos($icon, '/'));
        $fileLink = $this->fileDomainService->getLink($organizationCode, $icon);
        return $fileLink !== null ? $fileLink->getUrl() : '';
    }

    /**
     * 统一处理 Provider 和 Models 的图标，转换为完整URL.
     */
    private function processProviderAndModelsIcons(ProviderConfigModelsDTO $providerDTO): void
    {
        // 收集所有图标路径和对应的组织编码
        $iconsByOrg = [];
        $providerIconMap = [];  // provider图标映射
        $modelIconMap = [];     // 模型图标映射

        // 处理 provider 图标
        $providerIcon = $providerDTO->getIcon();
        if (! empty($providerIcon)) {
            $providerIcon = FileAssembler::formatPath($providerIcon);
            $organizationCode = substr($providerIcon, 0, strpos($providerIcon, '/'));
            /* @phpstan-ignore-next-line */
            if (! isset($iconsByOrg[$organizationCode])) {
                $iconsByOrg[$organizationCode] = [];
            }
            $iconsByOrg[$organizationCode][] = $providerIcon;
            $providerIconMap[$providerIcon] = $providerDTO;
        }

        // 处理模型图标
        $modelEntities = $providerDTO->getModels();
        if (! empty($modelEntities)) {
            foreach ($modelEntities as $modelEntity) {
                $icon = $modelEntity->getIcon();
                if (empty($icon)) {
                    continue;
                }

                $icon = FileAssembler::formatPath($icon);
                $organizationCode = substr($icon, 0, strpos($icon, '/'));

                if (! isset($iconsByOrg[$organizationCode])) {
                    $iconsByOrg[$organizationCode] = [];
                }
                $iconsByOrg[$organizationCode][] = $icon;

                // 记录图标到模型的映射关系
                if (! isset($modelIconMap[$icon])) {
                    $modelIconMap[$icon] = [];
                }
                $modelIconMap[$icon][] = $modelEntity;
            }
        }

        // 按组织编码批量获取图标URL
        foreach ($iconsByOrg as $organizationCode => $icons) {
            $iconUrlMap = $this->fileDomainService->getLinks($organizationCode, array_unique($icons));

            // 设置图标URL
            foreach ($iconUrlMap as $icon => $fileLink) {
                $url = $fileLink ? $fileLink->getUrl() : '';

                // 设置 provider 图标URL
                if (isset($providerIconMap[$icon])) {
                    $providerIconMap[$icon]->setIcon($url);
                }

                // 设置模型图标URL
                if (isset($modelIconMap[$icon])) {
                    foreach ($modelIconMap[$icon] as $modelEntity) {
                        $modelEntity->setIcon($url);
                    }
                }
            }
        }
    }

    // 是否是官方组织
    private function isOfficialOrganization(string $organizationCode): bool
    {
        $officialOrganization = config('service_provider.office_organization');
        return $organizationCode === $officialOrganization;
    }

    /**
     * 获取联通测试类型.
     */
    private function getConnectivityTestType(string $category, int $modelType): NaturalLanguageProcessing
    {
        if (Category::from($category) === Category::LLM) {
            return $modelType === ModelType::EMBEDDING->value ? NaturalLanguageProcessing::EMBEDDING : NaturalLanguageProcessing::LLM;
        }
        return NaturalLanguageProcessing::DEFAULT;
    }

    private function embeddingConnectivityTest(string $modelPrimaryId, MagicUserAuthorization $authorization): ConnectResponse
    {
        $connectResponse = new ConnectResponse();
        $llmAppService = di(LLMAppService::class);
        $proxyModelRequest = new EmbeddingsDTO();
        if (defined('MAGIC_ACCESS_TOKEN')) {
            $proxyModelRequest->setAccessToken(MAGIC_ACCESS_TOKEN);
        }
        $proxyModelRequest->setModel($modelPrimaryId);
        $proxyModelRequest->setInput('test');
        $proxyModelRequest->setEnableHighAvailability(false); // 连通性测试时不启用高可用
        $proxyModelRequest->setBusinessParams([
            'organization_id' => $authorization->getOrganizationCode(),
            'user_id' => $authorization->getId(),
            'source_id' => 'connectivity_test',
        ]);
        try {
            $modelFilter = new ModelFilter(
                checkModelEnabled: false,
                checkProviderEnabled: false,
                checkVisibleOrganization: false,
                checkVisibleApplication: false,
                checkVisiblePackage: false
            );
            $llmAppService->embeddings($proxyModelRequest, $modelFilter);
        } catch (Exception $exception) {
            $connectResponse->setStatus(false);
            $connectResponse->setMessage($exception->getMessage());
            return $connectResponse;
        }
        $connectResponse->setStatus(true);
        return $connectResponse;
    }

    private function llmConnectivityTest(string $modelPrimaryId, MagicUserAuthorization $authorization): ConnectResponse
    {
        $connectResponse = new ConnectResponse();
        $llmAppService = di(LLMAppService::class);
        $completionDTO = new CompletionDTO();
        if (defined('MAGIC_ACCESS_TOKEN')) {
            $completionDTO->setAccessToken(MAGIC_ACCESS_TOKEN);
        }
        $completionDTO->setMessages([['role' => 'user', 'content' => '你好']]);
        $completionDTO->setModel($modelPrimaryId);
        $completionDTO->setEnableHighAvailability(false); // 连通性测试时不启用高可用
        $completionDTO->setBusinessParams([
            'organization_id' => $authorization->getOrganizationCode(),
            'user_id' => $authorization->getId(),
            'source_id' => 'connectivity_test',
        ]);
        /* @var ChatCompletionResponse $response */
        try {
            $modelFilter = new ModelFilter(
                checkModelEnabled: false,
                checkProviderEnabled: false,
                checkVisibleOrganization: false,
                checkVisibleApplication: false,
                checkVisiblePackage: false
            );
            $llmAppService->chatCompletion($completionDTO, $modelFilter);
        } catch (Exception $exception) {
            $connectResponse->setStatus(false);
            $connectResponse->setMessage($exception->getMessage());
            return $connectResponse;
        }
        $connectResponse->setStatus(true);
        return $connectResponse;
    }

    /**
     * 处理服务提供商实体列表的图标.
     *
     * @param ProviderConfigModelsDTO[] $serviceProviders 服务提供商实体列表
     * @param string $organizationCode 组织编码
     */
    private function processServiceProviderEntityListIcons(array $serviceProviders, string $organizationCode): void
    {
        // 收集所有图标
        $icons = [];
        foreach ($serviceProviders as $serviceProvider) {
            $icons[] = $serviceProvider->getIcon();
        }

        // 批量获取所有图标的链接
        $iconUrlMap = $this->fileDomainService->getLinks($organizationCode, array_unique($icons));

        // 只处理图标URL，直接返回实体对象
        foreach ($serviceProviders as $serviceProvider) {
            $icon = $serviceProvider->getIcon();

            // 如果有URL映射，使用映射的URL
            if (isset($iconUrlMap[$icon])) {
                $serviceProvider->setIcon($iconUrlMap[$icon]->getUrl());
            }
        }
    }

    /**
     * 处理服务商配置图标.
     *
     * @param ProviderConfigDTO[] $providerConfigs 服务商配置DTO列表
     */
    private function processProviderConfigIcons(array $providerConfigs): void
    {
        if (empty($providerConfigs)) {
            return;
        }

        $iconMappings = [];

        // 收集服务商图标
        foreach ($providerConfigs as $configDTO) {
            $this->collectProviderIcon($configDTO, $iconMappings);
        }

        // 批量处理图标URL
        $this->batchProcessIcons($iconMappings);
    }

    /**
     * 收集服务商图标信息.
     */
    private function collectProviderIcon(ProviderConfigDTO|ProviderConfigModelsDTO $provider, array &$iconMappings): void
    {
        $providerIcon = $provider->getIcon();
        if (empty($providerIcon)) {
            return;
        }

        $organizationCode = substr($providerIcon, 0, strpos($providerIcon, '/'));

        if (! isset($iconMappings[$organizationCode])) {
            $iconMappings[$organizationCode] = [
                'icons' => [],
                'providerMap' => [],
                'modelMap' => [],
            ];
        }

        $iconMappings[$organizationCode]['icons'][] = $providerIcon;

        if (! isset($iconMappings[$organizationCode]['providerMap'][$providerIcon])) {
            $iconMappings[$organizationCode]['providerMap'][$providerIcon] = [];
        }
        $iconMappings[$organizationCode]['providerMap'][$providerIcon][] = $provider;
    }

    /**
     * 批量处理图标URL.
     */
    private function batchProcessIcons(array $iconMappings): void
    {
        foreach ($iconMappings as $organizationCode => $mapping) {
            /** @var string $organizationCode */
            /** @var array{icons: string[], providerMap: array<string, array>, modelMap: array<string, array>} $mapping */
            $iconUrlMap = $this->fileDomainService->getLinks($organizationCode, array_unique($mapping['icons']));

            foreach ($iconUrlMap as $icon => $fileLink) {
                /** @var string $icon */
                $url = $fileLink ? $fileLink->getUrl() : '';

                // 设置服务商图标URL
                $providerMap = $mapping['providerMap'];
                if (isset($providerMap[$icon])) {
                    $providers = $providerMap[$icon];
                    /** @var ProviderConfigDTO|ProviderConfigModelsDTO $provider */
                    foreach ($providers as $provider) {
                        $provider->setIcon($url);
                    }
                }

                // 设置模型图标URL
                $modelMap = $mapping['modelMap'];
                if (isset($modelMap[$icon])) {
                    $models = $modelMap[$icon];
                    /** @var ProviderModelDetailDTO $model */
                    foreach ($models as $model) {
                        $model->setIcon($url);
                    }
                }
            }
        }
    }
}
