<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\MiniMax\Transport;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\ErrorCode\VideoGenerateErrorCode;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\MiniMax\MiniMaxVideoClient;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\ProviderVideoException;

readonly class ApiKeyMiniMaxTransport
{
    // 连通性测试主动传入 duration=0，命中该校验错误即说明 API 与鉴权链路可用。
    private const string CONNECTIVITY_SUCCESS_MESSAGE = 'does not support duration 0s';

    public function __construct(private MiniMaxVideoClient $client)
    {
    }

    /**
     * 提交 MiniMax 视频生成请求。
     */
    public function submit(QueueExecutorConfig $config, array $payload): array
    {
        return $this->client->request('POST', $config->getBaseUrl(), $config->getApiKey(), '/video_generation', $payload);
    }

    /**
     * 查询 MiniMax 视频生成任务状态。
     */
    public function query(QueueExecutorConfig $config, string $taskId): array
    {
        return $this->client->request(
            'GET',
            $config->getBaseUrl(),
            $config->getApiKey(),
            '/query/video_generation/' . rawurlencode($taskId),
            [],
        );
    }

    /**
     * 执行连通性测试。
     *
     * 通过非法时长触发 MiniMax 参数校验，只有命中预期错误信息才视为连通成功。
     */
    public function testConnection(QueueExecutorConfig $config, string $modelVersion): bool
    {
        try {
            $this->submit($config, $this->buildConnectivityPayload($modelVersion));
        } catch (ProviderVideoException $exception) {
            // 只有预期的参数校验错误视为连通成功，其余异常原样抛出，由上层转成错误信息。
            if (str_contains($exception->getMessage(), self::CONNECTIVITY_SUCCESS_MESSAGE)) {
                return true;
            }

            throw $exception;
        }

        // 未返回预期校验错误说明请求可能被接受，不能视为连通性测试成功。
        throw new ProviderVideoException(VideoGenerateErrorCode::INVALID_PARAMETER, 'MiniMax connectivity test did not receive the expected validation error');
    }

    /**
     * 构造连通性测试请求体，duration=0 用于避免创建真实视频任务。
     */
    private function buildConnectivityPayload(string $modelVersion): array
    {
        // duration=0 是非法时长，用于触发 MiniMax 参数校验，避免创建真实视频任务。
        return [
            'model' => $modelVersion,
            'content' => [['type' => 'text', 'text' => 'connectivity-test']],
            'resolution' => '1080p',
            'duration' => 0,
            'ratio' => '1:1',
        ];
    }
}
