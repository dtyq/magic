<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\WebSocket;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\Config\WebSocketConfig;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\WebSocket\Exception\WebSocketConnectionException;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\WebSocket\Exception\WebSocketTimeoutException;
use Psr\Log\LoggerInterface;
use Throwable;

class WebSocketSession
{
    private WebSocketClient $client;

    private int $lastMessageTime;

    public function __construct(
        private readonly WebSocketConfig $config,
        private readonly LoggerInterface $logger,
        private readonly string $wsUrl,
        private readonly string $taskId,
        private readonly ?string $token = null
    ) {
        $this->client = new WebSocketClient($config, $logger, $wsUrl, $taskId, $token);
        $this->lastMessageTime = time();
    }

    /**
     * 建立WebSocket连接.
     *
     * @throws WebSocketConnectionException 连接失败时抛出
     */
    public function connect(): void
    {
        try {
            $this->client->connect();
            $this->logger->info(sprintf(
                'WebSocket连接成功，任务ID: %s，URL: %s',
                $this->taskId,
                $this->wsUrl
            ));
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                'WebSocket连接失败: %s，任务ID: %s',
                $e->getMessage(),
                $this->taskId
            ));
            throw $e;
        }
    }

    /**
     * 断开WebSocket连接.
     */
    public function disconnect(): void
    {
        try {
            $this->client->disconnect();
            $this->logger->info(sprintf(
                'WebSocket断开连接，任务ID: %s',
                $this->taskId
            ));
        } catch (Throwable $e) {
            $this->logger->warning(sprintf(
                'WebSocket断开连接失败，任务ID: %s，错误: %s',
                $this->taskId,
                $e->getMessage()
            ));
        }
    }

    /**
     * 发送WebSocket消息.
     *
     * @param array $data 要发送的消息数据
     * @throws WebSocketConnectionException 发送失败时抛出
     */
    public function send(array $data): void
    {
        try {
            $this->client->send($data);
            $this->lastMessageTime = time();
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                '发送消息失败: %s，任务ID: %s',
                $e->getMessage(),
                $this->taskId
            ));
            throw $e;
        }
    }

    /**
     * 接收WebSocket消息，支持超时和自动重连.
     *
     * @param int $timeout 接收超时时间（秒），0表示使用配置默认值
     * @param int $maxRetries 最大重试次数（0表示使用配置默认值）
     * @return null|array 接收到的原始消息或null
     * @throws WebSocketConnectionException 连接错误且重试失败时抛出
     * @throws WebSocketTimeoutException 操作超时时抛出
     */
    public function receive(
        int $timeout = 0,
        int $maxRetries = 0
    ): ?array {
        // 确定实际使用的超时时间
        $actualTimeout = $timeout > 0 ? $timeout : $this->config->getReadTimeout();
        $startTime = time();
        $endTime = $startTime + $actualTimeout;

        // 确定重试参数
        $retryCount = 0;
        $maxRetries = $maxRetries > 0 ? $maxRetries : $this->config->getMaxRetries();
        $baseDelay = $this->config->getRetryDelay();

        // 主循环：尝试接收消息直到超时
        while (time() < $endTime) {
            try {
                // 检查连接状态
                if (! $this->client->isConnected()) {
                    $this->logger->warning('WebSocket未连接，尝试重新连接', [
                        'task_id' => $this->taskId,
                    ]);
                    $this->connect();
                }

                // 设置当前接收操作的超时时间
                $remainingTime = $endTime - time();
                if ($remainingTime <= 0) {
                    // 总体操作超时
                    return null;
                }

                // 设置较短的读取超时，以便定期检查状态
                $readTimeout = min($remainingTime, 180);
                $this->client->setReadTimeout($readTimeout);

                // 接收消息
                $rawMessage = $this->client->receive();
                if ($rawMessage === null) {
                    continue; // 本次读取超时，继续尝试
                }

                // 更新最后消息时间
                $this->lastMessageTime = time();

                // 直接返回原始消息
                return $rawMessage;
            } catch (WebSocketConnectionException $e) {
                ++$retryCount;
                if ($retryCount > $maxRetries) {
                    $this->logger->error(sprintf(
                        'WebSocket连接失败并超过最大重试次数: %s，任务ID: %s，重试次数: %d',
                        $e->getMessage(),
                        $this->taskId,
                        $retryCount
                    ));
                    throw $e; // 超过最大重试次数，抛出异常
                }

                // 计算指数退避延迟
                $delay = min($baseDelay * pow(2, $retryCount - 1), $this->config->getMaxRetryDelay());
                $this->logger->warning(sprintf(
                    'WebSocket连接失败，第%d次重试，等待%d秒，任务ID: %s，错误: %s',
                    $retryCount,
                    $delay,
                    $this->taskId,
                    $e->getMessage()
                ));

                sleep($delay);
            }
        }

        // 操作超时
        $this->logger->warning(sprintf(
            'WebSocket接收消息超时，任务ID: %s，超时时间: %d秒',
            $this->taskId,
            $actualTimeout
        ));

        throw new WebSocketTimeoutException(sprintf(
            'WebSocket接收消息超时，任务ID: %s，超时时间: %d秒',
            $this->taskId,
            $actualTimeout
        ));
    }

    /**
     * 检查WebSocket连接状态
     *
     * @return bool 连接是否处于活跃状态
     */
    public function isConnected(): bool
    {
        return $this->client->isConnected();
    }

    /**
     * 检查会话是否过期（长时间未活动）.
     *
     * @return bool 会话是否过期
     */
    public function isExpired(): bool
    {
        return time() - $this->lastMessageTime > $this->config->getMaxIdleTime();
    }

    /**
     * 获取当前会话的任务ID.
     *
     * @return string 任务ID
     */
    public function getTaskId(): string
    {
        return $this->taskId;
    }

    /**
     * 获取当前会话的令牌.
     *
     * @return null|string 令牌值或null
     */
    public function getToken(): ?string
    {
        return $this->token;
    }
}
