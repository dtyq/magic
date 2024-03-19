<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Agent\Constant;

use App\ErrorCode\AgentErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

use function Hyperf\Translation\__;

enum InstructGroupPosition: int
{
    case TOOLBAR = 1;    // 工具栏
    case CHATBAR = 2;    // 对话栏

    public const MAX_INSTRUCTS = 5;

    public static function fromPosition(int $type): self
    {
        return match ($type) {
            self::TOOLBAR->value => self::TOOLBAR,
            self::CHATBAR->value => self::CHATBAR,
            default => ExceptionBuilder::throw(AgentErrorCode::VALIDATE_FAILED, 'agent.instruct_group_type_invalid'),
        };
    }

    /**
     * 获取所有组类型及其国际化标签.
     * @return array<string, int> 返回类型名称和对应的值
     */
    public static function getTypeOptions(): array
    {
        return [
            __('agent.instruct_group_type_toolbar') => self::TOOLBAR->value,
            __('agent.instruct_group_type_chatbar') => self::CHATBAR->value,
        ];
    }
}
