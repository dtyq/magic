<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Hyperf\Odin\Api\Providers\Misc;

use GuzzleHttp\Psr7\Utils;
use Hyperf\Odin\Api\Providers\OpenAI\Client;
use Hyperf\Odin\Api\Request\EmbeddingRequest;
use Hyperf\Odin\Api\Response\EmbeddingResponse;
use Throwable;

class MiscClient extends Client
{
    public function embeddings(EmbeddingRequest $embeddingRequest): EmbeddingResponse
    {
        $embeddingRequest->validate();
        $options = $embeddingRequest->createOptions();

        $url = $this->buildEmbeddingsUrl();

        $this->logger?->info('EmbeddingsRequestRequest', ['url' => $url, 'options' => $options]);

        $startTime = microtime(true);

        try {
            $response = $this->client->post($url, $options);
            $endTime = microtime(true);
            $duration = round(($endTime - $startTime) * 1000); // 毫秒

            // 这里的 response 的 content 是 ['embedding' => '', 'count' => '']
            $content = json_decode($response->getBody()->getContents(), true);

            // 转换响应格式以兼容EmbeddingResponse
            $compatibleContent = [
                'object' => 'list',
                'data' => [],
                'model' => $embeddingRequest->getModel(),
                'usage' => [
                    'prompt_tokens' => $content['count'] ?? 0,
                    'total_tokens' => $content['count'] ?? 0,
                ],
            ];

            // 将单个embedding转换为EmbeddingResponse期望的数据结构
            if (isset($content['embedding'])) {
                $compatibleContent['data'][] = [
                    'object' => 'embedding',
                    'embedding' => $content['embedding'],
                    'index' => 0,
                ];
            }

            // 重新创建响应对象
            $responseBody = json_encode($compatibleContent);
            $response = $response->withBody(Utils::streamFor($responseBody));

            $embeddingResponse = new EmbeddingResponse($response, $this->logger);

            $this->logger?->info('EmbeddingsResponse', [
                'duration_ms' => $duration,
                'data' => $embeddingResponse->toArray(),
            ]);

            return $embeddingResponse;
        } catch (Throwable $e) {
            throw $this->convertException($e, [
                'url' => $url,
                'options' => $options,
                'mode' => 'embeddings',
                'api_options' => $this->requestOptions->toArray(),
            ]);
        }
    }

    protected function buildEmbeddingsUrl(): string
    {
        return $this->getBaseUri() . '/embedding';
    }
}
