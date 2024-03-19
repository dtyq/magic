<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Flux;

use App\Infrastructure\Util\Http\GuzzleClientFactory;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

class FluxAPI
{
    // 请求超时时间（秒）
    protected const REQUEST_TIMEOUT = 30;

    protected string $apiKey;

    protected string $baseUrl;

    protected ?string $proxyUrl;

    protected LoggerInterface $logger;

    public function __construct(
        string $apiKey,
        ?string $baseUrl = null,
        ?string $proxyUrl = null
    ) {
        $this->apiKey = $apiKey;
        $this->baseUrl = $baseUrl ?? \Hyperf\Config\config('image_generate.flux.host');
        $this->proxyUrl = $proxyUrl;
        $this->logger = di(LoggerFactory::class)->get(static::class);
    }

    /**
     * 设置 API Key.
     */
    public function setApiKey(string $apiKey): void
    {
        $this->apiKey = $apiKey;
    }

    /**
     * 设置 API 基础 URL.
     */
    public function setBaseUrl(string $baseUrl): void
    {
        $this->baseUrl = $baseUrl;
    }

    /**
     * 提交图片生成任务
     */
    public function submitTask(string $prompt, string $size, string $mode = 'flux1-dev'): array
    {
        $payload = [
            'prompt' => $prompt,
            'size' => $size,
            'mode' => $mode,
        ];

        $this->logger->info('Flux API 请求', [
            'payload' => $payload,
        ]);

        $client = GuzzleClientFactory::createProxyClient(
            ['timeout' => self::REQUEST_TIMEOUT],
            $this->proxyUrl
        );

        $response = $client->post($this->baseUrl . '/flux/generate', [
            'headers' => [
                'TT-API-KEY' => $this->apiKey,
                'Content-Type' => 'application/json',
            ],
            'json' => $payload,
        ]);

        return Json::decode($response->getBody()->getContents());
    }

    /**
     * 查询任务结果.
     */
    public function getTaskResult(string $jobId): array
    {
        $payload = [
            'jobId' => $jobId,
        ];

        $this->logger->info('Flux API 请求', [
            'payload' => $payload,
        ]);

        $client = GuzzleClientFactory::createProxyClient(
            ['timeout' => self::REQUEST_TIMEOUT],
            $this->proxyUrl
        );

        $response = $client->post($this->baseUrl . '/flux/fetch', [
            'headers' => [
                'TT-API-KEY' => $this->apiKey,
                'Content-Type' => 'application/json',
            ],
            'json' => $payload,
        ]);

        return Json::decode($response->getBody()->getContents());
    }

    /**
     * 获取账户信息.
     */
    public function getAccountInfo(): array
    {
        $client = GuzzleClientFactory::createProxyClient([], $this->proxyUrl);

        $response = $client->get($this->baseUrl . '/midjourney/v1/info', [
            'headers' => [
                'TT-API-KEY' => $this->apiKey,
                'Accept' => '*/*',
                'User-Agent' => 'Magic-Service/1.0',
            ],
        ]);

        return Json::decode($response->getBody()->getContents());
    }
}
