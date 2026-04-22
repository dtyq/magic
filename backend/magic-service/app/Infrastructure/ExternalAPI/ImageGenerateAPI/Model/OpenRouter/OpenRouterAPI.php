<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\OpenRouter;

use App\Infrastructure\Util\Http\GuzzleClientFactory;
use GuzzleHttp\Exception\RequestException;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use RuntimeException;
use Throwable;

class OpenRouterAPI
{
    private const REQUEST_TIMEOUT = 300;

    protected LoggerInterface $logger;

    private string $apiKey;

    private string $baseUrl;

    private string $siteUrl;

    private string $siteName;

    private ?string $proxyUrl;

    public function __construct(
        string $apiKey,
        string $baseUrl,
        string $siteUrl = '',
        string $siteName = '',
        ?string $proxyUrl = null
    ) {
        $this->apiKey = $apiKey;
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->siteUrl = $siteUrl;
        $this->siteName = $siteName;
        $this->proxyUrl = $proxyUrl;
        $this->logger = di(LoggerFactory::class)->get(static::class);
    }

    /**
     * 发送图片生成请求.
     *
     * @param array $data 请求数据
     * @return array API响应结果
     */
    public function generateImage(array $data): array
    {
        $this->logger->info('OpenRouter API 请求', [
            'url' => $this->baseUrl,
            'payload' => $data,
        ]);

        try {
            $client = GuzzleClientFactory::createProxyClient(
                ['timeout' => self::REQUEST_TIMEOUT],
                $this->proxyUrl
            );

            $response = $client->post($this->baseUrl, [
                'headers' => [
                    'Authorization' => 'Bearer ' . $this->apiKey,
                    'HTTP-Referer' => $this->siteUrl,
                    'X-Title' => $this->siteName,
                    'Content-Type' => 'application/json',
                ],
                'json' => $data,
            ]);

            return $this->handleResponse($response);
        } catch (RequestException $e) {
            $this->handleException($e);
            throw $e;
        }
    }

    /**
     * 处理API响应.
     * @param mixed $response
     */
    private function handleResponse($response): array
    {
        $body = $response->getBody()->getContents();
        $data = json_decode($body, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new RuntimeException('Invalid JSON response from OpenRouter API');
        }

        if (isset($data['usage'])) {
            $this->logger->info('OpenRouter API usage', [
                'usage' => $data['usage'],
            ]);
        }
        return $data;
    }

    /**
     * 处理请求异常.
     */
    private function handleException(RequestException $e): void
    {
        $message = 'OpenRouter API request failed: ' . $e->getMessage();

        if ($e->hasResponse()) {
            try {
                $body = $e->getResponse()->getBody()->getContents();
                $data = json_decode($body, true);
                if (isset($data['error']['message'])) {
                    $message = 'OpenRouter API Error: ' . $data['error']['message'];
                } elseif (isset($data['error'])) {
                    $message = 'OpenRouter API Error: ' . (is_array($data['error']) ? json_encode($data['error']) : $data['error']);
                }
            } catch (Throwable $bodyException) {
                // 忽略解析错误，使用原始消息
            }
        }

        $this->logger->error($message, [
            'exception' => $e->getMessage(),
        ]);
    }
}
