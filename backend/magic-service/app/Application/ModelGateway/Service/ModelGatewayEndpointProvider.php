<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Application\Provider\Service\AdminProviderAppService;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ModelType;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Service\AdminProviderDomainService;
use App\Infrastructure\Core\HighAvailability\DTO\EndpointDTO;
use App\Infrastructure\Core\HighAvailability\Entity\ValueObject\HighAvailabilityAppType;
use App\Infrastructure\Core\HighAvailability\Interface\EndpointProviderInterface;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\ModelGateway\Assembler\EndpointAssembler;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * ModelGateway endpoint provider.
 *
 * Get endpoint list from ModelGateway business module and provide connectivity testing
 */
readonly class ModelGatewayEndpointProvider implements EndpointProviderInterface
{
    public function __construct(
        private AdminProviderDomainService $adminProviderDomainService,
        private AdminProviderAppService $adminProviderAppService,
        private LoggerInterface $logger
    ) {
    }

    /**
     * Get endpoint list from ModelGateway business side.
     *
     * @param string $modelId Model ID
     * @param string $orgCode Organization code
     * @param null|string $provider Service provider config ID
     * @param null|string $endpointName Endpoint name (ProviderModelEntity ID)
     * @return EndpointDTO[] Endpoint list
     */
    public function getEndpoints(
        string $modelId,
        string $orgCode,
        ?string $provider = null,
        ?string $endpointName = null
    ): array {
        if (empty($modelId) || empty($orgCode)) {
            return [];
        }

        // 如果 modelId 包含格式化前缀，则还原为纯净的 modelId
        $pureModelId = EndpointAssembler::extractOriginalModelId($modelId);

        // Get service provider models by model ID and organization code
        $serviceProviderModels = $this->adminProviderDomainService->getOrganizationActiveModelsByIdOrType(
            $pureModelId,
            $orgCode
        );

        if (empty($serviceProviderModels)) {
            return [];
        }
        // Filter by provider if specified
        if ($provider) {
            $serviceProviderModels = array_filter($serviceProviderModels, static function (ProviderModelEntity $model) use ($provider) {
                return $model->getServiceProviderConfigId() === (int) $provider;
            });
        }

        // Filter by endpoint name (model ID) if specified
        if ($endpointName) {
            $serviceProviderModels = array_filter($serviceProviderModels, static function (ProviderModelEntity $model) use ($endpointName) {
                return $model->getModelVersion() === $endpointName;
            });
        }

        if (empty($serviceProviderModels)) {
            return [];
        }
        // Convert to EndpointEntity array
        return EndpointAssembler::toEndpointEntities($serviceProviderModels, HighAvailabilityAppType::MODEL_GATEWAY);
    }

    /**
     * Check endpoint connectivity.
     *
     * This method performs an actual connectivity test by calling the model API
     * to verify if the endpoint is accessible and working properly.
     *
     * @param string $type 接入点类型（如：modelGateway||gpt-4）
     * @param string $provider 服务提供商配置ID（serviceProviderConfigId）
     * @return bool True if endpoint is accessible, false otherwise
     */
    public function checkConnectivity(string $type, string $provider): bool
    {
        try {
            // 1. 从 type 中解析出 model_id
            $modelId = EndpointAssembler::extractOriginalModelId($type);

            // 2. 使用官方组织代码作为系统级查询，因为健康检查是系统级操作
            $organizationCode = OfficialOrganizationUtil::getOfficialOrganizationCode();

            // 3. provider 就是 serviceProviderConfigId，不需要查库
            $serviceProviderConfigId = $provider;

            // 4. 获取该提供商下的该模型列表
            $serviceProviderModels = $this->adminProviderDomainService->getOrganizationActiveModelsByIdOrType(
                $modelId,
                $organizationCode
            );
            if (empty($serviceProviderModels)) {
                return true;
            }

            // 5. 筛选出指定提供商的模型
            $targetModels = array_filter($serviceProviderModels, static function (ProviderModelEntity $model) use ($serviceProviderConfigId) {
                return $model->getServiceProviderConfigId() === (int) $serviceProviderConfigId;
            });
            if (empty($targetModels)) {
                return true;
            }

            // 6. 使用第一个匹配的模型进行连通性测试
            /** @var ProviderModelEntity $providerModelEntity */
            $providerModelEntity = reset($targetModels);
            $modelType = $providerModelEntity->getModelType();

            // 7. 只对 LLM 和 Embedding 进行健康检查
            if ($modelType === ModelType::LLM || $modelType === ModelType::EMBEDDING) {
                // 检查模型是否启用
                if ($providerModelEntity->getStatus() !== Status::Enabled) {
                    return true;
                }

                // 8. 调用实际的连通性测试
                $modelPrimaryId = (string) $providerModelEntity->getId();
                $modelVersion = $providerModelEntity->getModelVersion();

                // 创建系统级的授权对象（用于健康检查）
                $systemAuthorization = new MagicUserAuthorization();
                $systemAuthorization->setId('system_health_check');
                $systemAuthorization->setOrganizationCode($organizationCode);
                // 调用连通性测试
                $connectResponse = $this->adminProviderAppService->connectivityTest(
                    $serviceProviderConfigId,
                    $modelVersion,
                    $modelPrimaryId,
                    $systemAuthorization
                );

                return $connectResponse->isStatus();
            }

            // VLM 等类型不做健康检查，直接跳过（返回 true）
            return true;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Connectivity check failed: type=%s, provider=%s, error=%s',
                $type,
                $provider,
                $e->getMessage()
            ));
            return false;
        }
    }
}
