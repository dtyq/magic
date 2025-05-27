<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Assembler;

use App\Domain\ModelAdmin\Entity\ServiceProviderConfigEntity;
use App\Domain\ModelAdmin\Entity\ServiceProviderModelsEntity;
use App\Infrastructure\Core\HighAvailability\Entity\EndpointEntity;
use App\Infrastructure\Core\HighAvailability\Entity\ValueObject\CircuitBreakerStatus;
use App\Infrastructure\Core\HighAvailability\Entity\ValueObject\DelimiterType;

class EndpointAssembler
{
    /**
     * 将单个ServiceProviderModelsEntity转换为EndpointEntity.
     */
    public static function toEndpointEntity(
        ServiceProviderModelsEntity $entity,
        ?ServiceProviderConfigEntity $serviceProviderConfigEntity
    ): ?EndpointEntity {
        if (empty($serviceProviderConfigEntity)) {
            return null;
        }

        $endpoint = new EndpointEntity();
        $endpoint->setType($entity->getModelId());
        $endpoint->setName((string) $entity->getId());
        $endpoint->setProvider((string) $serviceProviderConfigEntity->getServiceProviderId());
        $endpoint->setEnabled($entity->getStatus() === 1);
        $endpoint->setCircuitBreakerStatus(CircuitBreakerStatus::CLOSED);
        $endpoint->setConfig('');

        return $endpoint;
    }

    /**
     * 将多个ServiceProviderModelsEntity转换为EndpointEntity数组.
     *
     * @param ServiceProviderModelsEntity[] $providerModelEntities 服务商模型实体数组
     * @return EndpointEntity[]
     */
    public static function toEndpointEntities(array $providerModelEntities): array
    {
        if (empty($providerModelEntities)) {
            return [];
        }
        $endpoints = [];
        foreach ($providerModelEntities as $providerModelEntity) {
            $endpoint = new EndpointEntity();
            // 设置标识信息以便在高可用服务中唯一标识该端点
            $endpoint->setType($providerModelEntity->getModelId());
            $endpoint->setName($providerModelEntity->getModelVersion());
            $endpoint->setProvider((string) $providerModelEntity->getServiceProviderConfigId());
            $endpoint->setCircuitBreakerStatus(CircuitBreakerStatus::CLOSED);
            $endpoint->setEnabled(true);
            $endpoints[] = $endpoint;
        }

        return $endpoints;
    }

    public static function getEndpointTypeByModelIdAndOrgCode(
        string $modelId,
        string $orgCode
    ): string {
        return $modelId . DelimiterType::MODEL->value . $orgCode;
    }
}
