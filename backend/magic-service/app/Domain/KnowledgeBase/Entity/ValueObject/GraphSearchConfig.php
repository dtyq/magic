<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;
use InvalidArgumentException;

/**
 * 图搜索配置值对象
 *
 * 包含图搜索的相关配置参数，如 API 端点、认证信息、超时设置等
 */
class GraphSearchConfig extends AbstractValueObject
{
    /**
     * 关系权重.
     *
     * 图搜索中关系的权重，用于计算最终相似度分数
     */
    private float $relationWeight = 0.5;

    /**
     * 最大搜索深度.
     *
     * 图搜索的最大深度，即从起始节点开始，最多搜索几跳关系
     */
    private int $maxDepth = 2;

    /**
     * 是否包含属性.
     *
     * 是否在搜索结果中包含节点和关系的属性
     */
    private bool $includeProperties = true;

    /**
     * API 端点.
     *
     * 图搜索服务的 API 端点
     */
    private string $apiEndpoint = '';

    /**
     * API 密钥.
     *
     * 访问图搜索服务的 API 密钥
     */
    private string $apiKey = '';

    /**
     * 超时时间（秒）.
     *
     * API 请求的超时时间，单位为秒
     */
    private float $timeout = 5.0;

    /**
     * 重试次数.
     *
     * API 请求失败时的重试次数
     */
    private int $retryCount = 3;

    /**
     * 关系类型.
     *
     * 搜索时考虑的关系类型列表，为空表示所有类型
     */
    private array $relationTypes = [];

    /**
     * 节点类型.
     *
     * 搜索时考虑的节点类型列表，为空表示所有类型
     */
    private array $nodeTypes = [];

    /**
     * 结果限制.
     *
     * 返回的最大结果数量
     */
    private int $limit = 10;

    /**
     * 获取关系权重.
     */
    public function getRelationWeight(): float
    {
        return $this->relationWeight;
    }

    /**
     * 设置关系权重.
     */
    public function setRelationWeight(float $relationWeight): self
    {
        if ($relationWeight < 0 || $relationWeight > 1) {
            throw new InvalidArgumentException('Relation weight must be between 0 and 1');
        }
        $this->relationWeight = $relationWeight;
        return $this;
    }

    /**
     * 获取最大搜索深度.
     */
    public function getMaxDepth(): int
    {
        return $this->maxDepth;
    }

    /**
     * 设置最大搜索深度.
     */
    public function setMaxDepth(int $maxDepth): self
    {
        if ($maxDepth < 1) {
            throw new InvalidArgumentException('Max depth must be greater than 0');
        }
        $this->maxDepth = $maxDepth;
        return $this;
    }

    /**
     * 是否包含属性.
     */
    public function isIncludeProperties(): bool
    {
        return $this->includeProperties;
    }

    /**
     * 设置是否包含属性.
     */
    public function setIncludeProperties(bool $includeProperties): self
    {
        $this->includeProperties = $includeProperties;
        return $this;
    }

    /**
     * 获取 API 端点.
     */
    public function getApiEndpoint(): string
    {
        return $this->apiEndpoint;
    }

    /**
     * 设置 API 端点.
     */
    public function setApiEndpoint(string $apiEndpoint): self
    {
        $this->apiEndpoint = $apiEndpoint;
        return $this;
    }

    /**
     * 获取 API 密钥.
     */
    public function getApiKey(): string
    {
        return $this->apiKey;
    }

    /**
     * 设置 API 密钥.
     */
    public function setApiKey(string $apiKey): self
    {
        $this->apiKey = $apiKey;
        return $this;
    }

    /**
     * 获取超时时间.
     */
    public function getTimeout(): float
    {
        return $this->timeout;
    }

    /**
     * 设置超时时间.
     */
    public function setTimeout(float $timeout): self
    {
        if ($timeout <= 0) {
            throw new InvalidArgumentException('Timeout must be greater than 0');
        }
        $this->timeout = $timeout;
        return $this;
    }

    /**
     * 获取重试次数.
     */
    public function getRetryCount(): int
    {
        return $this->retryCount;
    }

    /**
     * 设置重试次数.
     */
    public function setRetryCount(int $retryCount): self
    {
        if ($retryCount < 0) {
            throw new InvalidArgumentException('Retry count must be greater than or equal to 0');
        }
        $this->retryCount = $retryCount;
        return $this;
    }

    /**
     * 获取关系类型.
     */
    public function getRelationTypes(): array
    {
        return $this->relationTypes;
    }

    /**
     * 设置关系类型.
     */
    public function setRelationTypes(array $relationTypes): self
    {
        $this->relationTypes = $relationTypes;
        return $this;
    }

    /**
     * 获取节点类型.
     */
    public function getNodeTypes(): array
    {
        return $this->nodeTypes;
    }

    /**
     * 设置节点类型.
     */
    public function setNodeTypes(array $nodeTypes): self
    {
        $this->nodeTypes = $nodeTypes;
        return $this;
    }

    /**
     * 获取结果限制.
     */
    public function getLimit(): int
    {
        return $this->limit;
    }

    /**
     * 设置结果限制.
     */
    public function setLimit(int $limit): self
    {
        if ($limit < 1) {
            throw new InvalidArgumentException('Limit must be greater than 0');
        }
        $this->limit = $limit;
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
        $graphSearchConfig = new self();

        if (isset($config['relation_weight'])) {
            $graphSearchConfig->setRelationWeight($config['relation_weight']);
        }

        if (isset($config['max_depth'])) {
            $graphSearchConfig->setMaxDepth($config['max_depth']);
        }

        if (isset($config['include_properties'])) {
            $graphSearchConfig->setIncludeProperties($config['include_properties']);
        }

        if (isset($config['api_endpoint'])) {
            $graphSearchConfig->setApiEndpoint($config['api_endpoint']);
        }

        if (isset($config['api_key'])) {
            $graphSearchConfig->setApiKey($config['api_key']);
        }

        if (isset($config['timeout'])) {
            $graphSearchConfig->setTimeout($config['timeout']);
        }

        if (isset($config['retry_count'])) {
            $graphSearchConfig->setRetryCount($config['retry_count']);
        }

        if (isset($config['relation_types'])) {
            $graphSearchConfig->setRelationTypes($config['relation_types']);
        }

        if (isset($config['node_types'])) {
            $graphSearchConfig->setNodeTypes($config['node_types']);
        }

        if (isset($config['limit'])) {
            $graphSearchConfig->setLimit($config['limit']);
        }

        return $graphSearchConfig;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'relation_weight' => $this->relationWeight,
            'max_depth' => $this->maxDepth,
            'include_properties' => $this->includeProperties,
            'api_endpoint' => $this->apiEndpoint,
            'api_key' => $this->apiKey,
            'timeout' => $this->timeout,
            'retry_count' => $this->retryCount,
            'relation_types' => $this->relationTypes,
            'node_types' => $this->nodeTypes,
            'limit' => $this->limit,
        ];
    }
}
