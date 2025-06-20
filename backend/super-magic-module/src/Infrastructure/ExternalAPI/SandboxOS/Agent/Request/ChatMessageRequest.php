<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request;

use App\Infrastructure\Util\IdGenerator\IdGenerator;

/**
 * 聊天消息请求类
 * 严格按照沙箱通信文档的聊天消息请求格式.
 */
class ChatMessageRequest
{
    public function __construct(
        private string $messageId = '',
        private string $userId = '',
        private string $taskId = '',
        private string $prompt = '',
        private string $taskMode = 'chat',
        private array $attachments = []
    ) {
    }

    /**
     * 创建一个聊天消息请求对象
     */
    public static function create(
        string $messageId,
        string $userId,
        string $taskId,
        string $prompt,
        string $taskMode = 'chat',
        array $attachments = []
    ): self {
        return new self($messageId, $userId, $taskId, $prompt, $taskMode, $attachments);
    }

    /**
     * 获取提示内容.
     */
    public function getPrompt(): string
    {
        return $this->prompt;
    }

    /**
     * 设置提示内容.
     */
    public function setPrompt(string $prompt): self
    {
        $this->prompt = $prompt;
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
     * 获取附件.
     */
    public function getAttachments(): array
    {
        return $this->attachments;
    }

    /**
     * 设置附件.
     */
    public function setAttachments(array $attachments): self
    {
        $this->attachments = $attachments;
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
     * 设置任务ID.
     */
    public function setTaskId(string $taskId): self
    {
        $this->taskId = $taskId;
        return $this;
    }

    /**
     * 获取任务ID.
     */
    public function getTaskId(): string
    {
        return $this->taskId;
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
     * 根据沙箱通信文档的聊天消息请求格式.
     */
    public function toArray(): array
    {
        return [
            'message_id' => ! empty($this->messageId) ? $this->messageId : (string) IdGenerator::getSnowId(),
            'user_id' => $this->userId,
            'task_id' => $this->taskId,
            'type' => 'chat',
            'prompt' => $this->prompt,
            'task_mode' => $this->taskMode,
            'attachments' => $this->attachments,
        ];
    }
}
