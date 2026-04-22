<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Request;

use App\Infrastructure\Util\IdGenerator\IdGenerator;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageType;

/**
 * 用户工具调用回传请求类.
 *
 * 将前端 user_tool_call 消息透传给沙盒，恢复暂停中的任务。
 * type 固定为 user_tool_call，payload 通过顶层 user_tool_call 字段传递，
 * 与前端直连沙盒时的消息格式完全一致。
 */
class UserToolCallFeedbackRequest extends ChatMessageRequest
{
    public function __construct(
        string $messageId = '',
        string $userId = '',
        private string $name = '',
        private string $toolCallId = '',
        private array $detail = [],
    ) {
        parent::__construct(
            messageId: $messageId,
            userId: $userId,
            prompt: '',
            type: MessageType::UserToolCall->value,
        );
    }

    public static function createFeedback(
        string $userId,
        string $name,
        string $toolCallId,
        array $detail,
    ): self {
        return new self(
            messageId: (string) IdGenerator::getSnowId(),
            userId: $userId,
            name: $name,
            toolCallId: $toolCallId,
            detail: $detail,
        );
    }

    public function toArray(): array
    {
        $base = parent::toArray();
        $base['user_tool_call'] = [
            'name' => $this->name,
            'tool_call_id' => $this->toolCallId,
            'detail' => $this->detail,
            'extra' => [],
        ];
        return $base;
    }
}
