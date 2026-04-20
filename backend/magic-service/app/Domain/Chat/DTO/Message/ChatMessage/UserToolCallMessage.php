<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\Message\ChatMessage;

use App\Domain\Chat\DTO\Message\MagicMessageStruct;
use App\Domain\Chat\DTO\Message\MessageInterface;
use App\Domain\Chat\DTO\Message\TextContentInterface;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;

/**
 * 用户工具调用消息结构体。
 *
 * 用于所有"需要等待用户输入后回传工具结果"的工具（如 ask_user），
 * 是 tool_reply（旧格式）的通用化升级替代。
 *
 * 前端发送格式：
 * {
 *   "type": "user_tool_call",
 *   "user_tool_call": {
 *     "name": "ask_user",
 *     "tool_call_id": "xxx",
 *     "detail": { "response_status": "answered", "answer": "..." },
 *     "extra": {
 *       "super_agent": {
 *         "dynamic_params": { "message_version": "v2" }
 *       }
 *     }
 *   }
 * }
 */
class UserToolCallMessage extends MagicMessageStruct implements MessageInterface, TextContentInterface
{
    /** 工具名称，如 ask_user */
    protected string $name = '';

    /** 工具调用 ID，关联沙盒下发的工具调用（对应 ask_user 的 question_id） */
    protected string $toolCallId = '';

    /** 工具特定的回复数据，结构由各工具自行约定 */
    protected ?array $detail = null;

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;
        return $this;
    }

    public function getToolCallId(): string
    {
        return $this->toolCallId;
    }

    public function setToolCallId(string $toolCallId): self
    {
        $this->toolCallId = $toolCallId;
        return $this;
    }

    public function getDetail(): ?array
    {
        return $this->detail;
    }

    public function setDetail(?array $detail): self
    {
        $this->detail = $detail;
        return $this;
    }

    // TextContentInterface 实现：user_tool_call 不含文本正文
    public function getTextContent(): string
    {
        return '';
    }

    public function getAttachments(): array
    {
        return [];
    }

    public function toArray(bool $filterNull = false): array
    {
        $data = [
            'name' => $this->name,
            'tool_call_id' => $this->toolCallId,
            'detail' => $this->detail,
            'extra' => $this->extra,
        ];

        return $filterNull ? array_filter($data, fn ($value) => $value !== null) : $data;
    }

    protected function setMessageType(): void
    {
        $this->chatMessageType = ChatMessageType::UserToolCall;
    }
}
