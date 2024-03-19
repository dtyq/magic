<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

/**
 * 检索方法枚举类.
 *
 * 定义了四种检索方法：
 * - SEMANTIC_SEARCH: 语义检索，基于向量相似度的检索方法
 * - FULL_TEXT_SEARCH: 全文检索，基于关键词匹配的检索方法
 * - HYBRID_SEARCH: 混合检索，结合语义检索和全文检索的方法
 * - GRAPH_SEARCH: 图检索，基于知识图谱的检索方法
 */
class RetrievalMethod
{
    /**
     * 语义检索.
     *
     * 基于向量相似度的检索方法。
     * 将查询文本转换为向量，然后在向量数据库中查找最相似的文档。
     * 适合理解语义关系、多语言理解、处理模糊描述。
     */
    public const string SEMANTIC_SEARCH = 'semantic_search';

    /**
     * 全文检索.
     *
     * 基于关键词匹配的检索方法。
     * 索引文档中的所有单词，返回包含查询词的文本片段。
     * 适合精确匹配（如产品名称、人名、ID）和低频词匹配。
     */
    public const string FULL_TEXT_SEARCH = 'full_text_search';

    /**
     * 混合检索.
     *
     * 结合语义检索和全文检索的方法。
     * 同时执行全文检索和向量检索，然后通过重排序步骤选择最佳结果。
     * 结合了两种检索技术的优势，弥补各自的不足。
     */
    public const string HYBRID_SEARCH = 'hybrid_search';

    /**
     * 图检索.
     *
     * 基于知识图谱的检索方法。
     * 利用实体间的关系进行检索，适合处理复杂的关联查询。
     * 可以发现隐含的关系和连接。
     */
    public const string GRAPH_SEARCH = 'graph_search';

    /**
     * 获取所有可用的检索方法.
     *
     * @return array<string>
     */
    public static function getAll(): array
    {
        return [
            self::SEMANTIC_SEARCH,
            self::FULL_TEXT_SEARCH,
            self::HYBRID_SEARCH,
            self::GRAPH_SEARCH,
        ];
    }

    /**
     * 检查给定的检索方法是否有效.
     */
    public static function isValid(string $method): bool
    {
        return in_array($method, self::getAll(), true);
    }
}
