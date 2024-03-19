<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\WebScrape;

use Exception;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Exception\RequestException;
use Hyperf\Codec\Json;
use InvalidArgumentException;
use RuntimeException;

/**
 * Cloudsway 网页爬取实现.
 */
class CloudswayWebScrape extends AbstractWebScrape
{
    private string $requestUrl;

    private string $apiKey;

    /**
     * 配置Cloudsway平台参数.
     *
     * @param array $config 配置数组，包含 request_url, api_key
     */
    public function configure(array $config): void
    {
        $this->requestUrl = $config['request_url'] ?? '';
        $this->apiKey = $config['api_key'] ?? '';

        if (isset($config['timeout'])) {
            $this->setTimeout((int) $config['timeout']);
        }

        // 验证必需配置
        if (empty($this->requestUrl) || empty($this->apiKey)) {
            throw new InvalidArgumentException('Missing required configuration: request_url or api_key');
        }
    }

    public function getPlatformName(): string
    {
        return 'cloudsway';
    }

    /**
     * 爬取网页内容.
     *
     * @throws GuzzleException
     */
    public function scrape(string $url, array $formats, string $mode, array $options = []): WebScrapeResponse
    {
        // 验证请求参数
        $this->validateRequest($url, $formats);

        // 直接使用 request_url（已包含完整路径）
        $endpoint = $this->requestUrl;

        // 构建请求体
        $requestBody = [
            'url' => $url,
            'formats' => ['MARKDOWN'],
            'mode' => $mode,
        ];

        // 合并其他可选参数
        if (! empty($options)) {
            $requestBody = array_merge($requestBody, $options);
        }

        $this->logRequest($url, $requestBody);

        try {
            $startTime = microtime(true);

            // 发送POST请求（自动拼接 Bearer 前缀）
            $response = $this->httpClient->request('POST', $endpoint, [
                'headers' => [
                    'Authorization' => 'Bearer ' . $this->apiKey,
                    'Content-Type' => 'application/json',
                ],
                'json' => $requestBody,
            ]);

            $duration = (int) ((microtime(true) - $startTime) * 1000);

            // 获取响应内容
            $body = $response->getBody()->getContents();
            $data = Json::decode($body);

            $this->logResponse($url, true);

            // 构建元数据
            $metadata = [
                'duration_ms' => $duration,
                'status_code' => $response->getStatusCode(),
            ];

            // 返回成功响应
            return WebScrapeResponse::success(
                url: $url,
                content: $data,
                provider: $this->getPlatformName(),
                formats: $formats,
                metadata: $metadata
            );
        } catch (RequestException $e) {
            $error = 'Request failed';
            $statusCode = 0;

            if ($e->hasResponse()) {
                $statusCode = $e->getResponse()?->getStatusCode() ?? 0;
                $reason = $e->getResponse()?->getReasonPhrase();
                $responseBody = $e->getResponse()?->getBody()->getContents();

                $error = sprintf('HTTP %d %s: %s', $statusCode, $reason, $responseBody);

                $this->logger->error('Cloudsway WebScrape failed', [
                    'url' => $url,
                    'endpoint' => $endpoint,
                    'statusCode' => $statusCode,
                    'response' => $responseBody,
                ]);
            } else {
                $error = $e->getMessage();
                $this->logger->error('Cloudsway WebScrape network error', [
                    'url' => $url,
                    'endpoint' => $endpoint,
                    'error' => $error,
                ]);
            }

            $this->logResponse($url, false, $error);

            throw new RuntimeException("WebScrape error: {$error}");
        } catch (Exception $e) {
            $error = $e->getMessage();
            $this->logger->error('Cloudsway WebScrape exception', [
                'url' => $url,
                'error' => $error,
                'trace' => $e->getTraceAsString(),
            ]);

            $this->logResponse($url, false, $error);

            throw new RuntimeException("WebScrape error: {$error}");
        }
    }
}
