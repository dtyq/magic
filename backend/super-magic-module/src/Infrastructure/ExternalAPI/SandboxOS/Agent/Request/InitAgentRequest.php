<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request;

use App\Infrastructure\Util\IdGenerator\IdGenerator;

/**
 * 初始化Agent请求类
 * 严格按照沙箱通信文档的初始化请求格式.
 */
class InitAgentRequest
{
    public function __construct(
        private string $messageId = '',
        private string $userId = '',
        private array $uploadConfig = [],
        private array $messageSubscriptionConfig = [],
        private array $stsTokenRefresh = [],
        private array $metadata = [],
        private string $taskMode = 'plan'
    ) {
    }

    /**
     * 通过数组创建初始化请求
     */
    public static function fromArray(array $data): self
    {
        return new self(
            $data['message_id'] ?? '',
            $data['user_id'] ?? '',
            $data['upload_config'] ?? [],
            $data['message_subscription_config'] ?? [],
            $data['sts_token_refresh'] ?? [],
            $data['metadata'] ?? [],
            $data['task_mode'] ?? 'plan'
        );
    }

    /**
     * 创建默认的初始化请求
     */
    public static function createDefault(): self
    {
        return new self();
    }

    /**
     * 创建初始化请求
     */
    public static function create(
        string $messageId,
        string $userId,
        array $uploadConfig = [],
        array $messageSubscriptionConfig = [],
        array $stsTokenRefresh = [],
        array $metadata = [],
        string $taskMode = 'plan'
    ): self {
        return new self($messageId, $userId, $uploadConfig, $messageSubscriptionConfig, $stsTokenRefresh, $metadata, $taskMode);
    }

    /**
     * 获取上传配置.
     */
    public function getUploadConfig(): array
    {
        return $this->uploadConfig;
    }

    /**
     * 设置上传配置.
     */
    public function setUploadConfig(array $uploadConfig): self
    {
        $this->uploadConfig = $uploadConfig;
        return $this;
    }

    /**
     * 获取消息订阅配置.
     */
    public function getMessageSubscriptionConfig(): array
    {
        return $this->messageSubscriptionConfig;
    }

    /**
     * 设置消息订阅配置.
     */
    public function setMessageSubscriptionConfig(array $messageSubscriptionConfig): self
    {
        $this->messageSubscriptionConfig = $messageSubscriptionConfig;
        return $this;
    }

    /**
     * 获取STS令牌刷新配置.
     */
    public function getStsTokenRefresh(): array
    {
        return $this->stsTokenRefresh;
    }

    /**
     * 设置STS令牌刷新配置.
     */
    public function setStsTokenRefresh(array $stsTokenRefresh): self
    {
        $this->stsTokenRefresh = $stsTokenRefresh;
        return $this;
    }

    /**
     * 获取元数据.
     */
    public function getMetadata(): array
    {
        return $this->metadata;
    }

    /**
     * 设置元数据.
     */
    public function setMetadata(array $metadata): self
    {
        $this->metadata = $metadata;
        return $this;
    }

    /**
     * 获取任务模式.
     */
    public function getTaskMode(): string
    {
        return $this->taskMode;
    }

    /**
     * 设置任务模式.
     */
    public function setTaskMode(string $taskMode): self
    {
        $this->taskMode = $taskMode;
        return $this;
    }

    /**
     * 设置用户ID.
     */
    public function setUserId(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    /**
     * 获取用户ID.
     */
    public function getUserId(): string
    {
        return $this->userId;
    }

    /**
     * 设置消息ID.
     */
    public function setMessageId(string $messageId): self
    {
        $this->messageId = $messageId;
        return $this;
    }

    /**
     * 获取消息ID.
     */
    public function getMessageId(): string
    {
        return $this->messageId;
    }

    /**
     * 转换为API请求数组
     * 根据沙箱通信文档的初始化请求格式.
     */
    public function toArray(): array
    {
        return [
            'message_id' => ! empty($this->messageId) ? $this->messageId : (string) IdGenerator::getSnowId(),
            'user_id' => $this->userId,
            'type' => 'init',
            'upload_config' => $this->uploadConfig,
            'message_subscription_config' => $this->messageSubscriptionConfig,
            'sts_token_refresh' => $this->stsTokenRefresh,
            'metadata' => $this->metadata,
            'task_mode' => $this->taskMode,
        ];
    }
}
