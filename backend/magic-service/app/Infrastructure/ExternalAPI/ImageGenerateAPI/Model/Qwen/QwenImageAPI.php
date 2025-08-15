<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\ImageGenerateAPI\Model\Qwen;

use App\ErrorCode\ImageGenerateErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Exception;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Hyperf\Codec\Json;
use Psr\Log\LoggerInterface;

class QwenImageAPI
{
    private const BASE_URL = 'https://dashscope.aliyuncs.com/api/v1';

    private const TASK_CREATE_ENDPOINT = '/services/aigc/text2image/image-synthesis';

    private const TASK_QUERY_ENDPOINT = '/tasks/%s';

    private string $apiKey;

    private Client $client;

    private LoggerInterface $logger;

    public function __construct(string $apiKey, LoggerInterface $logger)
    {
        $this->apiKey = $apiKey;
        $this->logger = $logger;
        $this->client = new Client([
            'timeout' => 30,
            'verify' => false,
        ]);
    }

    /**
     * 提交文生图任务
     */
    public function submitTask(array $params): array
    {
        $url = self::BASE_URL . self::TASK_CREATE_ENDPOINT;

        $headers = [
            'Authorization' => 'Bearer ' . $this->apiKey,
            'Content-Type' => 'application/json',
            'X-DashScope-Async' => 'enable',
        ];

        $body = [
            'model' => $params['model'],
            'input' => [
                'prompt' => $params['prompt'],
            ],
            'parameters' => [],
        ];

        // 设置可选参数
        if (isset($params['size'])) {
            $body['parameters']['size'] = $params['size'];
        }

        if (isset($params['n'])) {
            $body['parameters']['n'] = $params['n'];
        }

        if (isset($params['prompt_extend'])) {
            $body['parameters']['prompt_extend'] = $params['prompt_extend'];
        }

        if (isset($params['watermark'])) {
            $body['parameters']['watermark'] = $params['watermark'];
        }

        try {
            $this->logger->info('通义千问文生图：提交任务', [
                'url' => $url,
                'prompt' => $params['prompt'],
                'parameters' => $body['parameters'],
            ]);

            $response = $this->client->post($url, [
                'headers' => $headers,
                'json' => $body,
            ]);

            $responseBody = $response->getBody()->getContents();
            $result = Json::decode($responseBody, true);

            $this->logger->info('通义千问文生图：提交任务响应', [
                'status' => $response->getStatusCode(),
                'response' => $result,
            ]);

            return $result;
        } catch (GuzzleException $e) {
            $this->logger->error('通义千问文生图：提交任务HTTP异常', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, $e->getMessage());
        } catch (Exception $e) {
            $this->logger->error('通义千问文生图：提交任务异常', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, $e->getMessage());
        }
    }

    /**
     * 查询任务结果.
     */
    public function getTaskResult(string $taskId): array
    {
        $url = self::BASE_URL . sprintf(self::TASK_QUERY_ENDPOINT, $taskId);

        $headers = [
            'Authorization' => 'Bearer ' . $this->apiKey,
        ];

        try {
            $this->logger->info('通义千问文生图：查询任务结果', [
                'url' => $url,
                'task_id' => $taskId,
            ]);

            $response = $this->client->get($url, [
                'headers' => $headers,
            ]);

            $responseBody = $response->getBody()->getContents();
            $result = Json::decode($responseBody, true);

            $this->logger->info('通义千问文生图：查询任务结果响应', [
                'status' => $response->getStatusCode(),
                'task_id' => $taskId,
                'response' => $result,
            ]);

            return $result;
        } catch (GuzzleException $e) {
            $this->logger->error('通义千问文生图：查询任务HTTP异常', [
                'task_id' => $taskId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, $e->getMessage());
        } catch (Exception $e) {
            $this->logger->error('通义千问文生图：查询任务异常', [
                'task_id' => $taskId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            ExceptionBuilder::throw(ImageGenerateErrorCode::GENERAL_ERROR, $e->getMessage());
        }
    }

    public function setApiKey(string $apiKey): void
    {
        $this->apiKey = $apiKey;
    }

    public function getApiKey(): string
    {
        return $this->apiKey;
    }
}
