<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\HighAvailability\Interface;

use App\Infrastructure\Core\HighAvailability\DTO\EndpointDTO;
use App\Infrastructure\Core\HighAvailability\DTO\EndpointResponseDTO;
use App\Infrastructure\Core\HighAvailability\ValueObject\LoadBalancingType;
use App\Infrastructure\Core\HighAvailability\ValueObject\StatisticsLevel;

interface HighAvailabilityInterface
{
    /**
     * Get available endpoint list.
     *
     * Query endpoint list from business side for load balancing and high availability selection
     *
     * @param string $endpointType Model ID
     * @param string $orgCode Organization code
     * @param null|string $provider Service provider, e.g., Microsoft | Volcano | Alibaba Cloud, optional
     * @param null|string $endpointName Endpoint name (optional), e.g., East US, Japan for Microsoft provider
     * @return EndpointDTO[] Endpoint list
     */
    public function getEndpointList(
        string $endpointType,
        string $orgCode,
        ?string $provider = null,
        ?string $endpointName = null
    ): array;

    /**
     * Get available endpoint.
     *
     * First query endpoint list from business side, then select the best performing endpoint based on load balancing algorithm and statistics
     * Selection criteria:
     * 1. Highest success rate
     * 2. Shortest response time
     *
     * @param string $endpointType Model ID,like GPT-4o
     * @param string $orgCode Organization code
     * @param null|string $provider Service provider, e.g., Microsoft | Volcano | Alibaba Cloud, optional
     * @param null|string $endpointName Endpoint name (optional), e.g., East US, Japan for Microsoft provider
     * @param LoadBalancingType $balancingType Load balancing type: random/round-robin/weighted-round-robin
     * @param StatisticsLevel $statisticsLevel Statistics level
     * @param int $timeRange Statistics time range in minutes, default 30 minutes
     * @note Multiple endpoints of the same type and provider are allowed.
     * @return null|EndpointDTO Available endpoint, returns null if no available endpoint
     */
    public function getAvailableEndpoint(
        string $endpointType,
        string $orgCode,
        ?string $provider = null,
        ?string $endpointName = null,
        LoadBalancingType $balancingType = LoadBalancingType::RANDOM,
        StatisticsLevel $statisticsLevel = StatisticsLevel::LEVEL_MINUTE,
        int $timeRange = 30
    ): ?EndpointDTO;

    /**
     * 记录接入点的响应并自动处理成功/失败状态，以及用于后续的数据分析。
     *
     * 该方法将:
     * 1. 记录请求统计数据
     * 2. 根据请求成功或失败状态自动触发熔断器反馈
     *
     * @param EndpointResponseDTO $response 接入点响应实体
     */
    public function recordResponse(EndpointResponseDTO $response): bool;
}
