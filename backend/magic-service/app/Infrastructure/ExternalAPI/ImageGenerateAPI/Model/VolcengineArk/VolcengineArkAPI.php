<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\VolcengineArk;

use App\Infrastructure\Util\Http\GuzzleClientFactory;
use Exception;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

class VolcengineArkAPI
{
    protected const REQUEST_TIMEOUT = 300;

    protected const API_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

    protected string $apiKey;

    protected string $baseUrl;

    protected ?string $proxyUrl;

    protected LoggerInterface $logger;

    public function __construct(
        string $apiKey,
        string $baseUrl = self::API_ENDPOINT,
        ?string $proxyUrl = null
    ) {
        $this->apiKey = $apiKey;
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->proxyUrl = $proxyUrl;
        $this->logger = di(LoggerFactory::class)->get(static::class);
    }

    public function setApiKey(string $apiKey): void
    {
        $this->apiKey = $apiKey;
    }

    /**
     * 生成图像 - 完全透传payload给API.
     */
    public function generateImage(array $payload): array
    {
        return $this->makeRequest($payload);
    }

    /**
     * 发送 HTTP 请求.
     */
    protected function makeRequest(array $payload): array
    {
        $headers = [
            'Content-Type' => 'application/json',
            'Authorization' => 'Bearer ' . $this->apiKey,
        ];

        $this->logger->info('VolcengineArk API 请求', [
            'payload' => $payload,
        ]);

        $client = GuzzleClientFactory::createProxyClient(
            ['timeout' => self::REQUEST_TIMEOUT],
            $this->proxyUrl
        );

        $response = $client->post($this->baseUrl, [
            'headers' => $headers,
            'json' => $payload,
        ]);

        $result = Json::decode($response->getBody()->getContents());

        if ($response->getStatusCode() !== 200) {
            $errorMessage = $result['error']['message'] ?? "HTTP 错误: {$response->getStatusCode()}";
            throw new Exception("VolcengineArk API 请求失败: {$errorMessage}");
        }

        if (isset($result['error'])) {
            $errorMessage = $result['error']['message'] ?? 'Unknown error';
            $errorCode = $result['error']['code'] ?? 'unknown_error';
            throw new Exception("VolcengineArk API 错误 [{$errorCode}]: {$errorMessage}");
        }

        return $result;
    }
}
