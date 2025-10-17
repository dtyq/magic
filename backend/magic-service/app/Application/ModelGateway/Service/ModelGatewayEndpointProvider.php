<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Application\Provider\Service\AdminProviderAppService;
use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Entity\ValueObject\ProviderDataIsolation;
use App\Domain\Provider\Entity\ValueObject\Status;
use App\Domain\Provider\Service\AdminProviderDomainService;
use App\Domain\Provider\Service\ProviderModelDomainService;
use App\Infrastructure\Core\HighAvailability\DTO\EndpointDTO;
use App\Infrastructure\Core\HighAvailability\Entity\ValueObject\HighAvailabilityAppType;
use App\Infrastructure\Core\HighAvailability\Interface\EndpointProviderInterface;
use App\Infrastructure\Util\OfficialOrganizationUtil;
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
        private ProviderModelDomainService $providerModelDomainService,
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
     * @param string $endpointId Endpoint ID (ProviderModelEntity ID)
     * @return bool True if endpoint is accessible, false otherwise
     */
    public function checkConnectivity(string $endpointId): bool
    {
        try {
            // 1. 查询模型实体信息
            // 使用官方组织代码作为系统级查询，因为健康检查是系统级操作
            $dataIsolation = ProviderDataIsolation::create(
                OfficialOrganizationUtil::getOfficialOrganizationCode(),
                ''
            );

            $providerModelEntity = $this->providerModelDomainService->getById(
                $dataIsolation,
                $endpointId
            );

            if ($providerModelEntity === null) {
                $this->logger->warning(sprintf('Endpoint not found for connectivity check: %s', $endpointId));
                return false;
            }

            // 2. 检查模型是否启用
            if ($providerModelEntity->getStatus() !== Status::Enabled) {
                $this->logger->info(sprintf('Endpoint disabled: %s', $endpointId));
                return false;
            }

            // 3. 调用真实的连接性测试
            // 目前只有 VLM（图像生成类）模型支持不依赖用户授权的连接性测试
            // LLM 和 Embedding 类型的测试需要实际调用 API，暂时只检查模型状态
            $category = $providerModelEntity->getCategory();
            $serviceProviderConfigId = (string) $providerModelEntity->getServiceProviderConfigId();
            $modelVersion = $providerModelEntity->getModelVersion();
            $organizationCode = $providerModelEntity->getOrganizationCode();

            // 对于 VLM 类型，调用实际的连接性测试
            if ($category->value === 'vlm') {
                $connectResponse = $this->adminProviderDomainService->vlmConnectivityTest(
                    $serviceProviderConfigId,
                    $modelVersion,
                    $organizationCode
                );

                if (! $connectResponse->isStatus()) {
                    $this->logger->warning(sprintf(
                        'VLM connectivity test failed for endpoint %s: %s',
                        $endpointId,
                        $connectResponse->getMessage()
                    ));
                    return false;
                }
            }

            // 对于 LLM 和 Embedding 类型，目前只检查模型存在且启用状态
            // 这对于主动恢复场景已经足够，因为熔断器已经根据实际请求结果做了判断
            // 如果需要完整的 API 测试，需要创建系统级的测试方法

            return true;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'Connectivity check failed for endpoint %s: %s',
                $endpointId,
                $e->getMessage()
            ));
            return false;
        }
    }
}
