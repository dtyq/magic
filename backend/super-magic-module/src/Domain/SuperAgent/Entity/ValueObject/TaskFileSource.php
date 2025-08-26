<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * 任务文件来源枚举.
 */
enum TaskFileSource: int
{
    case DEFAULT = 0;

    /**
     * 首页.
     */
    case HOME = 1;

    /**
     * 项目目录.
     */
    case PROJECT_DIRECTORY = 2;

    /**
     * Agent.
     */
    case AGENT = 3;

    case COPY = 4;

    /**
     * 获取来源名称.
     */
    public function getName(): string
    {
        return match ($this) {
            self::DEFAULT => '默认',
            self::HOME => '首页',
            self::PROJECT_DIRECTORY => '项目目录',
            self::AGENT => 'Agent',
            self::COPY => '复制',
        };
    }

    /**
     * 从字符串或整数创建枚举实例.
     */
    public static function fromValue(int|string $value): self
    {
        if (is_string($value)) {
            $value = (int) $value;
        }

        return match ($value) {
            1 => self::HOME,
            2 => self::PROJECT_DIRECTORY,
            3 => self::AGENT,
            4 => self::COPY,
            default => self::DEFAULT,
        };
    }
}
