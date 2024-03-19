<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Qwen;

use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Http\GuzzleClientFactory;
use Exception;
use GuzzleHttp\Exception\GuzzleException;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

class QwenImageAPI
{
    private const REQUEST_TIMEOUT = 120;

    protected LoggerInterface $logger;

    private string $base_url;

    private string $apiKey;

    private ?string $proxyUrl;

    public function __construct(
        string $apiKey,
        ?string $baseUrl = null,
        ?string $proxyUrl = null
    ) {
        $this->apiKey = $apiKey;
        $this->proxyUrl = $proxyUrl;

        if (empty($baseUrl)) {
            $baseUrl = 'https://dashscope.aliyuncs.com/api/v1';
        }

        if (str_ends_with($baseUrl, '/api/v1')) {
            $baseUrl .= '/services/aigc/multimodal-generation/generation';
        }

        $this->base_url = $baseUrl;
        $this->logger = di(LoggerFactory::class)->get(static::class);
    }

    /**
     * 同步生成图片.
     */
    public function generateImage(array $payload): array
    {
        $headers = [
            'Authorization' => 'Bearer ' . $this->apiKey,
            'Content-Type' => 'application/json',
        ];

        $this->logger->info('Qwen Image API 请求', [
            'base_url' => $this->base_url,
            'payload' => $payload,
        ]);

        try {
            $client = GuzzleClientFactory::createProxyClient(
                ['timeout' => self::REQUEST_TIMEOUT, 'verify' => false],
                $this->proxyUrl
            );

            $response = $client->post($this->base_url, [
                'headers' => $headers,
                'json' => $payload,
            ]);

            $responseBody = $response->getBody()->getContents();

            $this->logger->info('Qwen Image API 响应', [
                'payload' => $responseBody,
            ]);

            return Json::decode($responseBody, true);
        } catch (GuzzleException $e) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, $e->getMessage());
        } catch (Exception $e) {
            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, $e->getMessage());
        }
    }

    public function setApiKey(string $apiKey): void
    {
        $this->apiKey = $apiKey;
    }
}
