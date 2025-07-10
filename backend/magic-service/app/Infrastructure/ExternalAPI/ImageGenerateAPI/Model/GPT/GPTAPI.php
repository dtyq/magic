<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\GPT;

use GuzzleHttp\Client;
use Hyperf\Codec\Json;

class GPTAPI
{
    // 请求超时时间（秒）
    protected const REQUEST_TIMEOUT = 300;

    protected string $apiKey;

    protected string $baseUrl;

    public function __construct(string $apiKey, ?string $baseUrl = null)
    {
        $this->apiKey = $apiKey;
        $this->baseUrl = $baseUrl ?? \Hyperf\Config\config('image_generate.gpt4o.host');
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
     * 获取账户信息.
     */
    public function getAccountInfo(): array
    {
        $client = new Client();
        $response = $client->get($this->baseUrl . '/midjourney/v1/info', [
            'headers' => [
                'TT-API-KEY' => $this->apiKey,
                'Accept' => '*/*',
                'User-Agent' => 'Magic-Service/1.0',
            ],
        ]);

        return Json::decode($response->getBody()->getContents());
    }

    /**
     * 提交GPT4o图片生成任务
     */
    public function submitGPT4oTask(string $prompt, array $referImages = [], ?string $hookUrl = null): array
    {
        $client = new Client(['timeout' => self::REQUEST_TIMEOUT]);
        $response = $client->post($this->baseUrl . '/openai/4o-image/generations', [
            'headers' => [
                'TT-API-KEY' => $this->apiKey,
                'Content-Type' => 'application/json',
            ],
            'json' => array_filter([
                'prompt' => $prompt,
                'referImages' => $referImages,
                'hookUrl' => $hookUrl,
            ]),
        ]);

        return Json::decode($response->getBody()->getContents());
    }

    /**
     * 查询GPT4o任务结果.
     */
    public function getGPT4oTaskResult(string $jobId): array
    {
        $client = new Client(['timeout' => self::REQUEST_TIMEOUT]);
        $response = $client->post($this->baseUrl . '/openai/4o-image/fetch', [
            'headers' => [
                'TT-API-KEY' => $this->apiKey,
                'Content-Type' => 'application/json',
            ],
            'json' => [
                'jobId' => $jobId,
            ],
        ]);

        return Json::decode($response->getBody()->getContents());
    }
}
