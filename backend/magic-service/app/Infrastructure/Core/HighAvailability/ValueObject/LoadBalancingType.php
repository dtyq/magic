<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\HighAvailability\ValueObject;

/**
 * 负载均衡策略类型枚举.
 */
enum LoadBalancingType: int
{
    /**
     * 随机策略 - 随机选择一个可用的后端服务
     */
    case RANDOM = 1;

    /**
     * 轮询策略 - 按顺序依次选择后端服务
     */
    case ROUND_ROBIN = 2;

    /**
     * 加权轮询策略 - 根据权重比例选择后端服务
     */
    case WEIGHTED_ROUND_ROBIN = 3;

    /**
     * 哈希策略 - 根据请求的哈希值选择后端服务
     */
    case HASH = 4;

    /**
     * 获取负载均衡类型的描述文本.
     *
     * @return string 描述文本
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::RANDOM => '随机',
            self::ROUND_ROBIN => '轮询',
            self::WEIGHTED_ROUND_ROBIN => '加权轮询',
            self::HASH => '哈希',
        };
    }

    /**
     * 检查当前负载均衡类型是否支持权重.
     *
     * @return bool 是否支持权重
     */
    public function supportsWeight(): bool
    {
        return $this === self::WEIGHTED_ROUND_ROBIN;
    }

    /**
     * 获取所有可用的负载均衡类型.
     *
     * @return array<LoadBalancingType> 负载均衡类型数组
     */
    public static function getAvailableTypes(): array
    {
        return [
            self::RANDOM,
            self::ROUND_ROBIN,
            self::WEIGHTED_ROUND_ROBIN,
        ];
    }
}
