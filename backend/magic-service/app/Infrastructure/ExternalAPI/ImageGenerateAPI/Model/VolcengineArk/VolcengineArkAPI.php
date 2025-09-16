<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\VolcengineArk;

use Exception;
use GuzzleHttp\Client;
use Hyperf\Codec\Json;

class VolcengineArkAPI
{
    protected const REQUEST_TIMEOUT = 300;

    protected const API_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';

    protected string $apiKey;

    protected string $baseUrl;

    public function __construct(string $apiKey, string $baseUrl = self::API_ENDPOINT)
    {
        $this->apiKey = $apiKey;
        $this->baseUrl = rtrim($baseUrl, '/');
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

        $client = new Client(['timeout' => self::REQUEST_TIMEOUT]);

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
