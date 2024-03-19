<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Assembler;

use App\Domain\Provider\Entity\ProviderModelEntity;
use App\Infrastructure\Core\HighAvailability\DTO\EndpointDTO;
use App\Infrastructure\Core\HighAvailability\Entity\ValueObject\CircuitBreakerStatus;
use App\Infrastructure\Core\HighAvailability\Entity\ValueObject\DelimiterType;
use App\Infrastructure\Core\HighAvailability\Entity\ValueObject\HighAvailabilityAppType;

class EndpointAssembler
{
    /**
     * 生成标准化的端点类型标识.
     *
     * @param HighAvailabilityAppType $appType 高可用应用类型
     * @param string $modelId 模型ID
     * @return string 标准化的端点类型标识
     */
    public static function generateEndpointType(HighAvailabilityAppType $appType, string $modelId): string
    {
        return $appType->value . DelimiterType::HIGH_AVAILABILITY->value . $modelId;
    }

    /**
     * 从格式化的端点类型标识中还原原始的模型ID.
     *
     * @param string $formattedModelId 可能包含格式化前缀的模型ID
     * @return string 原始的模型ID
     */
    public static function extractOriginalModelId(string $formattedModelId): string
    {
        // 遍历所有的 HighAvailabilityAppType 枚举值
        foreach (HighAvailabilityAppType::cases() as $appType) {
            $prefix = $appType->value . DelimiterType::HIGH_AVAILABILITY->value;

            // 如果匹配到前缀，则移除前缀返回原始 modelId
            if (str_starts_with($formattedModelId, $prefix)) {
                return substr($formattedModelId, strlen($prefix));
            }
        }

        // 如果没有匹配到任何前缀，则直接返回原始值
        return $formattedModelId;
    }

    /**
     * 检查给定的字符串是否为格式化的端点类型标识.
     *
     * @param string $modelId 待检查的模型ID
     * @return bool 是否为格式化的端点类型标识
     */
    public static function isFormattedEndpointType(string $modelId): bool
    {
        // 遍历所有的 HighAvailabilityAppType 枚举值
        foreach (HighAvailabilityAppType::cases() as $appType) {
            $prefix = $appType->value . DelimiterType::HIGH_AVAILABILITY->value;
            if (str_starts_with($modelId, $prefix)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Convert multiple ProviderModelEntity to EndpointDTO array.
     *
     * @param ProviderModelEntity[] $providerModelEntities Service provider model entity array
     * @param HighAvailabilityAppType $appType High availability application type
     * @return EndpointDTO[]
     */
    public static function toEndpointEntities(array $providerModelEntities, HighAvailabilityAppType $appType): array
    {
        if (empty($providerModelEntities)) {
            return [];
        }
        $endpoints = [];
        foreach ($providerModelEntities as $providerModelEntity) {
            $endpoint = new EndpointDTO();
            // Set identification information to uniquely identify the endpoint in high availability service
            $endpoint->setBusinessId($providerModelEntity->getId());
            $endpoint->setType(self::generateEndpointType($appType, $providerModelEntity->getModelId()));
            $endpoint->setName($providerModelEntity->getModelVersion());
            $endpoint->setProvider((string) $providerModelEntity->getServiceProviderConfigId());
            $endpoint->setCircuitBreakerStatus(CircuitBreakerStatus::CLOSED);
            $endpoint->setEnabled(true);
            $endpoint->setLoadBalancingWeight($providerModelEntity->getLoadBalancingWeight());
            $endpoints[] = $endpoint;
        }

        return $endpoints;
    }
}
