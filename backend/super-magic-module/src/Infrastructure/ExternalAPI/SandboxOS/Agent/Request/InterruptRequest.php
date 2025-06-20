<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request;

/**
 * 中断请求类
 * 严格按照沙箱通信文档的中断请求格式
 */
class InterruptRequest
{
    public function __construct(
        private string $messageId = '',
        private string $userId = '',
        private string $taskId = '',
        private string $remark = ''
    ) {}

    /**
     * 创建中断请求
     */
    public static function create(string $messageId, string $userId, string $taskId, string $remark = ''): self
    {
        return new self($messageId, $userId, $taskId, $remark);
    }

    /**
     * 设置用户ID
     */
    public function setUserId(string $userId): self
    {
        $this->userId = $userId;
        return $this;
    }

    /**
     * 获取用户ID
     */
    public function getUserId(): string
    {
        return $this->userId;
    }

    /**
     * 设置任务ID
     */
    public function setTaskId(string $taskId): self
    {
        $this->taskId = $taskId;
        return $this;
    }

    /**
     * 获取任务ID
     */
    public function getTaskId(): string
    {
        return $this->taskId;
    }

    /**
     * 设置消息ID
     */
    public function setMessageId(string $messageId): self
    {
        $this->messageId = $messageId;
        return $this;
    }

    /**
     * 获取消息ID
     */
    public function getMessageId(): string
    {
        return $this->messageId;
    }

    /**
     * 设置备注
     */
    public function setRemark(string $remark): self
    {
        $this->remark = $remark;
        return $this;
    }

    /**
     * 获取备注
     */
    public function getRemark(): string
    {
        return $this->remark;
    }

    /**
     * 转换为API请求数组
     * 根据沙箱通信文档的中断请求格式
     */
    public function toArray(): array
    {
        $data = [
            'message_id' => !empty($this->messageId) ? $this->messageId : (string) \App\Infrastructure\Util\IdGenerator\IdGenerator::getSnowId(),
            'user_id' => $this->userId,
            'task_id' => $this->taskId,
            'type' => 'interrupt',
        ];

        // 如果有备注则添加到请求中
        if (!empty($this->remark)) {
            $data['remark'] = $this->remark;
        }

        return $data;
    }
} 