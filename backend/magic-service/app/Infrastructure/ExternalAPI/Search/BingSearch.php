<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\Search;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Exception\RequestException;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;

use function Hyperf\Config\config;

class BingSearch
{
    private const int DEFAULT_SEARCH_ENGINE_TIMEOUT = 5;

    private LoggerInterface $logger;

    public function __construct(LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * @throws GuzzleException
     */
    public function search(string $query, string $subscriptionKey, string $mkt): array
    {
        /*
         * 使用 bing 搜索并返回上下文。
         */

        $endpoint = trim(config('search.bing.endpoint'));

        // 确保 endpoint 以 /search 结尾
        if (! str_ends_with($endpoint, '/search')) {
            $endpoint = rtrim($endpoint, '/') . '/search';
        }

        $queryParams = [
            'q' => $query,
            'mkt' => $mkt,
            'count' => 20,
            'offset' => 0,
        ];

        // 创建 Guzzle 客户端
        $client = new Client([
            'base_uri' => $endpoint,
            'timeout' => self::DEFAULT_SEARCH_ENGINE_TIMEOUT,
            'headers' => [
                'Ocp-Apim-Subscription-Key' => $subscriptionKey,
                'Accept-Language' => $mkt,
            ],
        ]);

        try {
            // 发送 GET 请求
            $response = $client->request('GET', '', [
                'query' => $queryParams,
            ]);

            // 获取响应体内容
            $body = $response->getBody()->getContents();

            // 如果需要将 JSON 转换为数组或对象，可以使用 json_decode
            $data = Json::decode($body);
        } catch (RequestException $e) {
            // 如果有响应，可以获取响应状态码和内容
            if ($e->hasResponse()) {
                $statusCode = $e->getResponse()?->getStatusCode();
                $reason = $e->getResponse()?->getReasonPhrase();
                $responseBody = $e->getResponse()?->getBody()->getContents();
                $this->logger->error(sprintf('HTTP %d %s: %s', $statusCode, $reason, $responseBody), [
                    'endpoint' => $endpoint,
                    'query' => $queryParams,
                    'statusCode' => $statusCode,
                ]);
            } else {
                // 如果没有响应，如网络错误
                $this->logger->error($e->getMessage(), [
                    'endpoint' => $endpoint,
                    'query' => $queryParams,
                    'exception' => get_class($e),
                ]);
            }

            throw new RuntimeException('Search engine error.');
        }

        return $data;
    }
}
