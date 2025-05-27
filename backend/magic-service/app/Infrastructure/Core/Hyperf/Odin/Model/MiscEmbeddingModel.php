<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Hyperf\Odin\Model;

use App\Infrastructure\Core\Hyperf\Odin\Api\Providers\Misc\Misc;
use App\Infrastructure\Core\Hyperf\Odin\Api\Request\MiscEmbeddingRequest;
use Hyperf\Odin\Api\Providers\OpenAI\Client;
use Hyperf\Odin\Api\Providers\OpenAI\OpenAIConfig;
use Hyperf\Odin\Api\RequestOptions\ApiOptions;
use Hyperf\Odin\Api\Response\EmbeddingResponse;
use Hyperf\Odin\Contract\Api\ClientInterface;
use Hyperf\Odin\Model\OpenAIModel;
use Psr\Log\LoggerInterface;
use Throwable;

class MiscEmbeddingModel extends OpenAIModel
{
    public function embeddings(array|string $input, ?string $encoding_format = 'float', ?string $user = null, array $businessParams = []): EmbeddingResponse
    {
        try {
            // 检查模型是否支持嵌入功能
            $this->checkEmbeddingSupport();

            $client = $this->getClient();
            $embeddingRequest = new MiscEmbeddingRequest(
                input: $input,
                model: $this->model
            );

            return $client->embeddings($embeddingRequest);
        } catch (Throwable $e) {
            $context = [
                'model' => $this->model,
                'input' => $input,
            ];
            throw $this->handleException($e, $context);
        }
    }

    protected function getClient(): ClientInterface
    {
        // 处理API基础URL，确保包含正确的版本路径
        $config = $this->config;
        $this->processApiBaseUrl($config);

        // 使用ClientFactory创建OpenAI客户端
        return $this->createClient(
            $config,
            $this->getApiRequestOptions(),
            $this->logger
        );
    }

    /**
     * 获取API版本路径.
     * OpenAI的API版本路径为 v1.
     */
    protected function getApiVersionPath(): string
    {
        return 'misc/v1';
    }

    private function createClient(array $config, ApiOptions $apiOptions, LoggerInterface $logger): Client
    {
        // 验证必要的配置参数
        $apiKey = $config['api_key'] ?? '';
        $baseUrl = $config['base_url'] ?? '';

        // 创建配置对象
        $clientConfig = new OpenAIConfig(
            apiKey: $apiKey,
            organization: '',
            baseUrl: $baseUrl
        );

        // 创建API实例
        $misc = new Misc();

        // 创建客户端
        return $misc->getClient($clientConfig, $apiOptions, $logger);
    }
}
