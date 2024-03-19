<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\KnowledgeBase\Entity\ValueObject;

use App\Infrastructure\Core\AbstractValueObject;
use InvalidArgumentException;

/**
 * 重排序模型配置值对象
 *
 * 包含重排序模型的相关配置参数，如模型名称、提供商、API 端点等
 */
class RerankingModelConfig extends AbstractValueObject
{
    /**
     * 重排序模型名称.
     *
     * 例如：BAAI/bge-reranker-large
     */
    private string $rerankingModelName = '';

    /**
     * 重排序模型提供商名称.
     *
     * 例如：gitee_ai、openai 等
     */
    private string $rerankingProviderName = '';

    /**
     * API 端点.
     *
     * 重排序服务的 API 端点
     */
    private string $apiEndpoint = '';

    /**
     * API 密钥.
     *
     * 访问重排序服务的 API 密钥
     */
    private string $apiKey = '';

    /**
     * 超时时间（秒）.
     *
     * API 请求的超时时间，单位为秒
     */
    private float $timeout = 3.0;

    /**
     * 重试次数.
     *
     * API 请求失败时的重试次数
     */
    private int $retryCount = 2;

    /**
     * 返回的最大结果数量.
     *
     * 重排序后返回的最大结果数量
     */
    private int $topN = 3;

    /**
     * 批处理大小.
     *
     * 批量处理文档的大小，用于提高性能
     */
    private int $batchSize = 16;

    /**
     * 是否使用缓存.
     *
     * 是否缓存重排序结果，用于提高性能
     */
    private bool $useCache = true;

    /**
     * 缓存过期时间（秒）.
     *
     * 缓存的过期时间，单位为秒
     */
    private int $cacheTtl = 3600;

    /**
     * 获取重排序模型名称.
     */
    public function getRerankingModelName(): string
    {
        return $this->rerankingModelName;
    }

    /**
     * 设置重排序模型名称.
     */
    public function setRerankingModelName(string $rerankingModelName): self
    {
        $this->rerankingModelName = $rerankingModelName;
        return $this;
    }

    /**
     * 获取重排序模型提供商名称.
     */
    public function getRerankingProviderName(): string
    {
        return $this->rerankingProviderName;
    }

    /**
     * 设置重排序模型提供商名称.
     */
    public function setRerankingProviderName(string $rerankingProviderName): self
    {
        $this->rerankingProviderName = $rerankingProviderName;
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
     * 获取返回的最大结果数量.
     */
    public function getTopN(): int
    {
        return $this->topN;
    }

    /**
     * 设置返回的最大结果数量.
     */
    public function setTopN(int $topN): self
    {
        if ($topN < 1) {
            throw new InvalidArgumentException('TopN must be greater than 0');
        }
        $this->topN = $topN;
        return $this;
    }

    /**
     * 获取批处理大小.
     */
    public function getBatchSize(): int
    {
        return $this->batchSize;
    }

    /**
     * 设置批处理大小.
     */
    public function setBatchSize(int $batchSize): self
    {
        if ($batchSize < 1) {
            throw new InvalidArgumentException('Batch size must be greater than 0');
        }
        $this->batchSize = $batchSize;
        return $this;
    }

    /**
     * 是否使用缓存.
     */
    public function isUseCache(): bool
    {
        return $this->useCache;
    }

    /**
     * 设置是否使用缓存.
     */
    public function setUseCache(bool $useCache): self
    {
        $this->useCache = $useCache;
        return $this;
    }

    /**
     * 获取缓存过期时间.
     */
    public function getCacheTtl(): int
    {
        return $this->cacheTtl;
    }

    /**
     * 设置缓存过期时间.
     */
    public function setCacheTtl(int $cacheTtl): self
    {
        if ($cacheTtl < 0) {
            throw new InvalidArgumentException('Cache TTL must be greater than or equal to 0');
        }
        $this->cacheTtl = $cacheTtl;
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
        $rerankingModelConfig = new self();

        if (isset($config['reranking_model_name'])) {
            $rerankingModelConfig->setRerankingModelName($config['reranking_model_name']);
        }

        if (isset($config['reranking_provider_name'])) {
            $rerankingModelConfig->setRerankingProviderName($config['reranking_provider_name']);
        }

        if (isset($config['api_endpoint'])) {
            $rerankingModelConfig->setApiEndpoint($config['api_endpoint']);
        }

        if (isset($config['api_key'])) {
            $rerankingModelConfig->setApiKey($config['api_key']);
        }

        if (isset($config['timeout'])) {
            $rerankingModelConfig->setTimeout($config['timeout']);
        }

        if (isset($config['retry_count'])) {
            $rerankingModelConfig->setRetryCount($config['retry_count']);
        }

        if (isset($config['top_n'])) {
            $rerankingModelConfig->setTopN($config['top_n']);
        }

        if (isset($config['batch_size'])) {
            $rerankingModelConfig->setBatchSize($config['batch_size']);
        }

        if (isset($config['use_cache'])) {
            $rerankingModelConfig->setUseCache($config['use_cache']);
        }

        if (isset($config['cache_ttl'])) {
            $rerankingModelConfig->setCacheTtl($config['cache_ttl']);
        }

        return $rerankingModelConfig;
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'reranking_model_name' => $this->rerankingModelName,
            'reranking_provider_name' => $this->rerankingProviderName,
            'api_endpoint' => $this->apiEndpoint,
            'api_key' => $this->apiKey,
            'timeout' => $this->timeout,
            'retry_count' => $this->retryCount,
            'top_n' => $this->topN,
            'batch_size' => $this->batchSize,
            'use_cache' => $this->useCache,
            'cache_ttl' => $this->cacheTtl,
        ];
    }
}
