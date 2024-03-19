<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

/**
 * 重排序模式枚举类.
 *
 * 定义了两种重排序模式：
 * - RERANKING_MODEL: 使用重排序模型对检索结果进行重排序
 * - WEIGHTED_SCORE: 使用加权分数对检索结果进行重排序
 */
class RerankMode
{
    /**
     * 重排序模型.
     *
     * 使用专门的重排序模型（如 BAAI/bge-reranker-large）对检索结果进行重排序。
     * 重排序模型会根据查询和文档的相关性给出更准确的排序。
     * 该模式通过配置参数 `reranking_mode` 字段设置，
     * 从数据库中的 retrieve_config 配置获取。
     */
    public const RERANKING_MODEL = 'reranking_model';

    /**
     * 加权分数.
     *
     * 使用不同检索方法的分数加权计算最终分数，对检索结果进行重排序。
     * 例如，可以设置向量检索结果的权重为 0.7，关键词检索结果的权重为 0.3。
     * 该模式通过配置参数 `reranking_mode` 字段设置，
     * 从数据库中的 retrieve_config 配置获取。
     */
    public const WEIGHTED_SCORE = 'weighted_score';

    /**
     * 获取所有可用的重排序模式.
     *
     * @return array<string>
     */
    public static function getAll(): array
    {
        return [
            self::RERANKING_MODEL,
            self::WEIGHTED_SCORE,
        ];
    }

    /**
     * 检查给定的重排序模式是否有效.
     */
    public static function isValid(string $mode): bool
    {
        return in_array($mode, self::getAll(), true);
    }
}
