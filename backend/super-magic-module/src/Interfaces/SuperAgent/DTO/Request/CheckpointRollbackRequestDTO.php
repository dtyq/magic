<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

class CheckpointRollbackRequestDTO extends AbstractRequestDTO
{
    protected string $targetMessageId = '';

    /**
     * 验证规则.
     */
    public static function getHyperfValidationRules(): array
    {
        return [
            'target_message_id' => 'required|string',
        ];
    }

    public static function getHyperfValidationMessage(): array
    {
        return [
            'target_message_id.required' => '目标消息ID不能为空',
        ];
    }

    /**
     * 属性名称.
     */
    public function attributes(): array
    {
        return [
            'target_message_id' => '目标消息ID',
        ];
    }

    public function getTargetMessageId(): string
    {
        return $this->targetMessageId;
    }

    public function setTargetMessageId(string $targetMessageId): void
    {
        $this->targetMessageId = $targetMessageId;
    }
}
