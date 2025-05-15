<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelAdmin\Service;

use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\File\Service\FileDomainService;
use App\Domain\ModelAdmin\Constant\ModelType;
use App\Domain\ModelAdmin\Constant\ServiceProviderCategory;
use App\Domain\ModelAdmin\Constant\ServiceProviderCode;
use App\Domain\ModelAdmin\Constant\ServiceProviderType;
use App\Domain\ModelAdmin\Constant\Status;
use App\Domain\ModelAdmin\Entity\ServiceProviderConfigEntity;
use App\Domain\ModelAdmin\Entity\ServiceProviderEntity;
use App\Domain\ModelAdmin\Entity\ServiceProviderModelsEntity;
use App\Domain\ModelAdmin\Entity\ServiceProviderOriginalModelsEntity;
use App\Domain\ModelAdmin\Entity\ValueObject\ServiceProviderConfigDTO;
use App\Domain\ModelAdmin\Entity\ValueObject\ServiceProviderDTO;
use App\Domain\ModelAdmin\Entity\ValueObject\ServiceProviderModelsDTO;
use App\Domain\ModelAdmin\Service\Provider\ConnectResponse;
use App\Domain\ModelAdmin\Service\ServiceProviderDomainService;
use App\Domain\ModelGateway\Entity\Dto\CompletionDTO;
use App\Domain\ModelGateway\Entity\Dto\EmbeddingsDTO;
use App\Domain\OrganizationEnvironment\Service\MagicOrganizationEnvDomainService;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Locker\Excpetion\LockException;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Exception;
use Hyperf\Odin\Api\Response\ChatCompletionResponse;
use App\Domain\ModelAdmin\Constant\NaturalLanguageProcessing;

class ServiceProviderAppService
{
    public function __construct(
        protected ServiceProviderDomainService $serviceProviderDomainService,
        protected MagicOrganizationEnvDomainService $organizationEnvDomainService,
        protected readonly FileDomainService $fileDomainService,
    ) {
    }

    /**
     * 根据组织获取服务商.
     * @return ServiceProviderConfigDTO[]
     * @throws LockException
     */
    public function getServiceProviders(MagicUserAuthorization $authenticatable, ?ServiceProviderCategory $serviceProviderCategory): array
    {
        $organizationCode = $authenticatable->getOrganizationCode();

        // 获取服务商配置
        $serviceProviderConfigDTOS = $this->serviceProviderDomainService->getServiceProviderConfigs($organizationCode, $serviceProviderCategory);
        // 如果获取的服务商列表为空，则初始化该类别的服务商
        if (empty($serviceProviderConfigDTOS)) {
            $serviceProviderConfigDTOS = $this->serviceProviderDomainService->initOrganizationServiceProviders($organizationCode, $serviceProviderCategory);
        }

        // 处理图标
        $this->processServiceProviderConfigIcons($serviceProviderConfigDTOS, $organizationCode);

        $officeOrganization = config('service_provider.office_organization');
        if ($authenticatable->getOrganizationCode() === $officeOrganization) {
            $serviceProviderConfigDTOS = array_filter($serviceProviderConfigDTOS, function ($serviceProviderConfigDTO) {
                return ServiceProviderCode::from($serviceProviderConfigDTO->getProviderCode()) !== ServiceProviderCode::Official;
            });
            $serviceProviderConfigDTOS = array_values($serviceProviderConfigDTOS);
        }
        return $serviceProviderConfigDTOS;
    }

    /**
     * 根据组织编码和服务商分类获取活跃的服务商及其模型.
     * @param string $organizationCode 组织编码
     * @param null|ServiceProviderCategory $category 服务商分类
     * @param null|array $modelTypes 模型类型数组
     * @return ServiceProviderConfigDTO[]
     */
    public function getActiveModelsByOrganizationCode(string $organizationCode, ?ServiceProviderCategory $category = null, ?array $modelTypes = null): array
    {
        $serviceProviderConfigDTOs = $this->serviceProviderDomainService->getActiveModelsByOrganizationCode($organizationCode, $category);

        // 如果提供了modelTypes数组，则使用它进行过滤
        if (! empty($modelTypes)) {
            $serviceProviderConfigDTOs = $this->filterServiceProvidersByModelTypes($serviceProviderConfigDTOs, $modelTypes);
        }

        // 处理图标
        $this->processServiceProviderConfigIcons($serviceProviderConfigDTOs, $organizationCode);

        return array_values($serviceProviderConfigDTOs);
    }

    // 获取服务商详细信息
    public function getServiceProviderConfig(string $serviceProviderConfigId, string $organizationCode): ServiceProviderConfigDTO
    {
        $serviceProviderConfigDTO = $this->serviceProviderDomainService->getServiceProviderConfigDetail($serviceProviderConfigId, $organizationCode);

        // 处理图标
        $this->processServiceProviderConfigIcons([$serviceProviderConfigDTO], $organizationCode);

        // 对敏感信息进行脱敏处理
        $this->maskSensitiveConfigInfo($serviceProviderConfigDTO);

        return $serviceProviderConfigDTO;
    }

    // 添加服务商
    public function addServiceProvider(ServiceProviderEntity $serviceProviderEntity): ServiceProviderEntity
    {
        $organizationCodes = $this->organizationEnvDomainService->getAllOrganizationCodes();
        return $this->serviceProviderDomainService->addServiceProvider($serviceProviderEntity, $organizationCodes);
    }

    // 保存模型
    public function saveModelToServiceProvider(ServiceProviderModelsEntity $serviceProviderModelsEntity): ServiceProviderModelsDTO
    {
        $serviceProviderModelsEntity = $this->serviceProviderDomainService->saveModelsToServiceProvider($serviceProviderModelsEntity);
        $serviceProviderModelsDTO = new ServiceProviderModelsDTO($serviceProviderModelsEntity->toArray());

        // 处理图标
        $this->processModelIcon($serviceProviderModelsDTO, $serviceProviderModelsEntity->getOrganizationCode());

        return $serviceProviderModelsDTO;
    }

    public function updateModelStatus(string $modelId, int $status, string $organizationCode): void
    {
        $this->serviceProviderDomainService->updateModelStatus($modelId, Status::from($status), $organizationCode);
    }

    public function updateServiceProviderConfig(ServiceProviderConfigEntity $serviceProviderConfigEntity): ServiceProviderConfigEntity
    {
        return $this->serviceProviderDomainService->updateServiceProviderConfig($serviceProviderConfigEntity);
    }

    /**
     * @throws Exception
     */
    public function connectivityTest(string $serviceProviderConfigId, string $modelVersion, string $modelId, MagicUserAuthorization $authorization): ConnectResponse
    {
        $model = $this->serviceProviderDomainService->getModelById($modelId);
        $serviceProviderConfigDTO = $this->serviceProviderDomainService->getServiceProviderConfigDetail($serviceProviderConfigId, $authorization->getOrganizationCode());

        // 根据服务商类型和模型类型进行连通性测试
        return match ($this->getConnectivityTestType($serviceProviderConfigDTO->getCategory(), $model->getModelType())) {
            NaturalLanguageProcessing::EMBEDDING => $this->embeddingConnectivityTest($modelId, $authorization),
            NaturalLanguageProcessing::LLM => $this->llmConnectivityTest($modelId, $authorization),
            default => $this->serviceProviderDomainService->connectivityTest($serviceProviderConfigId, $modelVersion, $authorization->getOrganizationCode()),
        };
    }

    /**
     * @throws Exception
     */
    public function deleteModel(string $modelId, string $organizationCode): void
    {
        // 查询模型不是 llm 则报错
        $modelEntity = $this->serviceProviderDomainService->getModelByIdAndOrganizationCode($modelId, $organizationCode);

        if (ServiceProviderCategory::from($modelEntity->getCategory()) !== ServiceProviderCategory::LLM) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter);
        }

        // 如果服务商是官方的也不能删除
        $serviceProviderConfigDTO = $this->serviceProviderDomainService->getServiceProviderConfigDetail((string) $modelEntity->getServiceProviderConfigId(), $organizationCode);
        if (ServiceProviderType::from($serviceProviderConfigDTO->getProviderType()) === ServiceProviderType::OFFICIAL) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidParameter);
        }

        $this->serviceProviderDomainService->deleteModel($modelId, $organizationCode);
    }

    /**
     * 获取原始模型列表.
     * @return ServiceProviderOriginalModelsEntity[]
     */
    public function listOriginalModels(MagicUserAuthorization $authorization): array
    {
        return $this->serviceProviderDomainService->listOriginalModels($authorization->getOrganizationCode());
    }

    public function addOriginalModel(string $modelId): void
    {
        $this->serviceProviderDomainService->addOriginalModel($modelId);
    }

    public function addServiceProviderForOrganization(ServiceProviderConfigDTO $serviceProviderConfigDTO, MagicUserAuthorization $authorization): ServiceProviderConfigDTO
    {
        return $this->serviceProviderDomainService->addServiceProviderForOrganization($serviceProviderConfigDTO, $authorization->getOrganizationCode());
    }

    public function deleteServiceProviderForOrganization(string $serviceProviderConfigId, MagicUserAuthorization $authorization): void
    {
        $this->serviceProviderDomainService->deleteServiceProviderForOrganization($serviceProviderConfigId, $authorization->getOrganizationCode());
    }

    public function addModelIdForOrganization(string $modelId, MagicUserAuthorization $authorization): void
    {
        $this->serviceProviderDomainService->addModelIdForOrganization($modelId, $authorization->getOrganizationCode());
    }

    public function deleteModelIdForOrganization(string $modelId, MagicUserAuthorization $authorization): void
    {
        $this->serviceProviderDomainService->deleteModelIdForOrganization($modelId, $authorization->getOrganizationCode());
    }

    /**
     * 获取所有非官方服务商列表，不依赖于组织.
     *
     * @param ServiceProviderCategory $category 服务商分类
     * @param string $organizationCode 组织编码
     * @return ServiceProviderDTO[] 非官方服务商列表
     */
    public function getAllNonOfficialProviders(ServiceProviderCategory $category, string $organizationCode): array
    {
        // 获取所有非官方服务商
        $serviceProviders = $this->serviceProviderDomainService->getAllNonOfficialProviders($category);

        if (empty($serviceProviders)) {
            return [];
        }

        // 处理图标
        $this->processServiceProviderEntityListIcons($serviceProviders, $organizationCode);

        return $serviceProviders;
    }

    /**
     * 对服务商配置中的敏感信息进行脱敏处理.
     */
    public function maskSensitiveConfigInfo(ServiceProviderConfigDTO $serviceProviderConfigDTO): void
    {
        $config = $serviceProviderConfigDTO->getConfig();
        // 对敏感字段进行脱敏
        $config->setAk($this->serviceProviderDomainService->maskString($config->getAk()));
        $config->setSk($this->serviceProviderDomainService->maskString($config->getSk()));
        $config->setApiKey($this->serviceProviderDomainService->maskString($config->getApiKey()));
    }

    /**
     * 获取联通测试类型.
     */
    private function getConnectivityTestType(string $category, int $modelType): string
    {
        if (ServiceProviderCategory::from($category) === ServiceProviderCategory::LLM) {
            return $modelType === ModelType::EMBEDDING->value ? NaturalLanguageProcessing::EMBEDDING : NaturalLanguageProcessing::LLM;
        }
        return NaturalLanguageProcessing::DEFAULT;
    }

    private function embeddingConnectivityTest(string $modelId, MagicUserAuthorization $authorization): ConnectResponse
    {
        $connectResponse = new ConnectResponse();
        $llmAppService = di(LLMAppService::class);
        $proxyModelRequest = new EmbeddingsDTO();
        if (defined('MAGIC_ACCESS_TOKEN')) {
            $proxyModelRequest->setAccessToken(MAGIC_ACCESS_TOKEN);
        }
        $proxyModelRequest->setModel($modelId);
        $proxyModelRequest->setInput('test');
        $proxyModelRequest->setBusinessParams([
            'organization_id' => $authorization->getOrganizationCode(),
            'user_id' => $authorization->getId(),
            'source_id' => 'connectivity_test',
        ]);
        try {
            $llmAppService->embeddings($proxyModelRequest);
        } catch (Exception $exception) {
            $connectResponse->setStatus(false);
            $connectResponse->setMessage($exception->getMessage());
            return $connectResponse;
        }
        $connectResponse->setStatus(true);
        return $connectResponse;
    }

    private function llmConnectivityTest(string $modelId, MagicUserAuthorization $authorization): ConnectResponse
    {
        $connectResponse = new ConnectResponse();
        $llmAppService = di(LLMAppService::class);
        $completionDTO = new CompletionDTO();
        if (defined('MAGIC_ACCESS_TOKEN')) {
            $completionDTO->setAccessToken(MAGIC_ACCESS_TOKEN);
        }
        $completionDTO->setMessages([['role' => 'user', 'content' => '你好']]);
        $completionDTO->setModel($modelId);
        $completionDTO->setBusinessParams([
            'organization_id' => $authorization->getOrganizationCode(),
            'user_id' => $authorization->getId(),
            'source_id' => 'connectivity_test',
        ]);
        /* @var ChatCompletionResponse $response */
        try {
            $llmAppService->chatCompletion($completionDTO);
        } catch (Exception $exception) {
            $connectResponse->setStatus(false);
            $connectResponse->setMessage($exception->getMessage());
            return $connectResponse;
        }
        $connectResponse->setStatus(true);
        return $connectResponse;
    }

    /**
     * 根据多个模型类型过滤服务提供商.
     *
     * @param array $serviceProviderConfigDTOs 服务提供商配置DTO数组
     * @param array $modelTypes 模型类型数组
     * @return array 过滤后的服务提供商配置DTO数组
     */
    private function filterServiceProvidersByModelTypes(array $serviceProviderConfigDTOs, array $modelTypes): array
    {
        // 将字符串数组转换为ModelType枚举数组
        $modelTypeEnums = [];
        foreach ($modelTypes as $type) {
            $modelType = (int) $type;
            if ($enum = ModelType::tryFrom($modelType)) {
                $modelTypeEnums[] = $enum;
            }
        }

        if (empty($modelTypeEnums)) {
            return $serviceProviderConfigDTOs;
        }

        foreach ($serviceProviderConfigDTOs as $serviceProviderConfigDTO) {
            $filteredModels = [];
            foreach ($serviceProviderConfigDTO->getModels() as $modelDTO) {
                $currentModelType = ModelType::from($modelDTO->getModelType());
                foreach ($modelTypeEnums as $typeEnum) {
                    if ($currentModelType === $typeEnum) {
                        $filteredModels[] = $modelDTO;
                        break;
                    }
                }
            }
            $serviceProviderConfigDTO->setModels($filteredModels);
        }

        // 过滤掉没有符合条件模型的服务提供商
        return array_filter($serviceProviderConfigDTOs, function ($dto) {
            return ! empty($dto->getModels());
        });
    }

    /**
     * 处理服务提供商配置DTO数组的图标，将图标路径转换为可访问的URL.
     *
     * @param ServiceProviderConfigDTO[] $serviceProviderConfigs 服务提供商配置DTO数组
     * @param string $organizationCode 组织编码
     */
    private function processServiceProviderConfigIcons(array $serviceProviderConfigs, string $organizationCode): void
    {
        if (empty($serviceProviderConfigs)) {
            return;
        }

        // 收集所有需要处理的图标
        $providerIcons = [];
        $modelIcons = [];
        foreach ($serviceProviderConfigs as $configDTO) {
            $providerIcons[] = $configDTO->getIcon();

            // 检查是否有模型属性
            if (method_exists($configDTO, 'getModels') && is_array($configDTO->getModels())) {
                $modelDTOs = $configDTO->getModels();
                foreach ($modelDTOs as $modelDTO) {
                    $modelIcons[] = $modelDTO->getIcon();
                }
            }
        }

        // 批量获取所有图标的链接
        $allIcons = array_merge($providerIcons, $modelIcons);
        $iconUrlMap = $this->fileDomainService->getLinks($organizationCode, array_unique($allIcons));

        // 设置图标URL
        foreach ($serviceProviderConfigs as $configDTO) {
            $icon = $configDTO->getIcon();
            if (isset($iconUrlMap[$icon])) {
                $configDTO->setIcon($iconUrlMap[$icon]->getUrl());
            }

            // 检查是否有模型属性
            if (method_exists($configDTO, 'getModels') && is_array($configDTO->getModels())) {
                $modelDTOs = $configDTO->getModels();
                foreach ($modelDTOs as $modelDTO) {
                    $icon = $modelDTO->getIcon();
                    if (isset($iconUrlMap[$icon])) {
                        $modelDTO->setIcon($iconUrlMap[$icon]->getUrl());
                    }
                }
            }
        }
    }

    /**
     * 处理服务提供商实体列表的图标.
     *
     * @param ServiceProviderDTO[] $serviceProviders 服务提供商实体列表
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
     * 处理单个模型的图标.
     *
     * @param ServiceProviderModelsDTO $modelDTO 模型DTO
     * @param string $organizationCode 组织编码
     */
    private function processModelIcon(ServiceProviderModelsDTO $modelDTO, string $organizationCode): void
    {
        $icon = $modelDTO->getIcon();
        $fileLink = $this->fileDomainService->getLink($organizationCode, $icon);
        if ($fileLink) {
            $modelDTO->setIcon($fileLink->getUrl());
        }
    }
}
