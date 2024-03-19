<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\Sandbox\Config;

class WebSocketConfig
{
    public function __construct(
        private readonly int $maxRetries = 3,
        private readonly int $retryDelay = 1,
        private readonly int $maxIdleTime = 300,
        private readonly int $connectTimeout = 3600,
        private readonly int $readTimeout = 1800,
        private readonly int $heartbeatInterval = 30,
        private readonly string $heartbeatMessage = 'ping',
        private readonly int $taskTimeout = 1800,      // 默认任务超时时间30分钟
        private readonly int $maxProcessingTime = 3600, // 默认最大处理时间1小时
        private readonly int $pongTimeout = 10,       // Pong帧超时时间（秒）
        private readonly int $maxRetryDelay = 30      // 最大重试延迟时间（秒）
    ) {
    }

    public function getMaxRetries(): int
    {
        return $this->maxRetries;
    }

    public function getRetryDelay(): int
    {
        return $this->retryDelay;
    }

    public function getMaxIdleTime(): int
    {
        return $this->maxIdleTime;
    }

    public function getConnectTimeout(): int
    {
        return $this->connectTimeout;
    }

    public function getReadTimeout(): int
    {
        return $this->readTimeout;
    }

    public function getHeartbeatInterval(): int
    {
        return $this->heartbeatInterval;
    }

    public function getHeartbeatMessage(): string
    {
        return $this->heartbeatMessage;
    }

    /**
     * 获取任务处理超时时间（秒）
     * 当任务执行时间超过此值时，将被视为超时.
     */
    public function getTaskTimeout(): int
    {
        return $this->taskTimeout;
    }

    /**
     * 获取最大处理时间（秒）
     * 当消息处理循环执行时间超过此值时，将自动终止处理.
     */
    public function getMaxProcessingTime(): int
    {
        return $this->maxProcessingTime;
    }

    /**
     * 获取Pong帧响应超时时间（秒）
     * 发送Ping帧后，如果在此时间内未收到Pong响应，则认为连接已断开.
     */
    public function getPongTimeout(): int
    {
        return $this->pongTimeout;
    }

    /**
     * 获取最大重试延迟时间（秒）
     * 在指数退避重试策略中，重试延迟不会超过此值.
     */
    public function getMaxRetryDelay(): int
    {
        return $this->maxRetryDelay;
    }
}
