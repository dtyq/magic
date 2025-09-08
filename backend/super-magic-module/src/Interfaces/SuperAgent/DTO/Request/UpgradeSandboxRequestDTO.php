<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class UpgradeSandboxRequestDTO extends AbstractRequestDTO
{
    protected string $messageId = '';

    protected string $contextType = 'continue';

    /**
     * 验证规则.
     */
    public static function getHyperfValidationRules(): array
    {
        return [
            'message_id' => 'required|string',
            'context_type' => 'required|string|in:continue',
        ];
    }

    public static function getHyperfValidationMessage(): array
    {
        return [
            'message_id.required' => '消息ID不能为空',
            'message_id.string' => '消息ID必须是字符串',
            'context_type.required' => '上下文类型不能为空',
            'context_type.string' => '上下文类型必须是字符串',
            'context_type.in' => '上下文类型只能为continue',
        ];
    }

    /**
     * 属性名称.
     */
    public function attributes(): array
    {
        return [
            'message_id' => '消息ID',
            'context_type' => '上下文类型',
        ];
    }

    public function getMessageId(): string
    {
        return $this->messageId;
    }

    public function setMessageId(string $messageId): void
    {
        $this->messageId = $messageId;
    }

    public function getContextType(): string
    {
        return $this->contextType;
    }

    public function setContextType(string $contextType): void
    {
        $this->contextType = $contextType;
    }
}
