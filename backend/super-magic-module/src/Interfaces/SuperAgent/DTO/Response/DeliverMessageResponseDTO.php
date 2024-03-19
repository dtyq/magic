<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

class DeliverMessageResponseDTO
{
    /**
     * @param bool $success 是否成功
     * @param string $messageId 消息ID
     */
    public function __construct(
        private bool $success,
        private string $messageId
    ) {
    }

    /**
     * 从操作结果创建响应DTO.
     */
    public static function fromResult(bool $success, string $messageId = ''): self
    {
        return new self($success, $messageId);
    }

    /**
     * 转换为数组.
     */
    public function toArray(): array
    {
        return [
            'success' => $this->success,
            'message_id' => $this->messageId,
        ];
    }

    /**
     * 判断操作是否成功.
     */
    public function isSuccess(): bool
    {
        return $this->success;
    }

    /**
     * 获取消息ID.
     */
    public function getMessageId(): string
    {
        return $this->messageId;
    }
}
