<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

use Exception;

enum SuperMagicAgentOptimizationType: string
{
    case None = 'none';
    case OptimizeNameDescription = 'optimize_name_description';
    case OptimizeContent = 'optimize_content';
    case OptimizeName = 'optimize_name';
    case OptimizeDescription = 'optimize_description';

    /**
     * 获取枚举描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::OptimizeNameDescription => '优化名称和描述',
            self::OptimizeContent => '优化内容',
            self::OptimizeName => '优化名称',
            self::OptimizeDescription => '优化描述',
            self::None => throw new Exception('To be implemented'),
        };
    }

    /**
     * 获取所有枚举值.
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * 从字符串创建枚举实例.
     */
    public static function fromString(string $value): self
    {
        $type = self::tryFrom($value);
        if ($type === null) {
            return self::None;
        }
        return $type;
    }

    public function isNone(): bool
    {
        return $this === self::None;
    }
}
