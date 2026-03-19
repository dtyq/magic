<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Permission\Entity\ValueObject\OperationPermission;

use App\ErrorCode\PermissionErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

enum ResourceType: int
{
    /**
     * AI 助理.
     */
    case AgentCode = 1;

    /**
     * 子流程.
     */
    case SubFlowCode = 2;

    /**
     * 工具集.
     */
    case ToolSet = 3;

    /**
     * 知识库.
     */
    case Knowledge = 4;

    case MCPServer = 5;

    /**
     * 自定义智能体.
     */
    case CustomAgent = 6;

    /**
     * Skill resource.
     */
    case Skill = 7;

    public static function make(mixed $type): ResourceType
    {
        if (! is_int($type)) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'common.invalid', ['label' => 'resource_type']);
        }
        $type = self::tryFrom($type);
        if (! $type) {
            ExceptionBuilder::throw(PermissionErrorCode::ValidateFailed, 'common.invalid', ['label' => 'resource_type']);
        }
        return $type;
    }
}
