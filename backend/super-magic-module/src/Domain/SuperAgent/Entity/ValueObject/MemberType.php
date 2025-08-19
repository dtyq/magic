<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

use App\Infrastructure\Core\Exception\ExceptionBuilder;
use Dtyq\SuperMagic\ErrorCode\SuperAgentErrorCode;

/**
 * 成员类型值对象
 *
 * 封装成员类型的业务逻辑和验证规则
 */
enum MemberType: string
{
    case USER = 'User';
    case DEPARTMENT = 'Department';

    /**
     * 从字符串创建实例.
     */
    public static function fromString(string $type): self
    {
        return match ($type) {
            'User' => self::USER,
            'Department' => self::DEPARTMENT,
            default => ExceptionBuilder::throw(SuperAgentErrorCode::INVALID_MEMBER_TYPE)
        };
    }

    /**
     * 从值创建实例.
     */
    public static function fromValue(string $value): self
    {
        return self::from($value);
    }

    /**
     * 获取值
     */
    public function getValue(): string
    {
        return $this->value;
    }

    /**
     * 是否为用户类型.
     */
    public function isUser(): bool
    {
        return $this === self::USER;
    }

    /**
     * 是否为部门类型.
     */
    public function isDepartment(): bool
    {
        return $this === self::DEPARTMENT;
    }

    /**
     * 获取描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::USER => 'User',
            self::DEPARTMENT => 'Department',
        };
    }
}
