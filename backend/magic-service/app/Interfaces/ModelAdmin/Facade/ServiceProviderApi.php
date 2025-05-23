<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelAdmin\Facade;

use App\Application\Chat\Service\MagicAccountAppService;
use App\Application\Chat\Service\MagicUserContactAppService;
use App\Application\ModelAdmin\Service\ServiceProviderAppService;
use App\Domain\ModelAdmin\Constant\ModelType;
use App\Domain\ModelAdmin\Constant\ServiceProviderCategory;
use App\Domain\ModelAdmin\Entity\ServiceProviderConfigEntity;
use App\Domain\ModelAdmin\Entity\ServiceProviderModelsEntity;
use App\Domain\ModelAdmin\Entity\ValueObject\ServiceProviderConfigDTO;
use App\ErrorCode\UserErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Auth\PermissionChecker;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Exception;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class ServiceProviderApi extends AbstractApi
{
    #[Inject]
    protected ServiceProviderAppService $serviceProviderAppService;

    // 获取服务商
    public function getServiceProviders(RequestInterface $request)
    {
        $this->isInWhiteListForOrganization();
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $category = $request->input('category', 'llm');
        $serviceProviderCategory = ServiceProviderCategory::tryFrom($category);
        return $this->serviceProviderAppService->getServiceProviders($authenticatable, $serviceProviderCategory);
    }

    // 获取服务商详细信息
    public function getServiceProviderConfig(RequestInterface $request, ?string $serviceProviderConfigId = null)
    {
        $serviceProviderConfigId = $serviceProviderConfigId ?? $request->input('service_provider_config_id') ?? '';

        $this->isInWhiteListForOrganization();
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        return $this->serviceProviderAppService->getServiceProviderConfig($serviceProviderConfigId, $authenticatable->getOrganizationCode());
    }

    // 更新服务商
    public function updateServiceProviderConfig(RequestInterface $request)
    {
        $this->isInWhiteListForOrganization();
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $serviceProviderConfigEntity = new ServiceProviderConfigEntity($request->all());
        $serviceProviderConfigEntity->setOrganizationCode($authenticatable->getOrganizationCode());
        return $this->serviceProviderAppService->updateServiceProviderConfig($serviceProviderConfigEntity);
    }

    // 修改模型状态
    public function updateModelStatus(RequestInterface $request, ?string $modelId = null)
    {
        $this->isInWhiteListForOrganization();
        $modelId = $modelId ?? $request->input('model_id') ?? '';
        $authenticatable = $this->getAuthorization();
        $status = $request->input('status', 0);
        /** @var MagicUserAuthorization $authenticatable */
        $organizationCode = $authenticatable->getOrganizationCode();
        $this->serviceProviderAppService->updateModelStatus($modelId, $status, $organizationCode);
    }

    // 获取当前组织是否是官方组织
    public function isCurrentOrganizationOfficial(): array
    {
        $officialOrganization = config('service_provider.office_organization');
        $organizationCode = $this->getAuthorization()->getOrganizationCode();
        return [
            'is_official' => $officialOrganization === $organizationCode,
            'official_organization' => $officialOrganization,
        ];
    }

    // 保存模型
    public function saveModelToServiceProvider(RequestInterface $request)
    {
        $this->isInWhiteListForOrganization();
        $authenticatable = $this->getAuthorization();
        $serviceProviderModelsEntity = new ServiceProviderModelsEntity($request->all());
        /* @var MagicUserAuthorization $authenticatable */
        $serviceProviderModelsEntity->setOrganizationCode($authenticatable->getOrganizationCode());
        return $this->serviceProviderAppService->saveModelToServiceProvider($serviceProviderModelsEntity);
    }

    /**
     * 连通性测试.
     * @throws Exception
     */
    public function connectivityTest(RequestInterface $request)
    {
        $this->isInWhiteListForOrganization();
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $serviceProviderConfigId = $request->input('service_provider_config_id');
        $modelVersion = $request->input('model_version');
        $modelId = $request->input('model_id');
        return $this->serviceProviderAppService->connectivityTest($serviceProviderConfigId, $modelVersion, $modelId, $authenticatable);
    }

    // 删除模型

    /**
     * @throws Exception
     */
    public function deleteModel(RequestInterface $request, ?string $modelId = null)
    {
        $this->isInWhiteListForOrganization();
        $modelId = $modelId ?? $request->input('model_id') ?? '';
        $authenticatable = $this->getAuthorization();
        /* @var MagicUserAuthorization $authenticatable */
        $this->serviceProviderAppService->deleteModel($modelId, $authenticatable->getOrganizationCode());
    }

    // 获取原始模型id
    public function listOriginalModels(RequestInterface $request)
    {
        $this->isInWhiteListForOrganization();
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        return $this->serviceProviderAppService->listOriginalModels($authenticatable);
    }

    // 增加原始模型id
    public function addOriginalModel(RequestInterface $request)
    {
        $this->isInWhiteListForOrganization();

        $this->getAuthorization();
        $modelId = $request->input('model_id');
        $this->serviceProviderAppService->addOriginalModel($modelId);
    }

    // 根据服务商分类获取模型
    public function getServiceProvidersByCategory(RequestInterface $request)
    {
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $category = $request->input('category');
        $modelType = (int) $request->input('model_type', -1);
        $modelTypes = $request->input('model_types', []);
        $modelType = ModelType::tryFrom($modelType);
        $serviceProviderCategory = ServiceProviderCategory::tryFrom($category);
        $serviceProviderConfigId = $request->input('service_provider_config_id');

        if ($serviceProviderConfigId) {
            // 如果指定了具体的服务商配置ID，则返回该服务商的详细信息
            return $this->serviceProviderAppService->getServiceProviderConfig(
                $serviceProviderConfigId,
                $authenticatable->getOrganizationCode()
            );
        }

        // 处理modelTypes参数：
        // 如果model_types为空但model_type有值，将model_type放入model_types
        if (empty($modelTypes) && $modelType !== null) {
            $modelTypes = [$modelType->value];
        }

        // 返回所有服务商及其模型信息，传入model_types数组
        return $this->serviceProviderAppService->getActiveModelsByOrganizationCode(
            $authenticatable->getOrganizationCode(),
            $serviceProviderCategory,
            $modelTypes
        );
    }

    // 组织添加服务商
    public function addServiceProviderForOrganization(RequestInterface $request)
    {
        $this->isInWhiteListForOrganization();
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $serviceProviderConfigDTO = new ServiceProviderConfigDTO($request->all());
        return $this->serviceProviderAppService->addServiceProviderForOrganization($serviceProviderConfigDTO, $authenticatable);
    }

    // 删除服务商
    public function deleteServiceProviderForOrganization(RequestInterface $request, ?string $serviceProviderConfigId = null)
    {
        $serviceProviderConfigId = $serviceProviderConfigId ?? $request->input('service_provider_config_id') ?? '';

        $this->isInWhiteListForOrganization();
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $this->serviceProviderAppService->deleteServiceProviderForOrganization($serviceProviderConfigId, $authenticatable);
    }

    // 组织添加模型标识
    public function addModelIdForOrganization(RequestInterface $request)
    {
        $this->isInWhiteListForOrganization();
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $modelId = $request->input('model_id');
        $this->serviceProviderAppService->addModelIdForOrganization($modelId, $authenticatable);
    }

    // 组织删除模型标识
    public function deleteModelIdForOrganization(RequestInterface $request, ?string $modelId = null)
    {
        $this->isInWhiteListForOrganization();
        $modelId = $modelId ?? $request->input('model_id') ?? '';
        /** @var MagicUserAuthorization $authenticatable */
        $authenticatable = $this->getAuthorization();
        $this->serviceProviderAppService->deleteModelIdForOrganization($modelId, $authenticatable);
    }

    /**
     * 获取所有非官方LLM服务商列表
     * 直接从数据库中查询category为llm且provider_type不为OFFICIAL的服务商
     * 不依赖于当前组织，适用于需要添加服务商的场景.
     */
    public function getNonOfficialLlmProviders(RequestInterface $request)
    {
        $this->isInWhiteListForOrganization();
        $authenticatable = $this->getAuthorization();
        // 直接获取所有LLM类型的非官方服务商
        return $this->serviceProviderAppService->getAllNonOfficialProviders(ServiceProviderCategory::LLM, $authenticatable->getOrganizationCode());
    }

    private function getPhone(string $userId)
    {
        $magicUserContactAppService = di(MagicUserContactAppService::class);
        $user = $magicUserContactAppService->getByUserId($userId);
        $magicAccountAppService = di(MagicAccountAppService::class);
        $accountEntity = $magicAccountAppService->getAccountInfoByMagicId($user->getMagicId());
        return $accountEntity->getPhone();
    }

    // 判断当前用户是否在白名单中
    private function isInWhiteListForOrganization(): void
    {
        $authentication = $this->getAuthorization();
        $phone = $this->getPhone($authentication->getId());
        if (! PermissionChecker::isOrganizationAdmin($authentication->getOrganizationCode(), $phone)) {
            ExceptionBuilder::throw(UserErrorCode::ORGANIZATION_NOT_AUTHORIZE);
        }
    }
}
