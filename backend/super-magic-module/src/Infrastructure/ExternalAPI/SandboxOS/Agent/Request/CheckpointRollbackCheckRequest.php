<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request;

/**
 * Checkpoint回滚检查请求类
 * 严格按照沙箱通信文档的checkpoint回滚检查请求格式.
 */
class CheckpointRollbackCheckRequest
{
    public function __construct(
        private string $targetMessageId = '',
    ) {
    }

    /**
     * 创建一个checkpoint回滚检查请求对象
     */
    public static function create(
        string $targetMessageId,
    ): self {
        return new self($targetMessageId);
    }

    /**
     * 获取目标消息ID.
     */
    public function getTargetMessageId(): string
    {
        return $this->targetMessageId;
    }

    /**
     * 设置目标消息ID.
     */
    public function setTargetMessageId(string $targetMessageId): self
    {
        $this->targetMessageId = $targetMessageId;
        return $this;
    }

    /**
     * 转换为API请求数组
     * 根据沙箱通信文档的checkpoint回滚检查请求格式.
     */
    public function toArray(): array
    {
        return [
            'target_message_id' => $this->targetMessageId,
        ];
    }
}
