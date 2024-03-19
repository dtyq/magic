<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

/**
 * 检索策略枚举类.
 *
 * 定义了两种检索策略：
 * - SINGLE: 单一检索，从单个知识库中检索信息
 * - MULTIPLE: 多重检索，同时从多个知识库中检索信息，然后对结果进行重新排序
 */
class RetrieveStrategy
{
    /**
     * 单一检索.
     *
     * 从单个知识库中检索信息。
     * 该策略通过配置参数 `retrieve_strategy` 字段设置，
     * 从数据库中的 retrieve_config 配置获取。
     */
    public const SINGLE = 'single';

    /**
     * 多重检索.
     *
     * 同时从多个知识库中检索信息，然后对结果进行重新排序。
     * 该策略通过配置参数 `retrieve_strategy` 字段设置，
     * 从数据库中的 retrieve_config 配置获取。
     * 它支持不同的重排序策略，如使用重排序模型或加权分数。
     */
    public const MULTIPLE = 'multiple';

    /**
     * 获取所有可用的检索策略.
     *
     * @return array<string>
     */
    public static function getAll(): array
    {
        return [
            self::SINGLE,
            self::MULTIPLE,
        ];
    }

    /**
     * 检查给定的策略是否有效.
     */
    public static function isValid(string $strategy): bool
    {
        return in_array($strategy, self::getAll(), true);
    }
}
