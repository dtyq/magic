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
    private const int DEFAULT_SEARCH_ENGINE_TIMEOUT = 30;

    private LoggerInterface $logger;

    public function __construct(LoggerFactory $loggerFactory)
    {
        $this->logger = $loggerFactory->get(get_class($this));
    }

    /**
     * Execute Bing search with comprehensive parameters.
     *
     * @param string $query Search query
     * @param string $subscriptionKey Bing API subscription key
     * @param string $mkt Market code (e.g., zh-CN, en-US)
     * @param int $count Number of results (1-50)
     * @param int $offset Pagination offset (0-1000)
     * @param string $safeSearch Safe search level (Strict, Moderate, Off)
     * @param string $freshness Time filter (Day, Week, Month)
     * @param string $setLang UI language code
     * @return array Native Bing API response
     * @throws GuzzleException
     */
    public function search(
        string $query,
        string $subscriptionKey,
        string $mkt,
        int $count = 20,
        int $offset = 0,
        string $safeSearch = '',
        string $freshness = '',
        string $setLang = '',
        string $requestUrl = ''
    ): array {
        /*
         * 使用 bing 搜索并返回上下文。
         */
        if (empty($requestUrl)) {
            $requestUrl = trim(config('search.drivers.bing.endpoint'));
        }
        // 确保 endpoint 以 /search 结尾
        if (! str_ends_with($requestUrl, '/search')) {
            $requestUrl = rtrim($requestUrl, '/') . '/search';
        }

        // 构建基础查询参数
        $queryParams = [
            'q' => $query,
            'mkt' => $mkt,
            'count' => $count,
            'offset' => $offset,
        ];

        // 添加可选参数
        if (! empty($safeSearch)) {
            $queryParams['safeSearch'] = $safeSearch;
        }

        if (! empty($freshness)) {
            $queryParams['freshness'] = $freshness;
        }

        if (! empty($setLang)) {
            $queryParams['setLang'] = $setLang;
        }

        // 创建 Guzzle 客户端配置
        $clientConfig = [
            'base_uri' => $requestUrl,
            'timeout' => self::DEFAULT_SEARCH_ENGINE_TIMEOUT,
            'headers' => [
                'Ocp-Apim-Subscription-Key' => $subscriptionKey,
                'Accept-Language' => $mkt,
            ],
        ];

        $attempt = 0;
        $maxAttempts = 2; // 原始请求 + 1次重试

        while ($attempt < $maxAttempts) {
            try {
                // 如果是重试(第二次尝试)，禁用SSL验证
                if ($attempt !== 0) {
                    $clientConfig['verify'] = false;
                    $this->logger->warning('Retrying request with SSL verification disabled', [
                        'endpoint' => $requestUrl,
                        'attempt' => $attempt + 1,
                    ]);
                }

                $client = new Client($clientConfig);

                // 发送 GET 请求
                $response = $client->request('GET', '', [
                    'query' => $queryParams,
                ]);

                // 获取响应体内容
                $body = $response->getBody()->getContents();

                // 如果需要将 JSON 转换为数组或对象，可以使用 json_decode
                // 请求成功，返回数据
                return Json::decode($body);
            } catch (RequestException $e) {
                // 如果有响应，说明是HTTP错误(4xx, 5xx等)，不重试
                if ($e->hasResponse()) {
                    $statusCode = $e->getResponse()?->getStatusCode();
                    $reason = $e->getResponse()?->getReasonPhrase();
                    $responseBody = $e->getResponse()?->getBody()->getContents();
                    $this->logger->error(sprintf('Bing search error HTTP %d %s: %s', $statusCode, $reason, $responseBody), [
                        'endpoint' => $requestUrl,
                        'statusCode' => $statusCode,
                    ]);
                    break; // HTTP错误不重试，直接跳出循环
                }
                $this->logger->warning('Network error occurred', [
                    'endpoint' => $requestUrl,
                    'error' => $e->getMessage(),
                    'exception' => get_class($e),
                ]);

                ++$attempt;
            }
        }

        // 如果走到这里，说明所有尝试都失败了
        throw new RuntimeException('Search engine error.');
    }
}
