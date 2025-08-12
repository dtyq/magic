<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\HighAvailability\Service;

use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Domain\Provider\Service\AdminProviderDomainService;
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
        private AdminProviderDomainService $serviceProviderDomainService
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
        $serviceProviderModels = $this->serviceProviderDomainService->getOrganizationActiveModelsByIdOrType(
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
}
