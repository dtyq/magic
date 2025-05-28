<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\HighAvailability\Service;

use App\Domain\ModelAdmin\Entity\ServiceProviderModelsEntity;
use App\Domain\ModelAdmin\Service\ServiceProviderDomainService;
use App\Infrastructure\Core\HighAvailability\DTO\EndpointDTO;
use App\Infrastructure\Core\HighAvailability\Entity\ValueObject\HighAvailabilityAppType;
use App\Infrastructure\Core\HighAvailability\Interface\EndpointProviderInterface;
use App\Interfaces\ModelGateway\Assembler\EndpointAssembler;

/**
 * ModelGateway endpoint provider.
 *
 * Get endpoint list from ModelGateway business module
 */
readonly class ModelGatewayEndpointProvider implements EndpointProviderInterface
{
    public function __construct(
        private ServiceProviderDomainService $serviceProviderDomainService
    ) {
    }

    /**
     * Get endpoint list from ModelGateway business side.
     *
     * @param string $modelId Model ID
     * @param string $orgCode Organization code
     * @param null|string $provider Service provider config ID
     * @param null|string $endpointName Endpoint name (ServiceProviderModelsEntity ID)
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

        // 如果 modelId 包含格式化前缀，则还原为原始的 modelId
        $originalModelId = EndpointAssembler::extractOriginalModelId($modelId);

        // Get service provider models by model ID and organization code
        $serviceProviderModels = $this->serviceProviderDomainService->getOrganizationActiveModelsByIdOrType(
            $originalModelId,
            $orgCode
        );

        if (empty($serviceProviderModels)) {
            return [];
        }
        // Filter by provider if specified
        if ($provider) {
            $serviceProviderModels = array_filter($serviceProviderModels, static function (ServiceProviderModelsEntity $model) use ($provider) {
                return $model->getServiceProviderConfigId() === (int) $provider;
            });
        }

        // Filter by endpoint name (model ID) if specified
        if ($endpointName) {
            $serviceProviderModels = array_filter($serviceProviderModels, static function (ServiceProviderModelsEntity $model) use ($endpointName) {
                return $model->getModelVersion() === $endpointName;
            });
        }

        if (empty($serviceProviderModels)) {
            return [];
        }
        // Convert to EndpointEntity array
        return EndpointAssembler::toEndpointEntities($serviceProviderModels, HighAvailabilityAppType::MODEL_GATEWAY);
    }
}
