<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;
use InvalidArgumentException;

/**
 * 知识库检索配置值对象
 *
 * 包含检索策略、检索方法、重排序配置等参数
 */
class RetrieveConfig extends AbstractValueObject
{
    /**
     * 当前配置版本.
     *
     * 用于配置结构变更时的兼容性处理
     */
    public const int CURRENT_VERSION = 1;

    /**
     * 检索方法.
     *
     * 可选值：
     * - semantic_search: 语义检索
     * - full_text_search: 全文检索
     * - hybrid_search: 混合检索
     * - graph_search: 图检索
     *
     * @see RetrievalMethod
     */
    protected string $searchMethod = RetrievalMethod::SEMANTIC_SEARCH;

    /**
     * 返回的最大结果数量.
     */
    protected int $topK = 3;

    /**
     * 分数阈值
     *
     * 只返回相似度分数大于该阈值的结果
     */
    protected float $scoreThreshold = 0.5;

    /**
     * 是否启用分数阈值过滤.
     */
    protected bool $scoreThresholdEnabled = false;

    /**
     * 重排序模式.
     *
     * 可选值：
     * - reranking_model: 使用重排序模型
     * - weighted_score: 使用加权分数
     *
     * @see RerankMode
     */
    protected string $rerankingMode = RerankMode::WEIGHTED_SCORE;

    /**
     * 是否启用重排序.
     */
    protected bool $rerankingEnable = false;

    /**
     * 权重配置.
     *
     * 包含向量检索和关键词检索的权重配置
     */
    protected array $weights = [
        'vector_setting' => [
            'vector_weight' => 1.0,
            'embedding_model_name' => '',
            'embedding_provider_name' => '',
        ],
        'keyword_setting' => [
            'keyword_weight' => 0.0,
        ],
        'graph_setting' => [
            'relation_weight' => 0.5,
            'max_depth' => 2,
            'include_properties' => true,
            'timeout' => 5.0,
            'retry_count' => 3,
        ],
    ];

    /**
     * 重排序模型配置.
     *
     * 包含重排序模型的相关配置参数
     */
    protected array $rerankingModel = [
        'reranking_model_name' => '',
        'reranking_provider_name' => '',
    ];

    /**
     * 配置版本.
     *
     * 用于配置结构变更时的兼容性处理
     */
    private int $version = self::CURRENT_VERSION;

    /**
     * 获取配置版本.
     */
    public function getVersion(): int
    {
        return $this->version;
    }

    /**
     * 设置配置版本.
     */
    public function setVersion(int $version): self
    {
        $this->version = $version;
        return $this;
    }

    /**
     * 获取检索方法.
     */
    public function getSearchMethod(): string
    {
        return $this->searchMethod;
    }

    /**
     * 设置检索方法.
     */
    public function setSearchMethod(string $searchMethod): self
    {
        if (! RetrievalMethod::isValid($searchMethod)) {
            throw new InvalidArgumentException("Invalid search method: {$searchMethod}");
        }
        $this->searchMethod = $searchMethod;
        return $this;
    }

    /**
     * 获取返回的最大结果数量.
     */
    public function getTopK(): int
    {
        return $this->topK;
    }

    /**
     * 设置返回的最大结果数量.
     */
    public function setTopK(int $topK): self
    {
        if ($topK < 1) {
            throw new InvalidArgumentException('TopK must be greater than 0');
        }
        $this->topK = $topK;
        return $this;
    }

    /**
     * 获取分数阈值
     */
    public function getScoreThreshold(): float
    {
        return $this->scoreThreshold;
    }

    /**
     * 设置分数阈值
     */
    public function setScoreThreshold(float $scoreThreshold): self
    {
        if ($scoreThreshold < 0 || $scoreThreshold > 1) {
            throw new InvalidArgumentException('Score threshold must be between 0 and 1');
        }
        $this->scoreThreshold = $scoreThreshold;
        return $this;
    }

    /**
     * 是否启用分数阈值过滤.
     */
    public function isScoreThresholdEnabled(): bool
    {
        return $this->scoreThresholdEnabled;
    }

    /**
     * 设置是否启用分数阈值过滤.
     */
    public function setScoreThresholdEnabled(bool $scoreThresholdEnabled): self
    {
        $this->scoreThresholdEnabled = $scoreThresholdEnabled;
        return $this;
    }

    /**
     * 获取重排序模式.
     */
    public function getRerankingMode(): string
    {
        return $this->rerankingMode;
    }

    /**
     * 设置重排序模式.
     */
    public function setRerankingMode(string $rerankingMode): self
    {
        if (! RerankMode::isValid($rerankingMode)) {
            throw new InvalidArgumentException("Invalid reranking mode: {$rerankingMode}");
        }
        $this->rerankingMode = $rerankingMode;
        return $this;
    }

    /**
     * 是否启用重排序.
     */
    public function isRerankingEnable(): bool
    {
        return $this->rerankingEnable;
    }

    /**
     * 设置是否启用重排序.
     */
    public function setRerankingEnable(bool $rerankingEnable): self
    {
        $this->rerankingEnable = $rerankingEnable;
        return $this;
    }

    /**
     * 获取权重配置.
     */
    public function getWeights(): array
    {
        return $this->weights;
    }

    /**
     * 设置权重配置.
     */
    public function setWeights(array $weights): self
    {
        // 验证权重配置
        if (! isset($weights['vector_setting']) || ! isset($weights['keyword_setting']) || ! isset($weights['graph_setting'])) {
            throw new InvalidArgumentException('Weights must contain vector_setting, keyword_setting and graph_setting');
        }

        if (! isset($weights['vector_setting']['vector_weight'])
            || ! isset($weights['keyword_setting']['keyword_weight'])) {
            throw new InvalidArgumentException('Vector setting must contain vector_weight and keyword setting must contain keyword_weight');
        }

        // 验证 graph_setting 必须包含必要的字段
        if (! isset($weights['graph_setting']['relation_weight'])
            || ! isset($weights['graph_setting']['max_depth'])
            || ! isset($weights['graph_setting']['include_properties'])) {
            throw new InvalidArgumentException('Graph setting must contain relation_weight, max_depth and include_properties');
        }

        $vectorWeight = $weights['vector_setting']['vector_weight'];
        $keywordWeight = $weights['keyword_setting']['keyword_weight'];

        if ($vectorWeight < 0 || $vectorWeight > 1
            || $keywordWeight < 0 || $keywordWeight > 1) {
            throw new InvalidArgumentException('Weights must be between 0 and 1');
        }

        $this->weights = $weights;
        return $this;
    }

    /**
     * 获取重排序模型配置.
     */
    public function getRerankingModel(): array
    {
        return $this->rerankingModel;
    }

    /**
     * 设置重排序模型配置.
     */
    public function setRerankingModel(array $rerankingModel): self
    {
        // 合并默认配置
        $this->rerankingModel = array_merge($this->rerankingModel, $rerankingModel);
        return $this;
    }

    /**
     * 创建默认配置.
     */
    public static function createDefault(): self
    {
        return new self();
    }

    /**
     * 从数组创建配置.
     */
    public static function fromArray(array $config): self
    {
        $retrieveConfig = new self();
        if (isset($config['search_method'])) {
            $retrieveConfig->setSearchMethod($config['search_method']);
        }

        if (isset($config['top_k'])) {
            $retrieveConfig->setTopK($config['top_k']);
        }

        if (isset($config['score_threshold'])) {
            $retrieveConfig->setScoreThreshold($config['score_threshold']);
        }

        if (isset($config['score_threshold_enabled'])) {
            $retrieveConfig->setScoreThresholdEnabled($config['score_threshold_enabled']);
        }

        if (isset($config['reranking_mode'])) {
            $retrieveConfig->setRerankingMode($config['reranking_mode']);
        }

        if (isset($config['reranking_enable'])) {
            $retrieveConfig->setRerankingEnable($config['reranking_enable']);
        }

        if (isset($config['weights'])) {
            $retrieveConfig->setWeights($config['weights']);
        }

        if (isset($config['reranking_model'])) {
            $retrieveConfig->setRerankingModel($config['reranking_model']);
        }

        return $retrieveConfig;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'version' => $this->version,
            'search_method' => $this->searchMethod,
            'top_k' => $this->topK,
            'score_threshold' => $this->scoreThreshold,
            'score_threshold_enabled' => $this->scoreThresholdEnabled,
            'reranking_mode' => $this->rerankingMode,
            'reranking_enable' => $this->rerankingEnable,
            'weights' => $this->weights,
            'reranking_model' => $this->rerankingModel,
        ];
    }
}
