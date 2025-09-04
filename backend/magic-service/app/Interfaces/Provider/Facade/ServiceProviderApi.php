<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\Facade;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Provider\DTO\SuperMagicModelDTO;
use App\Application\Provider\Service\AdminOriginModelAppService;
use App\Application\Provider\Service\AdminProviderAppService;
use app\Application\Provider\Service\ProviderAppService;
use App\Domain\Provider\DTO\ProviderConfigModelsDTO;
use App\Domain\Provider\Entity\ValueObject\Category;
use App\Domain\Provider\Entity\ValueObject\Query\ProviderModelQuery;
use App\ErrorCode\ServiceProviderErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Provider\DTO\CreateProviderConfigRequest;
use App\Interfaces\Provider\DTO\SaveProviderModelDTO;
use App\Interfaces\Provider\DTO\UpdateProviderConfigRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Exception;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;
use JetBrains\PhpStorm\Deprecated;

#[ApiResponse('low_code')]
class ServiceProviderApi extends AbstractApi
{
    #[Inject]
    protected AdminProviderAppService $adminProviderAppService;

    #[Inject]
    protected AdminOriginModelAppService $adminOriginModelAppService;

    #[Inject]
    protected ProviderAppService $providerAppService;

    // 根据分类获取服务商列表
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODEL, MagicResourceEnum::ADMIN_AI_IMAGE], MagicOperationEnum::QUERY)]
    public function getServiceProviders(RequestInterface $request)
    {
        return $this->getProvidersByCategory($request);
    }

    // 根据分类获取服务商列表
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODEL, MagicResourceEnum::ADMIN_AI_IMAGE], MagicOperationEnum::QUERY)]
    public function getOrganizationProvidersByCategory(RequestInterface $request)
    {
        return $this->getProvidersByCategory($request);
    }

    // 获取服务商和模型列表
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODEL, MagicResourceEnum::ADMIN_AI_IMAGE], MagicOperationEnum::QUERY)]
    public function getServiceProviderConfigModels(RequestInterface $request, ?string $serviceProviderConfigId = null)
    {
        $serviceProviderConfigId = $serviceProviderConfigId ?? $request->input('service_provider_config_id') ?? '';
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $providerConfigAggregateDTO = $this->adminProviderAppService->getProviderModelsByConfigId($authenticatable, $serviceProviderConfigId);
        // 将新格式数据转换为旧格式以保持向后兼容性
        return $this->convertToLegacyFormat($providerConfigAggregateDTO);
    }

    // 更新服务商
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODEL, MagicResourceEnum::ADMIN_AI_IMAGE], MagicOperationEnum::EDIT)]
    public function updateServiceProviderConfig(RequestInterface $request)
    {
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $updateProviderConfigRequest = new UpdateProviderConfigRequest($request->all());
        return $this->adminProviderAppService->updateProvider($authenticatable, $updateProviderConfigRequest);
    }

    // 修改模型状态
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODEL, MagicResourceEnum::ADMIN_AI_IMAGE], MagicOperationEnum::EDIT)]
    public function updateModelStatus(RequestInterface $request, ?string $modelId = null)
    {
        $modelId = $modelId ?? $request->input('model_id') ?? '';
        $authenticatable = $this->getAuthorization();
        $status = $request->input('status', 0);
        /* @var MagicUserAuthorization $authenticatable */
        $this->adminProviderAppService->updateModelStatus($authenticatable, $modelId, $status);
    }

    // 获取当前组织是否是官方组织
    public function isCurrentOrganizationOfficial(): array
    {
        $organizationCode = $this->getAuthorization()->getOrganizationCode();
        return [
            'is_official' => OfficialOrganizationUtil::isOfficialOrganization($organizationCode),
            'official_organization' => OfficialOrganizationUtil::getOfficialOrganizationCode(),
        ];
    }

    // 保存模型
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODEL, MagicResourceEnum::ADMIN_AI_IMAGE], MagicOperationEnum::EDIT)]
    public function saveModelToServiceProvider(RequestInterface $request)
    {
        $authenticatable = $this->getAuthorization();
        $saveProviderModelDTO = new SaveProviderModelDTO($request->all());
        return $this->adminProviderAppService->saveModel($authenticatable, $saveProviderModelDTO);
    }

    /**
     * 连通性测试.
     * @throws Exception
     */
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODEL, MagicResourceEnum::ADMIN_AI_IMAGE], MagicOperationEnum::QUERY)]
    public function connectivityTest(RequestInterface $request)
    {
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $serviceProviderConfigId = $request->input('service_provider_config_id');
        $modelVersion = $request->input('model_version');
        $modelPrimaryId = $request->input('model_id');
        return $this->adminProviderAppService->connectivityTest($serviceProviderConfigId, $modelVersion, $modelPrimaryId, $authenticatable);
    }

    // 删除模型

    /**
     * @throws Exception
     */
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODEL, MagicResourceEnum::ADMIN_AI_IMAGE], MagicOperationEnum::EDIT)]
    public function deleteModel(RequestInterface $request, ?string $modelId = null)
    {
        $modelId = $modelId ?? $request->input('model_id') ?? '';
        $authenticatable = $this->getAuthorization();
        $this->adminProviderAppService->deleteModel($authenticatable, $modelId);
    }

    // 获取原始模型id
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODEL, MagicResourceEnum::ADMIN_AI_IMAGE], MagicOperationEnum::QUERY)]
    public function listOriginalModels()
    {
        $authenticatable = $this->getAuthorization();
        return $this->adminOriginModelAppService->list($authenticatable);
    }

    // 增加原始模型id
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODEL, MagicResourceEnum::ADMIN_AI_IMAGE], MagicOperationEnum::EDIT)]
    public function addOriginalModel(RequestInterface $request)
    {
        $authenticatable = $this->getAuthorization();
        $modelId = $request->input('model_id');
        $this->adminOriginModelAppService->create($authenticatable, $modelId);
    }

    // 组织添加服务商
    #[Deprecated]
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODEL, MagicResourceEnum::ADMIN_AI_IMAGE], MagicOperationEnum::EDIT)]
    public function addServiceProviderForOrganization(RequestInterface $request)
    {
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $createProviderConfigRequest = new CreateProviderConfigRequest($request->all());
        return $this->adminProviderAppService->createProvider($authenticatable, $createProviderConfigRequest);
    }

    // 删除服务商
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODEL, MagicResourceEnum::ADMIN_AI_IMAGE], MagicOperationEnum::EDIT)]
    public function deleteServiceProviderForOrganization(RequestInterface $request, ?string $serviceProviderConfigId = null)
    {
        $serviceProviderConfigId = $serviceProviderConfigId ?? $request->input('service_provider_config_id') ?? '';

        $authenticatable = $this->getAuthorization();
        $this->adminProviderAppService->deleteProvider($authenticatable, $serviceProviderConfigId);
    }

    // 组织添加模型标识
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODEL, MagicResourceEnum::ADMIN_AI_IMAGE], MagicOperationEnum::EDIT)]
    public function addModelIdForOrganization(RequestInterface $request)
    {
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $modelId = $request->input('model_id');
        $this->adminOriginModelAppService->create($authenticatable, $modelId);
    }

    // 组织删除模型标识
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODEL, MagicResourceEnum::ADMIN_AI_IMAGE], MagicOperationEnum::EDIT)]
    public function deleteModelIdForOrganization(RequestInterface $request, ?string $modelId = null)
    {
        $modelId = $modelId ?? $request->input('model_id') ?? '';
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $this->adminOriginModelAppService->delete($authenticatable, $modelId);
    }

    /**
     * 获取所有非官方LLM服务商列表
     * 直接从数据库中查询category为llm且provider_type不为OFFICIAL的服务商
     * 不依赖于当前组织，适用于需要添加服务商的场景.
     */
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODEL, MagicResourceEnum::ADMIN_AI_IMAGE], MagicOperationEnum::QUERY)]
    public function getNonOfficialLlmProviders()
    {
        $authenticatable = $this->getAuthorization();
        // 直接获取所有LLM类型的非官方服务商
        return $this->adminProviderAppService->getAllNonOfficialProviders(Category::LLM, $authenticatable->getOrganizationCode());
    }

    /**
     * Get super magic display models and Magic provider models visible to current organization.
     * @return SuperMagicModelDTO[]
     */
    public function getSuperMagicDisplayModels(): array
    {
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();

        return $this->providerAppService->getSuperMagicDisplayModelsForOrganization($authenticatable->getOrganizationCode());
    }

    #[CheckPermission([MagicResourceEnum::ADMIN_AI_MODEL, MagicResourceEnum::ADMIN_AI_IMAGE], MagicOperationEnum::QUERY)]
    public function queriesModels(RequestInterface $request): array
    {
        $authenticatable = $this->getAuthorization();
        $providerModelQuery = new ProviderModelQuery($request->all());
        return $this->adminProviderAppService->queriesModels($authenticatable, $providerModelQuery);
    }

    /**
     * 根据分类获取服务商通用逻辑.
     * @param RequestInterface $request 请求对象
     * @return array 服务商列表
     */
    private function getProvidersByCategory(RequestInterface $request): array
    {
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $category = $request->input('category', 'llm');
        $serviceProviderCategory = Category::tryFrom($category);
        if (! $serviceProviderCategory) {
            ExceptionBuilder::throw(ServiceProviderErrorCode::InvalidModelType);
        }

        return $this->adminProviderAppService->getOrganizationProvidersModelsByCategory(
            $authenticatable->getOrganizationCode(),
            $serviceProviderCategory
        );
    }

    /**
     * 将新格式数据转换为旧格式，保持向后兼容性.
     * @param ?ProviderConfigModelsDTO $aggregateDTO 聚合DTO对象
     * @return array 旧格式数据
     */
    private function convertToLegacyFormat(?ProviderConfigModelsDTO $aggregateDTO): array
    {
        if ($aggregateDTO === null) {
            return [];
        }
        $data = $aggregateDTO->toArray();

        // 如果不是新格式结构，直接返回
        if (! isset($data['provider_config'])) {
            return $data;
        }

        // 将 provider_config 内容提升到根级别，并添加 alias 和 models
        return array_merge($data['provider_config'], [
            'alias' => $data['provider_config']['translate']['alias']['zh_CN'] ?? '',
            'models' => $data['models'] ?? [],
        ]);
    }
}
