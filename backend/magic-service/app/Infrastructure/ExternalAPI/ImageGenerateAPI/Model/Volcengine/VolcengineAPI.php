<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Volcengine;

use Exception;
use Hyperf\Codec\Json;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Volc\Service\Visual;

class VolcengineAPI
{
    protected LoggerInterface $logger;

    private string $ak;

    private string $sk;

    private Visual $client;

    public function __construct(string $ak, string $sk)
    {
        $this->ak = $ak;
        $this->sk = $sk;
        $this->client = Visual::getInstance();
        $this->client->setAccessKey($this->ak);
        $this->client->setSecretKey($this->sk);
        $this->logger = di(LoggerFactory::class)->get(static::class);
    }

    /**
     * 设置 Access Key.
     */
    public function setAk(string $ak): void
    {
        $this->ak = $ak;
        $this->client->setAccessKey($this->ak);
    }

    /**
     * 设置 Secret Key.
     */
    public function setSk(string $sk): void
    {
        $this->sk = $sk;
        $this->client->setSecretKey($this->sk);
    }

    /**
     * 提交异步任务
     */
    public function submitTask(array $body): array
    {
        $this->logger->info('Volcengine API 请求', [
            'payload' => $body,
        ]);

        $response = $this->client->CVSync2AsyncSubmitTask(['json' => $body]);
        $responseBody = Json::decode(str_replace('\u0026', '&', (string) $response));
        if (! isset($responseBody['code']) || $responseBody['code'] !== 10000) {
            throw new Exception(Json::encode($responseBody));
        }

        return $responseBody;
    }

    /**
     * 查询任务结果.
     */
    public function getTaskResult(array $params): array
    {
        $this->logger->info('Volcengine API 请求', [
            'payload' => $params,
        ]);

        $response = $this->client->CVSync2AsyncGetResult(['json' => $params]);
        $responseBody = Json::decode(str_replace('\u0026', '&', (string) $response));

        if ($responseBody['code'] !== 10000) {
            throw new Exception($responseBody['message']);
        }
        return $responseBody;
    }
}
