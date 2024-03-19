<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\MiracleVision;

use App\Infrastructure\Util\Http\GuzzleClientFactory;
use DateTime;
use DateTimeZone;
use Exception;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Psr7\Request;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;

class MiracleVisionAPI
{
    private const REQUEST_TIMEOUT = 150;

    protected LoggerInterface $logger;

    private string $key;

    private string $secret;

    private string $baseUrl;

    private string $queryUrl;

    private Signer $signer;

    private ?string $proxyUrl;

    public function __construct(
        string $key,
        string $secret,
        ?string $proxyUrl = null
    ) {
        $this->key = $key;
        $this->secret = $secret;
        $this->baseUrl = 'https://openapi.meitu.com/whee/business/image_magicsr.json';
        $this->queryUrl = 'https://openapi.meitu.com/api/v1/sdk/status';
        $this->signer = new Signer($this->key, $this->secret);
        $this->proxyUrl = $proxyUrl;
        $this->logger = di(LoggerFactory::class)->get(static::class);
    }

    /**
     * 获取美图超清转换支持的样式列表.
     */
    public function getStyle(): array
    {
        $request = $this->createSignedRequest(
            'https://openapi.meitu.com/whee/business/magicsr_config.json',
            'GET'
        );

        return $this->sendRequest($request);
    }

    /**
     * 设置 API 密钥.
     */
    public function setSecret(string $secret): void
    {
        $this->secret = $secret;
        $this->signer = new Signer($this->key, $this->secret);
    }

    /**
     * 设置 API Key.
     */
    public function setKey(string $key): void
    {
        $this->key = $key;
        $this->signer = new Signer($this->key, $this->secret);
    }

    /**
     * 查询任务状态
     */
    public function queryTask(string $taskId): array
    {
        $request = $this->createSignedRequest(
            $this->queryUrl . '?task_id=' . $taskId,
            'GET'
        );

        return $this->sendRequest($request);
    }

    /**
     * 提交图片转换任务
     */
    public function submitTask(string $imageUrl, int $styleId): array
    {
        $body = [
            'task' => '/v1/dlbeautymagicsr_async',
            'task_type' => 'mtlab',
            'init_images' => [['url' => $imageUrl]],
            'sync_timeout' => -1,
            'params' => Json::encode([
                'style_id' => 26,
                'sr_num' => 2,
            ]),
        ];

        $this->logger->info('MiracleVision API 请求', [
            'payload' => $body,
        ]);

        $request = $this->createSignedRequest(
            $this->baseUrl,
            'POST',
            [],
            Json::encode($body)
        );

        return $this->sendRequest($request);
    }

    /**
     * 创建带签名的请求
     */
    private function createSignedRequest(string $url, string $method, array $headers = [], string $body = ''): Request
    {
        $defaultHeaders = [
            'Content-Type' => 'application/json',
            'Host' => 'openapi.meitu.com',
            'X-Sdk-Date' => (new DateTime('now', new DateTimeZone('UTC')))->format(BasicDateFormat),
        ];

        return $this->signer->getSignedRequest(
            $url,
            $method,
            array_merge($defaultHeaders, $headers),
            $body
        );
    }

    /**
     * 发送请求并返回响应.
     *
     * @throws GuzzleException
     * @throws Exception
     */
    private function sendRequest(Request $request): array
    {
        $client = GuzzleClientFactory::createProxyClient(
            [
                'timeout' => self::REQUEST_TIMEOUT,
                'http_errors' => false,
            ],
            $this->proxyUrl
        );

        $response = $client->send($request);
        $content = $response->getBody()->getContents();

        if ($response->getStatusCode() !== 200) {
            throw new Exception('API request failed with status code: ' . $response->getStatusCode());
        }

        return Json::decode($content);
    }
}
